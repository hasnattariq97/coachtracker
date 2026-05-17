/**
 * @phase 1
 * @status active
 * @owner phase-builder
 * @last_updated 2026-05-17T23:15:00Z
 * @beads ["login_endpoint_red_phase"]
 */

const request = require('supertest');
const app = require('../index');
const db = require('../db');

describe('POST /api/auth/login', () => {

  // Test 1: Successful login with correct credentials returns JWT token
  test('POST /api/auth/login with valid credentials returns JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    // Token should be JWT (3 parts separated by dots)
    expect(res.body.token.split('.').length).toBe(3);
  });

  // Test 2: Invalid password returns 401
  test('POST /api/auth/login with invalid password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  // Test 3: Non-existent email returns 401
  test('POST /api/auth/login with non-existent email returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  // Test 4: Missing email returns 400
  test('POST /api/auth/login without email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Test 5: Missing password returns 400
  test('POST /api/auth/login without password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Test 6: Response should NOT contain password_hash
  test('POST /api/auth/login response never returns password_hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('password_hash');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  // Test 7: Token is valid JWT and decodes to user data
  test('POST /api/auth/login token contains user data (id, email, role)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 'admin123' });

    expect(res.status).toBe(200);

    // Decode JWT (without verification) to check payload
    const token = res.body.token;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));

    expect(payload).toHaveProperty('id');
    expect(payload).toHaveProperty('email', 'admin@tracker.com');
    expect(payload).toHaveProperty('role', 'admin');
  });

  // Test 8: Login with whitespace in email is trimmed
  test('POST /api/auth/login with whitespace in email is trimmed', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  admin@tracker.com  ', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  // Test 9: Login with uppercase email is normalized
  test('POST /api/auth/login with uppercase email is normalized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ADMIN@TRACKER.COM', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  // Test 10: Login with mixed case and whitespace
  test('POST /api/auth/login with mixed case and whitespace', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  AdMiN@TrAcKeR.cOm  ', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  // Test 11: Invalid email format returns 400
  test('POST /api/auth/login with invalid email format returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Invalid email format');
  });

  // Test 12: Email with no domain returns 400
  test('POST /api/auth/login with email missing domain returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@', password: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Test 13: Non-string email returns 400
  test('POST /api/auth/login with non-string email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 123, password: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Email is required');
  });

  // Test 14: Non-string password returns 400
  test('POST /api/auth/login with non-string password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 123 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Password is required');
  });

  // Test 15: Email too long returns 400
  test('POST /api/auth/login with email over 255 chars returns 400', async () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: longEmail, password: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Email is too long');
  });

  // Test 16: Password too long returns 400
  test('POST /api/auth/login with password over 500 chars returns 400', async () => {
    const longPassword = 'p'.repeat(501);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: longPassword });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Password is too long');
  });

  // Test 17: Empty string email returns 400
  test('POST /api/auth/login with empty string email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '', password: 'admin123' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Test 18: Empty string password returns 400
  test('POST /api/auth/login with empty string password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: '' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
