process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';

jest.mock('../../db', () => ({
  prepare: jest.fn(),
  query: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

const db = require('../../db');
const { authenticateToken, requireSuperAdmin } = require('../../auth');
const adminsRouter = require('../../routes/admins');

const app = express();
app.use(express.json());
app.use('/api/admins', authenticateToken, requireSuperAdmin, adminsRouter);

const superAdminToken = jwt.sign({ id: 1, role: 'super_admin', region_id: null }, JWT_SECRET);
const adminToken      = jwt.sign({ id: 2, role: 'admin',       region_id: 1    }, JWT_SECRET);

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/admins', () => {
  test('returns list of admins for super_admin', async () => {
    db.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([
        { id: 2, name: 'Hasnat Tariq', email: 'hasnat@niete.edu.pk', region_name: 'Urban-I' },
      ]),
    });
    const res = await request(app)
      .get('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].region_name).toBe('Urban-I');
  });

  test('blocks admin role with 403', async () => {
    const res = await request(app)
      .get('/api/admins')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admins', () => {
  test('creates admin with valid input', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ run: jest.fn().mockResolvedValue({ rows: [{ id: 5 }] }) })
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue({ id: 5, name: 'Sara Fatima', email: 'sara@test.com', region_name: 'Nilore' }) });

    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Sara Fatima', email: 'sara@test.com', password: 'sara1234', region_id: 3 });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('sara@test.com');
  });

  test('returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Sara' });
    expect(res.status).toBe(400);
  });

  test('returns 409 when email already exists', async () => {
    db.prepare.mockReturnValue({ get: jest.fn().mockResolvedValue({ id: 99 }) });
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Sara Fatima', email: 'sara@test.com', password: 'sara1234', region_id: 3 });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/admins/:id', () => {
  test('updates admin name', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue({ id: 2 }) })
      .mockReturnValueOnce({ run: jest.fn().mockResolvedValue({}) });
    const res = await request(app)
      .put('/api/admins/2')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(2);
  });

  test('returns 404 for unknown admin', async () => {
    db.prepare.mockReturnValue({ get: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .put('/api/admins/999')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admins/:id', () => {
  test('deletes admin', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue({ id: 2, email: 'hashir@test.com' }) })
      .mockReturnValueOnce({ run: jest.fn().mockResolvedValue({}) });
    const res = await request(app)
      .delete('/api/admins/2')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for unknown admin', async () => {
    db.prepare.mockReturnValue({ get: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .delete('/api/admins/999')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(404);
  });
});
