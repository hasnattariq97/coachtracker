const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

describe('Database Schema and Seeding', () => {
  let db;
  const testDbPath = path.join(__dirname, 'tracker-test.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new Database(testDbPath);
  });

  afterEach(() => {
    if (db) db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Users table', () => {
    test('creates users table with correct schema', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const columns = db.prepare("PRAGMA table_info(users)").all();
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('password_hash');
      expect(columnNames).toContain('role');
      expect(columnNames).toContain('created_at');
    });

    test('enforces email uniqueness', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const hash = bcrypt.hashSync('test123', 10);
      db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
        .run('test@example.com', hash, 'coach');

      expect(() => {
        db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
          .run('test@example.com', hash, 'coach');
      }).toThrow();
    });

    test('enforces role constraint', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const hash = bcrypt.hashSync('test123', 10);

      expect(() => {
        db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
          .run('test@example.com', hash, 'invalid_role');
      }).toThrow();
    });
  });

  describe('Tasks table', () => {
    test('creates tasks table with correct schema', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          coach_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          due_date DATETIME NOT NULL,
          completed_at DATETIME,
          delay_reason TEXT,
          FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      const columns = db.prepare("PRAGMA table_info(tasks)").all();
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('coach_id');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('assigned_at');
      expect(columnNames).toContain('due_date');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('delay_reason');
    });

    test('enforces foreign key constraint with cascade delete', () => {
      db.pragma('foreign_keys = ON');

      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          coach_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          due_date DATETIME NOT NULL,
          completed_at DATETIME,
          delay_reason TEXT,
          FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      const hash = bcrypt.hashSync('coach123', 10);
      const insertCoach = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)');
      const result = insertCoach.run('coach@example.com', hash, 'coach');
      const coachId = result.lastInsertRowid;

      const insertTask = db.prepare(`
        INSERT INTO tasks (coach_id, title, status, priority, due_date)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertTask.run(coachId, 'Test Task', 'assigned', 'medium', '2026-05-25T18:00:00Z');

      const tasksBefore = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(tasksBefore.count).toBe(1);

      db.prepare('DELETE FROM users WHERE id = ?').run(coachId);

      const tasksAfter = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
      expect(tasksAfter.count).toBe(0);
    });
  });

  describe('Notifications table', () => {
    test('creates notifications table with correct schema', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          coach_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          due_date DATETIME NOT NULL,
          completed_at DATETIME,
          delay_reason TEXT,
          FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          task_id INTEGER,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `);

      const columns = db.prepare("PRAGMA table_info(notifications)").all();
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('task_id');
      expect(columnNames).toContain('type');
      expect(columnNames).toContain('message');
      expect(columnNames).toContain('read');
      expect(columnNames).toContain('created_at');
    });
  });

  describe('Admin seeding', () => {
    test('creates admin user with correct credentials on first run', () => {
      db.pragma('foreign_keys = ON');

      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@tracker.com');
      expect(adminExists).toBeUndefined();

      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
        .run('admin@tracker.com', hashedPassword, 'admin');

      const admin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@tracker.com');
      expect(admin).toBeDefined();
      expect(admin.email).toBe('admin@tracker.com');
      expect(admin.role).toBe('admin');
      expect(bcrypt.compareSync('admin123', admin.password_hash)).toBe(true);
    });

    test('does not seed admin user if already exists', () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const hash = bcrypt.hashSync('admin123', 10);
      db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
        .run('admin@tracker.com', hash, 'admin');

      const countBefore = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get('admin@tracker.com');
      expect(countBefore.count).toBe(1);

      const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@tracker.com');
      if (!adminExists) {
        db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
          .run('admin@tracker.com', bcrypt.hashSync('admin123', 10), 'admin');
      }

      const countAfter = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get('admin@tracker.com');
      expect(countAfter.count).toBe(1);
    });
  });
});
