// server/__tests__/routes/auto-fixes-routes.test.js
const request = require('supertest');
const express = require('express');
const db = require('../../db');

// Mock db so no real Postgres needed
jest.mock('../../db', () => ({
  query: jest.fn(),
}));

jest.mock('../../auth', () => ({
  authenticateToken: (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); },
  requireAdmin: (req, res, next) => next(),
}));

const autoFixesRouter = require('../../routes/auto-fixes');
const app = express();
app.use(express.json());
app.use('/api/auto-fixes', autoFixesRouter);

beforeEach(() => jest.clearAllMocks());

describe('POST /api/auto-fixes/:id/test-results', () => {
  test('returns 400 when passed/failed missing', async () => {
    const res = await request(app)
      .post('/api/auto-fixes/1/test-results')
      .send({ skipped: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/passed and failed/);
  });

  test('updates auto_fix status to testing_passed when failed=0', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, feedback_id: 99, status: 'testing_pending' }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }) // UPDATE auto_fixes
      .mockResolvedValueOnce({ rows: [] }); // UPDATE feedback_reports

    const res = await request(app)
      .post('/api/auto-fixes/1/test-results')
      .send({ passed: 157, failed: 0, skipped: 0 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('testing_passed');
    // Verify the UPDATE call used 'testing_passed'
    const updateCall = db.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE auto_fixes SET status/);
    expect(updateCall[1][0]).toBe('testing_passed');
  });

  test('updates auto_fix status to testing_failed when failed>0', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 2, feedback_id: 100, status: 'testing_pending' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auto-fixes/2/test-results')
      .send({ passed: 140, failed: 3, skipped: 0 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('testing_failed');
  });

  test('returns 404 when auto_fix not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auto-fixes/999/test-results')
      .send({ passed: 0, failed: 0 });
    expect(res.status).toBe(404);
  });
});
