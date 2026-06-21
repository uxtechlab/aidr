import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Trash2, ArrowRight } from 'lucide-react';
import { apiFetch } from '../config/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface Treatment {
  id: string;
  departmentId: string;
  name: string;
  cost: number;
  recoveryTime: string;
}

interface Department {
  id: string;
  name: string;
  specialist: string;
}

interface ChatWidgetProps {
  onBookTreatment: (treatment: Treatment) => void;
  onBookingCompleted: () => void;
}

const QUICK_SUGGESTIONS = [
  'Help with acne breakouts',
  'I have bleeding gums',
  'PRP for hair loss details',
  'How much is teeth cleaning?',
  'Schedule a cosmetic checkup'
];

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key++}`} style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
          {listItems.map((item, i) => (
            <li key={i}>{parseBold(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const parseBold = (segment: string): React.ReactNode => {
    const parts = segment.split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, idx) => {
    if (line.startsWith('- ')) {
      listItems.push(line.slice(2));
    } else {
      flushList();
      if (idx > 0) {
        elements.push(<br key={`br-${key++}`} />);
      }
      elements.push(<React.Fragment key={`t-${key++}`}>{parseBold(line)}</React.Fragment>);
    }
  });
  flushList();

  return <>{elements}</>;
}

export default function ChatWidget({ onBookTreatment, onBookingCompleted }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! 👋 Welcome to AuraCare Clinic. I'm your digital health & aesthetic assistant. \n\nHow can I help you today? Feel free to describe any concerns (e.g., tooth pain, acne, hair fall) or ask to book an appointment directly!",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [bookingState, setBookingState] = useState<any>(null);
  
  // Track context recommendations returned from chatbot
  const [currentRecs, setCurrentRecs] = useState<{
    department?: Department;
    treatments: Treatment[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize session ID
  useEffect(() => {
    const sId = 'session-' + Math.random().toString(36).substring(2, 9);
    setSessionId(sId);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, currentRecs]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Clear previous dynamic recommendations cards on new user message,
    // they are saved in chat history bubble anyway.
    setCurrentRecs(null);

    // 1. Add user message locally
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          message: textToSend
        })
      });

      if (!response.ok) throw new Error('API server returned error.');

      const result = await response.json();

      setIsTyping(false);
      
      // 2. Add bot reply locally
      const botMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        sender: 'bot',
        text: result.reply,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, botMsg]);
      setBookingState(result.bookingState);

      // Save matching recommendations for tags box
      if (result.recommendations && result.recommendations.treatments?.length > 0) {
        setCurrentRecs(result.recommendations);
      }

      // If appointment was confirmed in booking state machine, trigger catalog reload
      if (result.appointmentConfirmed) {
        onBookingCompleted();
      }

    } catch (err) {
      console.error(err);
      setIsTyping(false);
      
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        sender: 'bot',
        text: "I'm having trouble connecting to my diagnostic system right now. Please verify that the backend API server is online, or feel free to call our reception desks directly!",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear this conversation history?')) {
      try {
        await apiFetch(`/api/chat/session/${sessionId}`, { method: 'DELETE' });
      } catch (e) {
        console.error(e);
      }
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: "Hi again! Let's start fresh. How can I help you today?",
          timestamp: new Date().toISOString()
        }
      ]);
      setBookingState(null);
      setCurrentRecs(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage(inputText);
    }
  };

  return (
    <div className="glass-panel chat-container" style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}>
      {/* Chat header */}
      <div className="chat-header">
        <div className="bot-info">
          <div className="bot-avatar">
            <Sparkles size={16} />
            <div className="bot-status-dot"></div>
          </div>
          <div>
            <div className="bot-name">AuraCare AI</div>
            <div className="bot-subtitle">Smart Diagnostic Assistant</div>
          </div>
        </div>
        <button 
          className="btn btn-text" 
          onClick={handleClearHistory} 
          style={{ padding: '0.4rem', borderRadius: '50%' }}
          title="Clear Chat History"
          aria-label="Clear chat history"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Messages list */}
      <div className="chat-messages" aria-live="polite">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.sender}`} id={`chat-msg-${msg.id}`}>
            <div className="message-bubble">
              {renderMarkdown(msg.text)}
            </div>
            <span className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {/* Display recommendations dynamically inside the message feed if returned */}
        {currentRecs && (
          <div className="recommendations-box" style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
            <span className="rec-title">
              <Sparkles size={12} />
              Recommending {currentRecs.department?.name || 'Treatments'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Consult with {currentRecs.department?.specialist || 'Specialist'}:
            </span>
            {currentRecs.treatments.map(t => (
              <div key={t.id} className="rec-item" style={{ gap: '0.5rem' }}>
                <span style={{ fontWeight: 500 }}>{t.name}</span>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '6px' }}
                  onClick={() => onBookTreatment(t)}
                >
                  Book <ArrowRight size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Booking state transparency overlay */}
        {bookingState && bookingState.step !== 'none' && (
          <div className="chat-booking-card" style={{ alignSelf: 'flex-start', maxWidth: '80%', fontSize: '0.8rem' }}>
            <strong style={{ color: 'var(--color-secondary)' }}>Appointment Processing:</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0.25rem 0.5rem', color: 'var(--color-text-secondary)' }}>
              <span>Step:</span>
              <strong style={{ textTransform: 'uppercase', color: 'var(--color-text-primary)' }}>{bookingState.step}</strong>
              {bookingState.data.name && (
                <>
                  <span>Name:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{bookingState.data.name}</span>
                </>
              )}
              {bookingState.data.phone && (
                <>
                  <span>Phone:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{bookingState.data.phone}</span>
                </>
              )}
              {bookingState.data.concern && (
                <>
                  <span>Concern:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{bookingState.data.concern}</span>
                </>
              )}
              {bookingState.data.preferredDate && (
                <>
                  <span>Date:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{bookingState.data.preferredDate}</span>
                </>
              )}
              {bookingState.data.preferredTime && (
                <>
                  <span>Time:</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{bookingState.data.preferredTime}</span>
                </>
              )}
            </div>
          </div>
        )}

        {isTyping && (
          <div className="typing-indicator" style={{ alignSelf: 'flex-start' }} aria-label="Bot is typing">
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      {messages.length === 1 && !isTyping && (
        <div className="quick-tags">
          {QUICK_SUGGESTIONS.map((sug, i) => (
            <button 
              key={i} 
              className="tag-btn" 
              onClick={() => handleSendMessage(sug)}
              id={`quick-chip-${i}`}
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        <input 
          type="text" 
          placeholder={
            bookingState && bookingState.step !== 'none'
              ? `Entering booking details: ${bookingState.step}...`
              : "Ask about treatments, FAQs, or type 'book'..."
          }
          className="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          aria-label="Message chatbot input"
          id="chat-input"
        />
        <button 
          className="chat-send-btn" 
          onClick={() => handleSendMessage(inputText)}
          aria-label="Send message"
          id="chat-send-btn"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
