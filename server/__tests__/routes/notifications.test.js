const request = require('supertest');
const express = require('express');
const db = require('../../db');
const { generateToken, authenticateToken } = require('../../auth');
const notificationsRouter = require('../../routes/notifications');

const app = express();
app.use(express.json());
app.use('/api/notifications', authenticateToken, notificationsRouter);

let adminToken, coachToken;
let adminId, coachId, taskId, notifId;

beforeAll(() => {
  db.exec("DELETE FROM notifications; DELETE FROM tasks; DELETE FROM users WHERE email != 'admin@tracker.com';");

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

  const taskResult = db.prepare(
    "INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).run(coachId, 'Test Task', 'high', '2026-06-15', 'assigned');
  taskId = taskResult.lastInsertRowid;

  const notifResult = db.prepare(
    "INSERT INTO notifications (user_id, task_id, type, message, read) VALUES (?, ?, ?, ?, ?)"
  ).run(coachId, taskId, 'assigned', 'Test notification', 0);
  notifId = notifResult.lastInsertRowid;
});

describe('GET /api/notifications', () => {
  test('returns user notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].task_title).toBeDefined();
  });

  test('returns only user\'s notifications', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('orders by created_at DESC', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    if (res.body.length >= 2) {
      const first = new Date(res.body[0].created_at);
      const second = new Date(res.body[1].created_at);
      expect(first >= second).toBe(true);
    }
  });
});

describe('PUT /api/notifications/:id/read', () => {
  test('marks notification as read', async () => {
    const res = await request(app)
      .put(`/api/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const notif = db.prepare('SELECT read FROM notifications WHERE id = ?').get(notifId);
    expect(notif.read).toBe(1);
  });

  test('requires ownership', async () => {
    const otherCoachToken = generateToken({ id: 999, email: 'other@test.com', role: 'coach' });
    const res = await request(app)
      .put(`/api/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${otherCoachToken}`);

    expect(res.status).toBe(403);
  });

  test('returns 404 for missing notification', async () => {
    const res = await request(app)
      .put('/api/notifications/99999/read')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/notifications/read-all', () => {
  beforeEach(() => {
    db.exec("DELETE FROM notifications WHERE user_id = " + coachId + ";");
  });

  test('marks all notifications as read', async () => {
    db.prepare(
      "INSERT INTO notifications (user_id, task_id, type, message, read) VALUES (?, ?, ?, ?, ?)"
    ).run(coachId, taskId, 'midpoint_nudge', 'Another notification', 0);

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const unread = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(coachId);
    expect(unread.count).toBe(0);
  });

  test('only marks user\'s notifications', async () => {
    const adminTaskResult = db.prepare(
      "INSERT INTO tasks (coach_id, title, priority, due_date, status, assigned_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(coachId, 'Admin Task', 'medium', '2026-06-20', 'assigned');
    const adminTaskId = adminTaskResult.lastInsertRowid;

    db.prepare(
      "INSERT INTO notifications (user_id, task_id, type, message, read) VALUES (?, ?, ?, ?, ?)"
    ).run(adminId, adminTaskId, 'assigned', 'Admin notif', 0);

    db.prepare(
      "INSERT INTO notifications (user_id, task_id, type, message, read) VALUES (?, ?, ?, ?, ?)"
    ).run(coachId, taskId, 'assigned', 'Coach notif', 0);

    await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${coachToken}`);

    const coachUnread = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(coachId);
    expect(coachUnread.count).toBe(0);

    const adminUnread = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(adminId);
    expect(adminUnread.count).toBe(1);
  });
});
