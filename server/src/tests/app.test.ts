import request from 'supertest';
import app from '../app';
import fs from 'fs';
import path from 'path';

const servicesJsonPath = path.resolve(__dirname, '../data/services.json');
const appointmentsJsonPath = path.resolve(__dirname, '../data/appointments.json');

describe('Clinic AI Assistant API Integration Tests', () => {
  let originalServicesContent = '';

  beforeAll(() => {
    // Save original services content to restore after test runs
    if (fs.existsSync(servicesJsonPath)) {
      originalServicesContent = fs.readFileSync(servicesJsonPath, 'utf-8');
    }
  });

  afterAll(() => {
    // Restore original services.json
    if (originalServicesContent) {
      fs.writeFileSync(servicesJsonPath, originalServicesContent, 'utf-8');
    }
    // Delete test appointments.json to clean up
    if (fs.existsSync(appointmentsJsonPath)) {
      fs.unlinkSync(appointmentsJsonPath);
    }
  });

  test('GET /health - should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/services - should return clinic, departments, and treatments lists', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.clinic).toBeDefined();
    expect(res.body.departments).toBeInstanceOf(Array);
    expect(res.body.treatments).toBeInstanceOf(Array);
    expect(res.body.treatments.length).toBeGreaterThan(0);
  });

  test('GET /api/faqs - should return array of FAQs', async () => {
    const res = await request(app).get('/api/faqs');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/chat - should process messaging and maintain state', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({
        sessionId: 'test-session',
        message: 'Hello, what skin treatments do you have?'
      });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe('test-session');
    expect(res.body.reply).toBeDefined();
    expect(res.body.recommendations).toBeDefined();
    expect(res.body.recommendations.department.id).toBe('skin');
  });

  test('POST /api/appointments - should fail with 400 when missing fields', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'John',
        phone: 'invalid-phone-letters',
        concern: 'hurt',
        preferredDate: '2020-01-01' // Past date
      });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('POST /api/appointments - should succeed with 201 when inputs are valid', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const validDateString = tomorrow.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/appointments')
      .send({
        name: 'John Doe',
        phone: '+1 (555) 902-1234',
        concern: 'Severe tooth pain in upper molar',
        preferredDate: validDateString,
        preferredTime: '11:30 AM',
        departmentId: 'dental',
        treatmentId: 'root-canal'
      });

    expect(res.status).toBe(201);
    expect(res.body.appointment).toBeDefined();
    expect(res.body.appointment.name).toBe('John Doe');
    expect(res.body.appointment.status).toBe('pending');
  });

  test('POST /api/admin/treatments - should add new treatment dynamically', async () => {
    const res = await request(app)
      .post('/api/admin/treatments')
      .send({
        name: 'Hollywood Laser Glow',
        departmentId: 'skin',
        description: 'Advanced instant glow skin laser.',
        duration: '30 mins',
        recoveryTime: 'Immediate',
        cost: 299,
        safetyInfo: 'Avoid sun exposure.',
        keywords: ['glow', 'laser skin']
      });

    expect(res.status).toBe(201);
    expect(res.body.treatment).toBeDefined();
    expect(res.body.treatment.id).toBe('hollywood-laser-glow');

    // Verify it is saved in services.json
    const updatedServicesRes = await request(app).get('/api/services');
    const treatments = updatedServicesRes.body.treatments;
    expect(treatments.some((t: any) => t.id === 'hollywood-laser-glow')).toBe(true);
  });

  test('GET /api/admin/stats - should return dashboard statistics', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalAppointments).toBeDefined();
    expect(res.body.totalTreatments).toBeDefined();
    expect(res.body.totalFaqs).toBeDefined();
  });
});
