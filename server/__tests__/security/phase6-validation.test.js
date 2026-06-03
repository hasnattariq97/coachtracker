/**
 * Phase 6 Security Audit Tests
 * Tests: Input validation, permission checks, idempotency, edge cases
 */

const request = require('supertest');
const app = require('../../index');
const db = require('../../db');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(user, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });
};

describe('Phase 6 Security Audit: Input Validation', () => {
  let adminToken, coachToken, coachId, taskId, adminId;

  beforeAll(async () => {
    // Seed coach with unique email
    const coachHash = require('bcrypt').hashSync('password', 10);
    db.prepare('DELETE FROM users WHERE email = ?').run('phase6-input-coach@test.com');
    const coachResult = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Coach', 'phase6-input-coach@test.com', coachHash, 'coach');
    coachId = coachResult.lastInsertRowid;

    // Seed admin (should exist)
    const adminResult = db.prepare("SELECT id FROM users WHERE email = 'admin@tracker.com'").get();
    adminId = adminResult.id;

    adminToken = generateToken({ id: adminId, email: 'admin@tracker.com', role: 'admin' });
    coachToken = generateToken({ id: coachId, email: 'coach@test.com', role: 'coach' });
  });

  afterEach(() => {
    // Clean up tasks and notifications between tests
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM tasks').run();
  });

  afterAll(() => {
    // Clean up coaches
    db.prepare('DELETE FROM users WHERE email LIKE ?').run('phase6-input-%@test.com');
  });

  // H1: due_date Validation
  describe('H1: due_date validation', () => {
    test('POST /api/tasks rejects due_date in the past', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coach_id: coachId,
          title: 'Overdue task',
          priority: 'high',
          due_date: yesterday
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('future');
    });

    test('POST /api/tasks rejects invalid due_date format', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coach_id: coachId,
          title: 'Bad date task',
          priority: 'high',
          due_date: 'not-a-date'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    test('PUT /api/tasks/:id rejects past due_date', async () => {
      // Create valid task
      const future = new Date(Date.now() + 604800000).toISOString();
      const task = db.prepare(`
        INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at)
        VALUES (?, ?, ?, ?, 'assigned', datetime('now'))
      `).run(coachId, 'Test', 'high', future);
      taskId = task.lastInsertRowid;

      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ due_date: yesterday });
      expect(res.status).toBe(400);
    });
  });

  // H2: coach_id & status Validation
  describe('H2: coach_id and status validation', () => {
    test('GET /api/tasks rejects non-numeric coach_id', async () => {
      const res = await request(app)
        .get('/api/tasks?coach_id=abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('coach_id');
    });

    test('GET /api/tasks rejects invalid status', async () => {
      const res = await request(app)
        .get('/api/tasks?status=invalid_status')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status');
    });

    test('GET /api/tasks accepts valid statuses', async () => {
      const validStatuses = ['assigned', 'in_progress', 'completed', 'overdue'];
      for (const status of validStatuses) {
        const res = await request(app)
          .get(`/api/tasks?status=${status}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
      }
    });
  });

  // M2: Field Length Validation
  describe('M2: Field length validation', () => {
    test('POST /api/coaches rejects name > 100 chars', async () => {
      const res = await request(app)
        .post('/api/coaches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'x'.repeat(101),
          email: 'coach@test.com',
          password: 'password123'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('1-100');
    });

    test('POST /api/coaches rejects email > 255 chars', async () => {
      const res = await request(app)
        .post('/api/coaches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Coach',
          email: 'a'.repeat(250) + '@test.com',
          password: 'password123'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('255');
    });

    test('POST /api/tasks rejects description > 2000 chars', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          coach_id: coachId,
          title: 'Task with long desc',
          priority: 'high',
          due_date: new Date(Date.now() + 604800000).toISOString(),
          description: 'x'.repeat(2001)
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('2000');
    });

    test('PUT /api/coaches/:id rejects name > 100 chars', async () => {
      const res = await request(app)
        .put(`/api/coaches/${coachId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'x'.repeat(101) });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('1-100');
    });
  });

  // M1: Email Format Validation
  describe('M1: Email format validation', () => {
    test('POST /api/coaches rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/coaches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Coach',
          email: 'not-an-email',
          password: 'password123'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid email');
    });

    test('PUT /api/coaches/:id rejects invalid email format', async () => {
      const res = await request(app)
        .put(`/api/coaches/${coachId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'invalid@' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid email');
    });
  });

  // M4: Status Guard (no re-completion)
  describe('M4: Status guards', () => {
    test('PUT /api/tasks/:id/complete rejects re-completion', async () => {
      const future = new Date(Date.now() + 604800000).toISOString();
      const task = db.prepare(`
        INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at, completed_at)
        VALUES (?, ?, ?, ?, 'completed', datetime('now'), datetime('now'))
      `).run(coachId, 'Completed', 'high', future);
      taskId = task.lastInsertRowid;

      const res = await request(app)
        .put(`/api/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${coachToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already completed');
    });

    test('PUT /api/tasks/:id/delay-reason rejects on completed task', async () => {
      const future = new Date(Date.now() + 604800000).toISOString();
      const task = db.prepare(`
        INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at, completed_at)
        VALUES (?, ?, ?, ?, 'completed', datetime('now'), datetime('now'))
      `).run(coachId, 'Completed', 'high', future);
      taskId = task.lastInsertRowid;

      const res = await request(app)
        .put(`/api/tasks/${taskId}/delay-reason`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ delay_reason: 'Was stuck' });
      expect(res.status).toBe(409);
    });
  });

  // Delay reason validation
  describe('Delay reason validation', () => {
    test('PUT /api/tasks/:id/delay-reason rejects non-string', async () => {
      const future = new Date(Date.now() + 604800000).toISOString();
      const task = db.prepare(`
        INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at)
        VALUES (?, ?, ?, ?, 'assigned', datetime('now'))
      `).run(coachId, 'Test', 'high', future);
      taskId = task.lastInsertRowid;

      const res = await request(app)
        .put(`/api/tasks/${taskId}/delay-reason`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ delay_reason: { nested: 'object' } });
      expect(res.status).toBe(400);
    });

    test('PUT /api/tasks/:id/delay-reason rejects whitespace-only', async () => {
      const future = new Date(Date.now() + 604800000).toISOString();
      const task = db.prepare(`
        INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at)
        VALUES (?, ?, ?, ?, 'assigned', datetime('now'))
      `).run(coachId, 'Test', 'high', future);
      taskId = task.lastInsertRowid;

      const res = await request(app)
        .put(`/api/tasks/${taskId}/delay-reason`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ delay_reason: '   \n\t' });
      expect(res.status).toBe(400);
    });

    test('PUT /api/tasks/:id/delay-reason accepts valid reason', async () => {
      const future = new Date(Date.now() + 604800000).toISOString();
      const task = db.prepare(`
        INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at)
        VALUES (?, ?, ?, ?, 'assigned', datetime('now'))
      `).run(coachId, 'Test', 'high', future);
      taskId = task.lastInsertRowid;

      const res = await request(app)
        .put(`/api/tasks/${taskId}/delay-reason`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ delay_reason: 'Waiting for approval' });
      expect(res.status).toBe(200);
      expect(res.body.delay_reason).toBe('Waiting for approval');
    });
  });

  // ID parameter validation
  describe('ID parameter validation', () => {
    test('GET /api/tasks/:id rejects non-numeric id', async () => {
      const res = await request(app)
        .get('/api/tasks/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    test('PUT /api/notifications/:id/read rejects non-numeric id', async () => {
      const res = await request(app)
        .put('/api/notifications/abc/read')
        .set('Authorization', `Bearer ${coachToken}`);
      expect(res.status).toBe(400);
    });

    test('DELETE /api/coaches/:id rejects non-numeric id', async () => {
      const res = await request(app)
        .delete('/api/coaches/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  // Type validation
  describe('Type validation', () => {
    test('POST /api/coaches rejects non-string name', async () => {
      const res = await request(app)
        .post('/api/coaches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 123,
          email: 'coach@test.com',
          password: 'password123'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('string');
    });

    test('PUT /api/coaches/:id rejects non-string password', async () => {
      const res = await request(app)
        .put(`/api/coaches/${coachId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 123 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('string');
    });
  });

  // Permission checks
  describe('Permission checks', () => {
    test('GET /api/tasks forbids non-admin coaches', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${coachToken}`);
      expect(res.status).toBe(403);
    });

    test('GET /api/tasks/:id requires auth', async () => {
      const res = await request(app)
        .get('/api/tasks/1')
        .set('Authorization', '');
      expect(res.status).toBe(401);
    });

    test('Coach cannot complete other coach\'s task', async () => {
      const otherCoachHash = require('bcrypt').hashSync('password', 10);
      db.prepare('DELETE FROM users WHERE email = ?').run('phase6-other-coach@test.com');
      const other = db.prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
      ).run('Other Coach', 'phase6-other-coach@test.com', otherCoachHash, 'coach');
      const otherToken = generateToken({ id: other.lastInsertRowid, email: 'phase6-other-coach@test.com', role: 'coach' });

      const future = new Date(Date.now() + 604800000).toISOString();
      const task = db.prepare(`
        INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at)
        VALUES (?, ?, ?, ?, 'assigned', datetime('now'))
      `).run(coachId, 'Test', 'high', future);
      taskId = task.lastInsertRowid;

      const res = await request(app)
        .put(`/api/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);

      db.prepare('DELETE FROM users WHERE email = ?').run('phase6-other-coach@test.com');
    });
  });
});

// Idempotency Tests
describe('Phase 6 Security Audit: Idempotency', () => {
  let adminToken, coachToken, coachId, adminId;

  beforeAll(async () => {
    const coachHash = require('bcrypt').hashSync('password', 10);
    db.prepare('DELETE FROM users WHERE email = ?').run('phase6-idem-coach@test.com');
    const coachResult = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Coach', 'phase6-idem-coach@test.com', coachHash, 'coach');
    coachId = coachResult.lastInsertRowid;

    const adminResult = db.prepare("SELECT id FROM users WHERE email = 'admin@tracker.com'").get();
    adminId = adminResult.id;

    adminToken = generateToken({ id: adminId, email: 'admin@tracker.com', role: 'admin' });
    coachToken = generateToken({ id: coachId, email: 'coach-idem@test.com', role: 'coach' });
  });

  afterEach(() => {
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM tasks').run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM users WHERE email = ?').run('phase6-idem-coach@test.com');
  });

  test('Creating duplicate notifications is idempotent (UNIQUE constraint)', async () => {
    const future = new Date(Date.now() + 604800000).toISOString();
    const task = db.prepare(`
      INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at)
      VALUES (?, ?, ?, ?, 'assigned', datetime('now'))
    `).run(coachId, 'Test', 'high', future);
    const taskId = task.lastInsertRowid;

    // Insert same notification twice
    db.prepare(
      'INSERT OR IGNORE INTO notifications (user_id, task_id, type, message) VALUES (?, ?, ?, ?)'
    ).run(coachId, taskId, 'test_type', 'Message');

    db.prepare(
      'INSERT OR IGNORE INTO notifications (user_id, task_id, type, message) VALUES (?, ?, ?, ?)'
    ).run(coachId, taskId, 'test_type', 'Message');

    const notifs = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE task_id = ? AND type = ?'
    ).get(taskId, 'test_type');

    expect(notifs.count).toBe(1);
  });

  test('POST /api/tasks creates notification only once', async () => {
    const future = new Date(Date.now() + 604800000).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        coach_id: coachId,
        title: 'Task',
        priority: 'high',
        due_date: future
      });

    const taskId = res.body.id;
    const notifs = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE task_id = ? AND type = ?'
    ).get(taskId, 'assigned');

    expect(notifs.count).toBe(1);
  });
});

// Edge Cases
describe('Phase 6 Security Audit: Edge Cases', () => {
  let adminToken, coachToken, coachId, adminId;

  beforeAll(async () => {
    const coachHash = require('bcrypt').hashSync('password', 10);
    db.prepare('DELETE FROM users WHERE email = ?').run('phase6-edge-coach@test.com');
    const coachResult = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run('Coach', 'phase6-edge-coach@test.com', coachHash, 'coach');
    coachId = coachResult.lastInsertRowid;

    const adminResult = db.prepare("SELECT id FROM users WHERE email = 'admin@tracker.com'").get();
    adminId = adminResult.id;

    adminToken = generateToken({ id: adminId, email: 'admin@tracker.com', role: 'admin' });
    coachToken = generateToken({ id: coachId, email: 'coach-edge@test.com', role: 'coach' });
  });

  afterEach(() => {
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM tasks').run();
  });

  afterAll(() => {
    db.prepare('DELETE FROM users WHERE email = ?').run('phase6-edge-coach@test.com');
  });

  test('Coach can complete an overdue task', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const task = db.prepare(`
      INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at)
      VALUES (?, ?, ?, ?, 'overdue', datetime('now'))
    `).run(coachId, 'Overdue Task', 'high', yesterday);
    const taskId = task.lastInsertRowid;

    const res = await request(app)
      .put(`/api/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  test('Task with null description returns correctly', async () => {
    const future = new Date(Date.now() + 604800000).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        coach_id: coachId,
        title: 'No description',
        priority: 'high',
        due_date: future
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBeNull();
  });

  test('Large task ID returns 404 gracefully', async () => {
    const res = await request(app)
      .get('/api/tasks/9999999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('Negative task ID returns 404 (not found)', async () => {
    const res = await request(app)
      .get('/api/tasks/-1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  test('Empty title rejected on POST', async () => {
    const future = new Date(Date.now() + 604800000).toISOString();
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        coach_id: coachId,
        title: '',
        priority: 'high',
        due_date: future
      });

    expect(res.status).toBe(400);
  });

  test('Password strength enforced on coach update', async () => {
    const res = await request(app)
      .put(`/api/coaches/${coachId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('6 characters');
  });
});
