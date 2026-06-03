const request = require('supertest');
const express = require('express');
const db = require('../../db');
const { generateToken, authenticateToken } = require('../../auth');
const tasksRouter = require('../../routes/tasks');

const app = express();
app.use(express.json());
app.use('/api/tasks', authenticateToken, tasksRouter);

let adminToken, coachToken;
let coachId, adminId, taskId;

beforeAll(() => {
  db.exec("DELETE FROM tasks; DELETE FROM notifications; DELETE FROM users WHERE email != 'admin@tracker.com';");

  const adminResult = db.prepare(
    "SELECT id, email FROM users WHERE email = 'admin@tracker.com'"
  ).get();
  adminId = adminResult.id;

  const coachResult = db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
  ).run('Coach A', 'coach@test.com', 'hash', 'coach');
  coachId = coachResult.lastInsertRowid;

  adminToken = generateToken({ id: adminId, email: 'admin@tracker.com', role: 'admin' });
  coachToken = generateToken({ id: coachId, email: 'coach@test.com', role: 'coach' });
});

describe('POST /api/tasks', () => {
  test('creates task and notification', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        coach_id: coachId,
        title: 'Q2 Strategy',
        description: 'Plan initiatives',
        priority: 'high',
        due_date: '2026-06-15T18:00:00Z'
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Q2 Strategy');
    expect(res.body.status).toBe('assigned');

    taskId = res.body.id;

    const notif = db.prepare(
      'SELECT * FROM notifications WHERE task_id = ? AND type = ?'
    ).get(taskId, 'assigned');
    expect(notif).toBeDefined();
    expect(notif.message).toContain('new challenge');
  });

  test('requires admin', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        coach_id: coachId,
        title: 'Task',
        priority: 'medium',
        due_date: '2026-06-15'
      });

    expect(res.status).toBe(403);
  });

  test('validates required fields', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        coach_id: coachId,
        title: 'Task'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });
});

describe('GET /api/tasks', () => {
  test('returns all tasks (admin)', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].coach_name).toBeDefined();
    expect(res.body[0].password_hash).toBeUndefined();
  });

  test('filters by coach_id', async () => {
    const res = await request(app)
      .get(`/api/tasks?coach_id=${coachId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.every(t => t.coach_id === coachId)).toBe(true);
  });

  test('filters by status', async () => {
    const res = await request(app)
      .get('/api/tasks?status=assigned')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.every(t => t.status === 'assigned')).toBe(true);
  });

  test('denies coach access', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/tasks/mine', () => {
  test('returns only coach tasks', async () => {
    const res = await request(app)
      .get('/api/tasks/mine')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every(t => t.coach_id === coachId)).toBe(true);
  });
});

describe('GET /api/tasks/:id', () => {
  test('admin can read task', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(taskId);
    expect(res.body.coach_name).toBeDefined();
  });

  test('coach can read own task', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(taskId);
  });

  test('coach cannot read other task', async () => {
    const otherCoachToken = generateToken({ id: 999, email: 'other@test.com', role: 'coach' });
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherCoachToken}`);

    expect(res.status).toBe(403);
  });

  test('returns 404 for missing task', async () => {
    const res = await request(app)
      .get('/api/tasks/99999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tasks/:id', () => {
  test('admin can update task', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Updated Title',
        priority: 'low'
      });

    expect(res.status).toBe(200);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    expect(task.title).toBe('Updated Title');
    expect(task.priority).toBe('low');
  });

  test('requires admin', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/tasks/:id', () => {
  let deleteTaskId;

  beforeEach(() => {
    const result = db.prepare(
      "INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(coachId, 'Delete me', 'medium', '2026-06-20', 'assigned');
    deleteTaskId = result.lastInsertRowid;
  });

  test('admin can delete task', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${deleteTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(deleteTaskId);
    expect(task).toBeUndefined();
  });

  test('requires admin', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${deleteTaskId}`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/tasks/:id/complete', () => {
  let completeTaskId;

  beforeEach(() => {
    const result = db.prepare(
      "INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(coachId, 'Complete me', 'medium', '2026-06-20', 'assigned');
    completeTaskId = result.lastInsertRowid;
  });

  test('coach can complete own task', async () => {
    const res = await request(app)
      .put(`/api/tasks/${completeTaskId}/complete`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.completed_at).toBeDefined();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(completeTaskId);
    expect(task.status).toBe('completed');
    expect(task.completed_at).not.toBeNull();
  });

  test('creates admin notification on complete', async () => {
    await request(app)
      .put(`/api/tasks/${completeTaskId}/complete`)
      .set('Authorization', `Bearer ${coachToken}`);

    const notif = db.prepare(
      'SELECT * FROM notifications WHERE task_id = ? AND type = ?'
    ).get(completeTaskId, 'completed');
    expect(notif).toBeDefined();
    expect(notif.message).toContain('completed');
  });

  test('coach cannot complete other task', async () => {
    const otherCoachToken = generateToken({ id: 999, email: 'other@test.com', role: 'coach' });
    const res = await request(app)
      .put(`/api/tasks/${completeTaskId}/complete`)
      .set('Authorization', `Bearer ${otherCoachToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/tasks/:id/delay-reason', () => {
  let delayTaskId;

  beforeEach(() => {
    const result = db.prepare(
      "INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(coachId, 'Delayed task', 'medium', '2026-06-01', 'overdue');
    delayTaskId = result.lastInsertRowid;
  });

  test('coach can submit delay reason', async () => {
    const res = await request(app)
      .put(`/api/tasks/${delayTaskId}/delay-reason`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ delay_reason: 'Waiting for approval' });

    expect(res.status).toBe(200);
    expect(res.body.delay_reason).toBe('Waiting for approval');

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(delayTaskId);
    expect(task.delay_reason).toBe('Waiting for approval');
  });

  test('creates admin notification on delay reason', async () => {
    await request(app)
      .put(`/api/tasks/${delayTaskId}/delay-reason`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ delay_reason: 'Testing delay' });

    const notif = db.prepare(
      'SELECT * FROM notifications WHERE task_id = ? AND type = ?'
    ).get(delayTaskId, 'delay_submitted');
    expect(notif).toBeDefined();
    expect(notif.message).toContain('delay');
  });

  test('requires delay_reason', async () => {
    const res = await request(app)
      .put(`/api/tasks/${delayTaskId}/delay-reason`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('coach cannot submit for other task', async () => {
    const otherCoachToken = generateToken({ id: 999, email: 'other@test.com', role: 'coach' });
    const res = await request(app)
      .put(`/api/tasks/${delayTaskId}/delay-reason`)
      .set('Authorization', `Bearer ${otherCoachToken}`)
      .send({ delay_reason: 'Hacking' });

    expect(res.status).toBe(403);
  });
});
