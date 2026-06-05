const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'tracker.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
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

// Seed admin user (only if not exists)
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@tracker.com');
if (!adminExists) {
  let seedPassword = process.env.ADMIN_SEED_PASSWORD;

  // Validate seed password
  if (!seedPassword) {
    const defaultPassword = 'admin123';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ADMIN_SEED_PASSWORD environment variable is required in production. ' +
        'Set a strong password before first startup.'
      );
    }
    console.warn(
      '⚠️  Using default seed password "admin123" for admin@tracker.com. ' +
      'Set ADMIN_SEED_PASSWORD environment variable to use a custom password.'
    );
    seedPassword = defaultPassword;
  }

  if (seedPassword === 'admin123' && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SEED_PASSWORD cannot be "admin123" in production');
  }

  const hashedPassword = bcrypt.hashSync(seedPassword, 12);
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
    .run('admin@tracker.com', hashedPassword, 'admin');

  const passwordDisplay = seedPassword === 'admin123' ? 'admin123 (dev)' : '[custom password set via env]';
  console.log(`✓ Seeded admin user: admin@tracker.com / ${passwordDisplay}`);
}

// Add name column if missing (safe migration)
const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!cols.includes('name')) {
  db.exec("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''");
}

// Add UNIQUE constraint to notifications for atomic idempotency (Phase 6)
// Check if constraint exists by trying to violate it
try {
  const constraintExists = db.prepare(`
    SELECT 1 FROM sqlite_master
    WHERE type='index' AND name='unique_notification_dedup'
  `).get();

  if (!constraintExists) {
    db.exec(`
      CREATE UNIQUE INDEX unique_notification_dedup
      ON notifications(user_id, task_id, type)
      WHERE task_id IS NOT NULL;
    `);
    console.log('✓ Added UNIQUE index for notification idempotency');
  }
} catch (err) {
  // Index might already exist; safe to ignore
  console.log('ℹ️  Notification idempotency index already exists');
}

// Coaching insights columns (Phase 7)
try {
  db.exec(`ALTER TABLE notifications ADD COLUMN metadata TEXT;`);
  console.log('✓ Added metadata column to notifications');
} catch (e) {
  if (!e.message.includes('duplicate column')) throw e;
}

try {
  db.exec(`ALTER TABLE notifications ADD COLUMN insights_status TEXT DEFAULT pending;`);
  console.log('✓ Added insights_status column to notifications');
} catch (e) {
  if (!e.message.includes('duplicate column')) throw e;
}

try {
  db.exec(`ALTER TABLE notifications ADD COLUMN task_title TEXT;`);
  console.log('✓ Added task_title column to notifications');
} catch (e) {
  if (!e.message.includes('duplicate column')) throw e;
}

module.exports = db;
