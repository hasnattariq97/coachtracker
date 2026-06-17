process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';

jest.mock('../../db', () => ({ prepare: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

const db = require('../../db');
const { authenticateToken, requireAdmin } = require('../../auth');
const coachesRouter = require('../../routes/coaches');

const app = express();
app.use(express.json());
app.use('/api/coaches', authenticateToken, requireAdmin, coachesRouter);

const adminToken = jwt.sign({ id: 1, role: 'admin', region_id: 2 }, JWT_SECRET);

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/coaches with region scoping', () => {
  test('admin GET query includes region_id filter', async () => {
    db.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([]),
    });

    await request(app)
      .get('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`);

    const sqlArg = db.prepare.mock.calls[0][0];
    expect(sqlArg).toMatch(/region_id/);
  });
});

describe('POST /api/coaches with region assignment', () => {
  test('new coach INSERT includes region_id', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ run: jest.fn().mockResolvedValue({ rows: [{ id: 11 }] }) });

    await request(app)
      .post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Coach', email: 'new@test.com', password: 'pass123' });

    const insertCall = db.prepare.mock.calls[1][0];
    expect(insertCall).toMatch(/region_id/);
  });
});
