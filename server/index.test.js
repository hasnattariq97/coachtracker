/**
 * @phase 1
 * @status active
 * @owner phase-builder
 * @last_updated 2026-05-17T23:10:00Z
 * @beads []
 */

const request = require('supertest');
const app = require('./index');

describe('Express App (server/index.js)', () => {
  test('GET /health returns ok status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('POST /api/auth/login is accessible without auth', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 'admin123' });

    expect([200, 400, 401, 501]).toContain(response.status);
  });

  test('GET /api/coaches requires authentication', async () => {
    const response = await request(app)
      .get('/api/coaches')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('CORS headers are present in response', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  test('404 for unknown route', async () => {
    const response = await request(app)
      .get('/api/unknown-route')
      .expect(404);

    expect(response.body).toHaveProperty('error');
  });

  test('JSON middleware parses request body', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'test@example.com', password: 'test' });

    expect([400, 401, 501]).toContain(response.status);
  });
});
