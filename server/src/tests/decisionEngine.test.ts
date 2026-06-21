import { decisionEngine } from '../services/decisionEngine';
import { ChatSession } from '../types/clinic.types';

describe('Decision Engine - Local NLP Matcher', () => {
  let session: ChatSession;

  beforeEach(() => {
    session = {
      sessionId: 'test-session-123',
      messages: [],
      bookingState: {
        step: 'none',
        data: {}
      }
    };
  });

  test('should handle general greetings', async () => {
    const result = await decisionEngine.processMessage(session, 'Hi, hello!');
    expect(result.reply).toContain('Welcome to AuraCare Clinic');
    expect(result.session.messages.length).toBe(1);
    expect(result.session.bookingState?.step).toBe('none');
  });

  test('should identify acne concerns and map to Skin Department & Carbon Laser Toning', async () => {
    const result = await decisionEngine.processMessage(session, 'I am looking for acne treatments and skin help');
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations?.department?.id).toBe('skin');
    expect(result.recommendations?.treatments.some(t => t.id === 'carbon-laser' || t.id === 'chemical-peel')).toBe(true);
    expect(result.reply).toContain('Skin Department');
  });

  test('should identify bleeding gums and map to Dental Department & scaling', async () => {
    const result = await decisionEngine.processMessage(session, 'my gums are bleeding and they hurt');
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations?.department?.id).toBe('dental');
    expect(result.recommendations?.treatments.some(t => t.id === 'scaling-polishing')).toBe(true);
  });

  test('should resolve clinic timings FAQ query', async () => {
    const result = await decisionEngine.processMessage(session, 'what are your clinic timings and hours?');
    expect(result.suggestedFaq).toBeDefined();
    expect(result.suggestedFaq?.question).toContain('timings');
    expect(result.reply).toContain('9:00 AM to 7:00 PM');
  });

  test('should initiate booking flow on booking triggers', async () => {
    const result = await decisionEngine.processMessage(session, 'I want to book an appointment please');
    expect(result.session.bookingState?.step).toBe('name');
    expect(result.reply).toContain('may I please have your full name');
  });

  test('should proceed through step-by-step booking flow', async () => {
    // Step 1: Trigger booking
    let res = await decisionEngine.processMessage(session, 'I want to schedule an appointment');
    expect(session.bookingState?.step).toBe('name');

    // Step 2: Provide Name
    res = await decisionEngine.processMessage(session, 'Alice Smith');
    expect(session.bookingState?.step).toBe('phone');
    expect(session.bookingState?.data.name).toBe('Alice Smith');
    expect(res.reply).toContain('phone number');

    // Step 3: Provide Phone
    res = await decisionEngine.processMessage(session, '555-4321');
    expect(session.bookingState?.step).toBe('concern');
    expect(session.bookingState?.data.phone).toBe('555-4321');
    expect(res.reply).toContain('describe your concern');

    // Step 4: Provide Concern
    res = await decisionEngine.processMessage(session, 'Need to get teeth cleaned');
    expect(session.bookingState?.step).toBe('date');
    expect(session.bookingState?.data.concern).toBe('Need to get teeth cleaned');
    expect(res.reply).toContain('preferred date');

    // Step 5: Provide Date
    res = await decisionEngine.processMessage(session, '2026-07-15');
    expect(session.bookingState?.step).toBe('time');
    expect(session.bookingState?.data.preferredDate).toBe('2026-07-15');
    expect(res.reply).toContain('time');

    // Step 6: Provide Time
    res = await decisionEngine.processMessage(session, '2:30 PM');
    expect(session.bookingState?.step).toBe('confirming');
    expect(session.bookingState?.data.preferredTime).toBe('2:30 PM');
    expect(res.reply).toContain('Confirm booking');

    // Step 7: Confirm Booking
    res = await decisionEngine.processMessage(session, 'Yes, confirm');
    expect(session.bookingState?.step).toBe('none');
    expect(res.appointmentReady).toBeDefined();
    expect(res.appointmentReady?.name).toBe('Alice Smith');
    expect(res.appointmentReady?.phone).toBe('555-4321');
    expect(res.appointmentReady?.concern).toBe('Need to get teeth cleaned');
    expect(res.appointmentReady?.preferredDate).toBe('2026-07-15');
    expect(res.appointmentReady?.preferredTime).toBe('2:30 PM');
    expect(res.reply).toContain('Booking Confirmed');
  });

  test('should detect urgent symptoms and flag urgency', async () => {
    const result = await decisionEngine.processMessage(session, 'I have severe tooth pain and heavy bleeding');
    expect(result.urgencyLevel).toBe('urgent');
    expect(result.reply).toContain('emergency');
  });
});
