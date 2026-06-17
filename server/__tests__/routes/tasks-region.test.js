process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';

jest.mock('../../db', () => ({ prepare: jest.fn(), query: jest.fn() }));

const db = require('../../db');
const { authenticateToken } = require('../../auth');
const tasksRouter = require('../../routes/tasks');

const app = express();
app.use(express.json());
app.use('/api/tasks', authenticateToken, tasksRouter);

const adminToken = jwt.sign({ id: 1, role: 'admin', region_id: 3 }, JWT_SECRET);

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/tasks with region scoping', () => {
  test('admin GET /api/tasks SQL includes region_id filter', async () => {
    db.prepare.mockReturnValue({ all: jest.fn().mockResolvedValue([]) });

    await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    const sqlArg = db.prepare.mock.calls[0][0];
    expect(sqlArg).toMatch(/region_id/);
  });
});
