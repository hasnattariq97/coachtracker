const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

describe('db.js Module Integration', () => {
  let db;
  const dbPath = path.join(__dirname, 'tracker.db');

  beforeAll(() => {
    // Don't delete database; just clear tables
    db = require('./db.js');
    db.exec("DELETE FROM notifications; DELETE FROM tasks; DELETE FROM users WHERE email != 'admin@tracker.com';");
  });

  afterAll(() => {
    if (db) {
      db.exec("DELETE FROM notifications; DELETE FROM tasks; DELETE FROM users WHERE email != 'admin@tracker.com';");
      db.close?.();
    }
  });

  test('db module is a valid database instance', () => {
    expect(db).toBeDefined();
    expect(typeof db.prepare).toBe('function');
    expect(typeof db.exec).toBe('function');
  });

  test('database file is created on first import', () => {
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  test('admin user is automatically seeded', () => {
    const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@tracker.com');

    expect(admin).toBeDefined();
    expect(admin.email).toBe('admin@tracker.com');
    expect(admin.role).toBe('admin');
    expect(admin.password_hash).toBeDefined();
  });

  test('admin password is correctly hashed and verifiable', () => {
    const admin = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('admin@tracker.com');
    const isValid = bcrypt.compareSync('admin123', admin.password_hash);

    expect(isValid).toBe(true);
  });

  test('can insert and retrieve coaches', () => {
    const hash = bcrypt.hashSync('coach123', 10);
    const result = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
      .run('sarah@example.com', hash, 'coach');

    const coach = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    expect(coach.email).toBe('sarah@example.com');
    expect(coach.role).toBe('coach');
  });

  test('can assign tasks to coaches', () => {
    const hash = bcrypt.hashSync('coach123', 10);
    const coachResult = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
      .run('john@example.com', hash, 'coach');
    const coachId = coachResult.lastInsertRowid;

    const taskResult = db.prepare(`
      INSERT INTO tasks (coach_id, title, description, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(coachId, 'Q2 Growth Strategy', 'Plan Q2 initiatives', 'assigned', 'high', '2026-05-25T18:00:00Z');

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskResult.lastInsertRowid);

    expect(task.coach_id).toBe(coachId);
    expect(task.title).toBe('Q2 Growth Strategy');
    expect(task.status).toBe('assigned');
    expect(task.priority).toBe('high');
  });

  test('can create notifications', () => {
    const hash = bcrypt.hashSync('coach123', 10);
    const coachResult = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
      .run('alice@example.com', hash, 'coach');
    const coachId = coachResult.lastInsertRowid;

    const taskResult = db.prepare(`
      INSERT INTO tasks (coach_id, title, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(coachId, 'Test Task', 'assigned', 'medium', '2026-05-25T18:00:00Z');
    const taskId = taskResult.lastInsertRowid;

    const notifResult = db.prepare(`
      INSERT INTO notifications (user_id, task_id, type, message, read)
      VALUES (?, ?, ?, ?, ?)
    `).run(coachId, taskId, 'assigned', 'You have a new task!', 0);

    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifResult.lastInsertRowid);

    expect(notif.user_id).toBe(coachId);
    expect(notif.task_id).toBe(taskId);
    expect(notif.type).toBe('assigned');
    expect(notif.read).toBe(0);
  });

  test('foreign key cascade delete removes orphaned tasks on coach deletion', () => {
    const hash = bcrypt.hashSync('coach123', 10);
    const coachResult = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
      .run('bob@example.com', hash, 'coach');
    const coachId = coachResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO tasks (coach_id, title, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(coachId, 'Task 1', 'assigned', 'low', '2026-05-25T18:00:00Z');

    db.prepare(`
      INSERT INTO tasks (coach_id, title, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(coachId, 'Task 2', 'assigned', 'medium', '2026-05-26T18:00:00Z');

    const tasksBefore = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE coach_id = ?').get(coachId);
    expect(tasksBefore.count).toBe(2);

    db.prepare('DELETE FROM users WHERE id = ?').run(coachId);

    const tasksAfter = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE coach_id = ?').get(coachId);
    expect(tasksAfter.count).toBe(0);
  });

  test('foreign key cascade delete removes orphaned notifications', () => {
    const hash = bcrypt.hashSync('coach123', 10);
    const coachResult = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
      .run('carol@example.com', hash, 'coach');
    const coachId = coachResult.lastInsertRowid;

    const taskResult = db.prepare(`
      INSERT INTO tasks (coach_id, title, status, priority, due_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(coachId, 'Test Task', 'assigned', 'high', '2026-05-25T18:00:00Z');
    const taskId = taskResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO notifications (user_id, task_id, type, message)
      VALUES (?, ?, ?, ?)
    `).run(coachId, taskId, 'assigned', 'You have a new task!');

    const notifsBefore = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(coachId);
    expect(notifsBefore.count).toBeGreaterThan(0);

    db.prepare('DELETE FROM users WHERE id = ?').run(coachId);

    const notifsAfter = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(coachId);
    expect(notifsAfter.count).toBe(0);
  });
});
