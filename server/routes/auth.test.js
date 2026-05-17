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
});
