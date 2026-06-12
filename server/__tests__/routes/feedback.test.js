const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-minimum-32-characters-requirement';

// Mock the db module before requiring the router
jest.mock('../../db', () => {
  const mockDb = {
    prepare: jest.fn(),
    query: jest.fn(),
  };
  return mockDb;
});

const db = require('../../db');
const feedbackRouter = require('../../routes/feedback');

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRouter);

describe('POST /api/feedback', () => {
  const coachToken = jwt.sign({ id: 1, role: 'coach' }, JWT_SECRET);
  const adminToken = jwt.sign({ id: 99, role: 'admin' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates feedback with valid input', async () => {
    db.prepare.mockReturnValue({
      get: jest.fn().mockResolvedValue({ id: 'uuid-1234' }),
      all: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        type: 'bug',
        title: 'Notification bell disappears',
        description: 'Spinner never ends',
        priority: 'high',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.feedback_id).toBeDefined();
    expect(res.body.message).toMatch(/30 minutes/);
  });

  test('uses default priority of medium when not provided', async () => {
    const mockGet = jest.fn().mockResolvedValue({ id: 'uuid-5678' });
    db.prepare.mockReturnValue({ get: mockGet, all: jest.fn() });

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ type: 'feature_request', title: 'Dark mode', description: 'Please add dark mode' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rejects missing description', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ type: 'bug', title: 'Test bug' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description/);
  });

  test('rejects missing title', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ type: 'bug', description: 'Something is broken' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  test('rejects missing type', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ title: 'Bug', description: 'Something broke' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/);
  });

  test('rejects invalid type', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ type: 'invalid', title: 'Test', description: 'Desc', priority: 'medium' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid type/);
  });

  test('rejects invalid priority', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ type: 'bug', title: 'Test', description: 'Desc', priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/);
  });

  test('rejects title longer than 200 chars', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ type: 'bug', title: 'A'.repeat(201), description: 'Desc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Title too long/);
  });

  test('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({ type: 'bug', title: 'Test', description: 'Desc', priority: 'medium' });

    expect(res.status).toBe(401);
  });

  test('accepts all valid types', async () => {
    const mockGet = jest.fn().mockResolvedValue({ id: 'uuid-abc' });
    db.prepare.mockReturnValue({ get: mockGet, all: jest.fn() });

    for (const type of ['bug', 'feature_request', 'problem']) {
      mockGet.mockResolvedValue({ id: `uuid-${type}` });
      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ type, title: `Test ${type}`, description: 'Description here' });
      expect(res.status).toBe(200);
    }
  });

  test('returns 500 on database error', async () => {
    db.prepare.mockReturnValue({
      get: jest.fn().mockRejectedValue(new Error('DB connection failed')),
    });

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ type: 'bug', title: 'Test', description: 'Desc' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to submit feedback/);
  });
});

describe('GET /api/feedback', () => {
  const coachToken = jwt.sign({ id: 2, role: 'coach' }, JWT_SECRET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns coach submissions', async () => {
    db.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([
        { id: 'uuid-1', type: 'bug', title: 'Bug report', priority: 'high', status: 'submitted', created_at: new Date(), updated_at: new Date() },
      ]),
    });

    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].type).toBe('bug');
  });

  test('returns empty array when no submissions', async () => {
    db.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  test('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/feedback');
    expect(res.status).toBe(401);
  });

  test('returns 500 on database error', async () => {
    db.prepare.mockReturnValue({
      all: jest.fn().mockRejectedValue(new Error('DB down')),
    });

    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to fetch feedback/);
  });
});
