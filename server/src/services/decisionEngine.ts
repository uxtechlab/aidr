import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../config/config';
import { clinicService } from './clinicService';
import { ChatSession, ChatMessage, Treatment, Department, FAQ, Appointment } from '../types/clinic.types';

// Initialize Gemini client if key is present
let aiClient: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
    console.log('Gemini AI Client successfully initialized.');
  } catch (error) {
    console.error('Failed to initialize Gemini Client:', error);
  }
}

// Stop words to filter out for basic NLP matching
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
  'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their', 
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 
  'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'hi', 'hello', 'hey', 'greetings', 'please', 'would', 'could', 'want', 'like', 'need', 'get'
]);

export class DecisionEngine {
  /**
   * Processes a user message, updates conversation state, and returns response details.
   */
  public async processMessage(
    session: ChatSession,
    userText: string
  ): Promise<{
    reply: string;
    session: ChatSession;
    urgencyLevel: 'normal' | 'urgent';
    recommendations?: {
      department?: Department;
      treatments: Treatment[];
    };
    suggestedFaq?: FAQ;
    appointmentReady?: Partial<Appointment>;
  }> {
    const urgencyLevel = this.detectUrgency(userText);
    // 1. Record user message
    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      sender: 'user',
      text: userText,
      timestamp: new Date().toISOString()
    };
    session.messages.push(userMessage);

    // 2. Check if currently in an active booking flow
    if (session.bookingState && session.bookingState.step !== 'none') {
      const bookingResult = this.handleBookingFlow(session, userText);
      return { ...bookingResult, urgencyLevel };
    }

    // 3. Check for booking trigger intents
    const isBookingIntent = this.detectBookingIntent(userText);
    if (isBookingIntent) {
      session.bookingState = {
        step: 'name',
        data: {}
      };
      
      // Attempt to pre-fill concern if user mentions a concern in the trigger message
      const initialConcern = this.extractInitialConcern(userText);
      if (initialConcern) {
        session.bookingState.data.concern = initialConcern;
      }

      // Check if user already provided their name in the initial greeting/booking
      const extractedName = this.extractName(userText);
      if (extractedName) {
        session.bookingState.data.name = extractedName;
        session.bookingState.step = 'phone';
        
        const reply = `I'd be happy to help you schedule an appointment, ${extractedName}! Could you please share your phone number so we can register your file?`;
        return {
          reply,
          session,
          urgencyLevel,
          ...this.runDiagnostics(userText)
        };
      }

      const reply = "I would be happy to assist you in booking an appointment at AuraCare. To get started, may I please have your full name?";
      return {
        reply,
        session,
        urgencyLevel,
        ...this.runDiagnostics(userText)
      };
    }

    // 4. Try AI-powered mode if Gemini key is available
    if (aiClient) {
      try {
        const aiResponse = await this.processWithAI(session.messages, userText);
        if (aiResponse) {
          // If the AI suggests initiating a booking, transition state
          if (aiResponse.initiateBooking) {
            session.bookingState = {
              step: 'name',
              data: aiResponse.bookingDetails || {}
            };
          }

          // Generate system diagnostics for tags/recommendations block
          const diagnostics = this.runDiagnostics(userText);

          return {
            reply: aiResponse.reply,
            session,
            urgencyLevel,
            recommendations: diagnostics.recommendations,
            suggestedFaq: diagnostics.suggestedFaq
          };
        }
      } catch (err) {
        console.error('Gemini API call failed, falling back to local NLP engine.', err);
      }
    }

    // 5. Fallback to Local NLP decision engine
    const diagnostics = this.runDiagnostics(userText);
    let reply = '';
    
    let urgentPrefix = '';
    if (urgencyLevel === 'urgent') {
      urgentPrefix = '⚠️ **URGENT**: Your symptoms sound serious. Please contact our emergency line immediately at +1 (555) 872-2273 or visit the nearest emergency room. If this is a life-threatening emergency, call 911 right away. Our clinic team is available Mon-Sat 9 AM–7 PM for urgent walk-ins.\n\n';
    }

    if (diagnostics.suggestedFaq) {
      reply = urgentPrefix + `${diagnostics.suggestedFaq.answer}\n\n*Would you like to schedule a consultation with our specialist to discuss this further?*`;
    } else if (diagnostics.recommendations && diagnostics.recommendations.treatments.length > 0) {
      const rec = diagnostics.recommendations;
      const deptName = rec.department?.name || 'our specialized departments';
      const specialist = rec.department?.specialist ? ` under the care of ${rec.department.specialist}` : '';
      const treatmentList = rec.treatments.map(t => `- **${t.name}** (Cost: $${t.cost}, Recovery: ${t.recoveryTime})`).join('\n');
      
      reply = urgentPrefix + `Based on what you've shared, your concerns match our **${deptName}**${specialist}. \n\nWe recommend considering the following treatments:\n${treatmentList}\n\nWould you like to book an appointment for a personalized consultation?`;
    } else {
      // General greeting / standard helper reply
      reply = this.generateGeneralReply(userText);
    }

    return {
      reply,
      session,
      urgencyLevel,
      recommendations: diagnostics.recommendations,
      suggestedFaq: diagnostics.suggestedFaq
    };
  }

  /**
   * Helper to handle the step-by-step appointment booking state machine
   */
  private handleBookingFlow(
    session: ChatSession,
    inputText: string
  ): {
    reply: string;
    session: ChatSession;
    recommendations?: { department?: Department; treatments: Treatment[] };
    appointmentReady?: Partial<Appointment>;
  } {
    const state = session.bookingState!;
    const diagnostics = this.runDiagnostics(inputText);

    // Allow user to cancel the booking flow
    if (/cancel|stop|restart|exit/i.test(inputText)) {
      session.bookingState = { step: 'none', data: {} };
      return {
        reply: "Booking cancelled. How else can I assist you today?",
        session
      };
    }

    switch (state.step) {
      case 'name':
        // Clean name
        const name = inputText.replace(/my name is|i'm|i am/gi, '').trim();
        if (name.length < 2) {
          return {
            reply: "Please enter a valid name (at least 2 letters).",
            session
          };
        }
        state.data.name = name;
        state.step = 'phone';
        return {
          reply: `Thank you, ${name}. What is your phone number? (e.g., 555-0199)`,
          session
        };

      case 'phone':
        // Match numbers, dashes, parentheses
        const phone = inputText.trim();
        const cleanPhone = phone.replace(/[^0-9+\-()\s]/g, '');
        if (cleanPhone.length < 7) {
          return {
            reply: "Please enter a valid phone number (at least 7 digits).",
            session
          };
        }
        state.data.phone = cleanPhone;
        
        // If concern is already populated, skip concern step
        if (state.data.concern && state.data.concern.length > 5) {
          state.step = 'date';
          return {
            reply: `Got it. For your concern (${state.data.concern}), what is your preferred date for the appointment? (Use format YYYY-MM-DD or say 'tomorrow')`,
            session
          };
        } else {
          state.step = 'concern';
          return {
            reply: "Great. Please describe your concern or the treatment you'd like to book:",
            session
          };
        }

      case 'concern':
        const concern = inputText.trim();
        if (concern.length < 5) {
          return {
            reply: "Please provide a bit more detail about your concern so we can assign the correct specialist.",
            session
          };
        }
        state.data.concern = concern;
        state.step = 'date';
        return {
          reply: "What is your preferred date for the appointment? (Use format YYYY-MM-DD, e.g., 2026-06-25)",
          session
        };

      case 'date':
        const dateInput = inputText.trim().toLowerCase();
        let parsedDate = '';
        
        if (dateInput.includes('today')) {
          parsedDate = new Date().toISOString().split('T')[0];
        } else if (dateInput.includes('tomorrow')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          parsedDate = tomorrow.toISOString().split('T')[0];
        } else {
          // Check standard YYYY-MM-DD pattern
          const match = dateInput.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (match) {
            parsedDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
          }
        }

        if (!parsedDate) {
          // Fallback to accepting whatever text they write if it looks like a date,
          // but for validation we prefer a clean representation.
          if (dateInput.length > 4) {
            parsedDate = dateInput;
          } else {
            return {
              reply: "Please state a valid date (e.g. YYYY-MM-DD, 'tomorrow', or 'next Monday').",
              session
            };
          }
        }

        state.data.preferredDate = parsedDate;
        state.step = 'time';
        return {
          reply: "What time would you prefer? (e.g., 10:00 AM, 3:30 PM)",
          session
        };

      case 'time':
        const timeInput = inputText.trim();
        if (timeInput.length < 3) {
          return {
            reply: "Please enter a preferred time (e.g. '10 AM' or '3:30 PM').",
            session
          };
        }
        state.data.preferredTime = timeInput;
        state.step = 'confirming';

        return {
          reply: `Excellent! We have collected all details. Please review them:\n\n` +
                 `- **Name**: ${state.data.name}\n` +
                 `- **Phone**: ${state.data.phone}\n` +
                 `- **Concern**: ${state.data.concern}\n` +
                 `- **Preferred Date**: ${state.data.preferredDate}\n` +
                 `- **Preferred Time**: ${state.data.preferredTime}\n\n` +
                 `Confirm booking? Type **Confirm** or **Yes** to complete. (Or say **Cancel** to abort)`,
          session
        };

      case 'confirming':
        const confirmWord = inputText.trim().toLowerCase();
        if (/yes|confirm|ok|sure/i.test(confirmWord)) {
          // Trigger appointment saving
          const appointmentReady = { ...state.data };
          
          // Clear session booking state
          session.bookingState = { step: 'none', data: {} };
          
          return {
            reply: `🎉 **Booking Confirmed!**\n\nThank you, ${appointmentReady.name}. Your appointment request has been recorded for **${appointmentReady.preferredDate} at ${appointmentReady.preferredTime}**. Our clinic desk will contact you at ${appointmentReady.phone} shortly to finalize the specialist slots.`,
            session,
            appointmentReady
          };
        } else {
          session.bookingState = { step: 'none', data: {} };
          return {
            reply: "Booking cancelled. Feel free to browse services or ask any questions!",
            session
          };
        }

      default:
        session.bookingState = { step: 'none', data: {} };
        return {
          reply: "Something went wrong in the booking steps. Let's restart. How can I help you?",
          session
        };
    }
  }

  /**
   * Run local NLP logic to identify departments, matching treatments, and FAQ queries
   */
  private runDiagnostics(text: string): {
    recommendations?: {
      department?: Department;
      treatments: Treatment[];
    };
    suggestedFaq?: FAQ;
  } {
    const config = clinicService.getConfig();
    const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleanText.split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));

    if (tokens.length === 0) {
      return {};
    }

    // 1. Search FAQ matching by counting token overlaps
    let bestFaq: FAQ | undefined;
    let maxFaqOverlap = 0;
    
    for (const faq of config.faqs) {
      const faqClean = faq.question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      const faqTokens = faqClean.split(/\s+/);
      let overlap = 0;
      for (const token of tokens) {
        if (faqTokens.includes(token)) {
          overlap++;
        }
      }
      // Boost if the user query contains key terms from the question
      if (overlap > maxFaqOverlap && overlap >= 2) {
        maxFaqOverlap = overlap;
        bestFaq = faq;
      }
    }

    // 2. Treatment matching using keyword overlap score
    const matchedTreatments: { treatment: Treatment; score: number }[] = [];
    
    for (const treatment of config.treatments) {
      let score = 0;
      const treatmentNameTokens = treatment.name.toLowerCase().split(/\s+/);
      
      // Token matches
      for (const token of tokens) {
        // High weight for matching keywords explicitly declared in JSON (split multi-word keywords)
        if (treatment.keywords.some(kw => kw.toLowerCase().split(/\s+/).includes(token))) {
          score += 10;
        }
        // Medium weight for matching words inside treatment name
        if (treatmentNameTokens.includes(token)) {
          score += 5;
        }
        // Lower weight for matching description parts (split into word list)
        const descTokens = treatment.description.toLowerCase().split(/\s+/);
        if (descTokens.includes(token)) {
          score += 1;
        }
      }

      if (score > 0) {
        matchedTreatments.push({ treatment, score });
      }
    }

    // Sort matching treatments by score descending
    matchedTreatments.sort((a, b) => b.score - a.score);

    if (matchedTreatments.length > 0) {
      const primaryTreatment = matchedTreatments[0].treatment;
      const dept = config.departments.find(d => d.id === primaryTreatment.departmentId);
      
      return {
        recommendations: {
          department: dept,
          treatments: matchedTreatments.slice(0, 3).map(m => m.treatment)
        },
        suggestedFaq: maxFaqOverlap >= 3 ? bestFaq : undefined 
      };
    }

    // If no treatments match, check if a department name matches directly
    for (const dept of config.departments) {
      if (tokens.some(t => dept.id.includes(t) || dept.name.toLowerCase().includes(t))) {
        // Return treatments for this department
        const deptTreatments = config.treatments.filter(t => t.departmentId === dept.id);
        return {
          recommendations: {
            department: dept,
            treatments: deptTreatments.slice(0, 3)
          },
          suggestedFaq: bestFaq
        };
      }
    }

    return {
      suggestedFaq: bestFaq
    };
  }

  /**
   * Check if user input indicates they want to schedule an appointment
   */
  private detectBookingIntent(text: string): boolean {
    const triggers = [
      /\bbook\b/i, /\bschedule\b/i, /\bappointment\b/i, /\breserve\b/i, 
      /\bconsultation\b/i, /\bmeet doctor\b/i, /\bbooking\b/i, /\bvisit\b/i
    ];
    return triggers.some(regex => regex.test(text));
  }

  /**
   * Try to pull out a concern from the booking trigger
   */
  private extractInitialConcern(text: string): string | undefined {
    const match = text.match(/(?:for|with|about|because of)\s+([^.?!,]{5,50})/i);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Simple regex to pull name out of phrases like "I am John Doe" or "My name is Sarah"
   */
  private extractName(text: string): string | undefined {
    const patterns = [
      /my name is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /i'm\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /i am\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /this is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Avoid extracting words like "here", "ready", "interested"
        const lowerName = name.toLowerCase();
        if (!['here', 'ready', 'interested', 'trying', 'seeking', 'a', 'the', 'booking'].includes(lowerName)) {
          return name;
        }
      }
    }
    return undefined;
  }

  /**
   * Detect urgency keywords in user text to flag emergency situations.
   * @returns 'urgent' if emergency keywords are found, 'normal' otherwise
   */
  private detectUrgency(text: string): 'normal' | 'urgent' {
    const urgencyPatterns = [
      /\bsevere\b/i,
      /\bemergency\b/i,
      /\bunbearable\b/i,
      /\bextreme\s+pain\b/i,
      /\bswelling\b/i,
      /\bbleeding\s+heavily\b/i,
      /\bheavy\s+bleeding\b/i,
    ];
    return urgencyPatterns.some(pattern => pattern.test(text)) ? 'urgent' : 'normal';
  }

  /**
   * Fallback generic responses for greeting, pricing questions, etc.
   * Also detects urgent symptoms and returns emergency contact info.
   */
  private generateGeneralReply(text: string): string {
    const lower = text.toLowerCase();

    // Check for urgency first — always surface emergency info
    if (this.detectUrgency(text) === 'urgent') {
      return '⚠️ **URGENT**: Your symptoms sound serious. Please contact our emergency line immediately at +1 (555) 872-2273 or visit the nearest emergency room. If this is a life-threatening emergency, call 911 right away. Our clinic team is available Mon-Sat 9 AM–7 PM for urgent walk-ins.';
    }

    if (/hi|hello|hey|greetings/i.test(lower)) {
      return "Hello! Welcome to AuraCare Clinic. How can I help you today? You can ask about our treatments, check recovery times, or schedule an appointment!";
    }
    
    if (/cost|price|fee|charge|how much/i.test(lower)) {
      return "Our treatment costs vary. Scaling and Polishing is $120, Carbon Laser Toning is $200, and PRP Hair Restoration is $350. You can view all pricing details in our services dashboard. Would you like me to guide you to a specific department?";
    }

    if (/thank you|thanks/i.test(lower)) {
      return "You're very welcome! If you have any other questions or would like to book an appointment, just let me know.";
    }

    return "I'm here to assist you with any questions about AuraCare clinic services, treatments (Dental, Skin, Hair, Laser, Cosmetic), or to help you book an appointment. Could you please specify what concern or treatment you're inquiring about?";
  }

  /**
   * Call the Google Gemini API using the official client library
   */
  private async processWithAI(
    messages: ChatMessage[],
    currentMessage: string
  ): Promise<{
    reply: string;
    initiateBooking?: boolean;
    bookingDetails?: Partial<Appointment>;
  } | null> {
    if (!aiClient) return null;

    const config = clinicService.getConfig();
    
    // Create grounding system prompt detailing the catalog
    const systemInstruction = `
You are the expert receptionist and AI Medical Assistant for "${config.clinic.name}".
Clinic details:
- Phone: ${config.clinic.phone}
- Email: ${config.clinic.email}
- Address: ${config.clinic.address}
- Hours: ${config.clinic.hours}

We offer treatments in the following departments:
${JSON.stringify(config.departments, null, 2)}

Our complete treatments directory:
${JSON.stringify(config.treatments, null, 2)}

Our frequently asked questions (FAQs):
${JSON.stringify(config.faqs, null, 2)}

YOUR RULES:
1. Ground your knowledge in the provided services and FAQs list. Do not recommend treatments or claim capabilities outside what is provided.
2. If the user mentions concerns like tooth pain, bleeding gums, acne, hair fall, unwanted hair, or wrinkles, map them to the correct department and list the recommended treatments.
3. Be professional, empathetic, and clear. State recovery times, costs, and safety info directly when asked.
4. Help the user schedule an appointment if they express interest.
5. You MUST respond with a valid JSON object matching the format below. Do not output markdown code blocks unless they contain this JSON.
JSON Response Schema:
{
  "reply": "Conversational reply text, maintaining the persona",
  "initiateBooking": true/false (set to true if the user wants to book, start, schedule, or has provided info to schedule),
  "bookingDetails": {
    "name": "extracted name or null",
    "phone": "extracted phone or null",
    "concern": "extracted concern or null",
    "preferredDate": "extracted date in YYYY-MM-DD or null",
    "preferredTime": "extracted time or null"
  }
}
`;

    // Map message history into Gemini content structure.
    // In @google/generative-ai, roles must be 'user' or 'model' (or 'system' if passed separately, which we do via systemInstruction).
    const contents = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    try {
      const model = aiClient.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const response = await model.generateContent({
        contents: contents
      });

      const text = response.response.text();
      if (text) {
        const parsed = JSON.parse(text);
        return {
          reply: parsed.reply,
          initiateBooking: parsed.initiateBooking,
          bookingDetails: parsed.bookingDetails
        };
      }
    } catch (e) {
      console.error('Error generating response from Gemini API:', e);
    }
    return null;
  }
}

export const decisionEngine = new DecisionEngine();
