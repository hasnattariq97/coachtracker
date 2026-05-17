---
name: skill-db
description: SQLite schema and query patterns using better-sqlite3
---

# skill-db — SQLite Schema & Query Patterns

## Schema (3 tables)

### users
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'coach')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### tasks
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  coach_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_date DATETIME NOT NULL,
  completed_at DATETIME,
  delay_reason TEXT,
  FOREIGN KEY (coach_id) REFERENCES users(id)
);
```

### notifications
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  task_id INTEGER,
  type TEXT NOT NULL CHECK (type IN ('assigned', 'midpoint_nudge', 'overdue_nudge', 'completed', 'delay_submitted')),
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

## Common Queries

### Get coach with task counts
```javascript
const coach = db.prepare(`
  SELECT u.*, 
    COUNT(CASE WHEN t.status IN ('assigned', 'in_progress') THEN 1 END) as assigned,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN t.status = 'overdue' THEN 1 END) as overdue
  FROM users u
  LEFT JOIN tasks t ON u.id = t.coach_id
  WHERE u.id = ?
  GROUP BY u.id
`).get(coachId);
```

### Get task with coach name
```javascript
const task = db.prepare(`
  SELECT t.*, u.name as coach_name
  FROM tasks t
  JOIN users u ON t.coach_id = u.id
  WHERE t.id = ?
`).get(taskId);
```

### Tasks for a coach
```javascript
const tasks = db.prepare(`
  SELECT *, 
    CAST((julianday(due_date) - julianday('now')) AS INTEGER) as days_left
  FROM tasks
  WHERE coach_id = ?
  ORDER BY due_date ASC
`).all(coachId);
```

### Find midpoint-nudge candidates
```javascript
const candidates = db.prepare(`
  SELECT t.id, t.coach_id, t.assigned_at, t.due_date
  FROM tasks t
  WHERE t.status != 'completed'
    AND datetime(t.assigned_at, '+' || 
      CAST((julianday(t.due_date) - julianday(t.assigned_at)) / 2 AS INTEGER) || ' seconds'
    ) <= datetime('now')
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.task_id = t.id AND n.type = 'midpoint_nudge'
    )
`).all();
```

### Find overdue tasks
```javascript
const overdue = db.prepare(`
  SELECT id, coach_id FROM tasks
  WHERE due_date < datetime('now')
    AND status NOT IN ('completed', 'overdue')
`).all();
```

## better-sqlite3 Patterns

### Opening database
```javascript
const Database = require('better-sqlite3');
const db = new Database('tracker.db');
db.pragma('journal_mode = WAL');  // better concurrency
```

### Prepared statements
```javascript
// For repeated queries, prepare once:
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
const user = getUser.get(userId);

// For inserts, return inserted ID:
const insert = db.prepare('INSERT INTO users (name, email, ...) VALUES (?, ?, ...)');
const result = insert.run(name, email, ...);
const newId = result.lastInsertRowid;
```

### Transactions
```javascript
const insertCoach = db.transaction((name, email, hashedPassword) => {
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    name, email, hashedPassword, 'coach'
  );
});
insertCoach(name, email, hash);
```

### Idempotent checks
```javascript
// Before inserting notification, check if same type already exists for task
const existing = db.prepare(
  'SELECT 1 FROM notifications WHERE task_id = ? AND type = ? LIMIT 1'
).get(taskId, type);

if (!existing) {
  db.prepare(`
    INSERT INTO notifications (user_id, task_id, type, message, read)
    VALUES (?, ?, ?, ?, 0)
  `).run(userId, taskId, type, message);
}
```

## Seed on First Run
```javascript
function initDB() {
  // Create tables (all CREATE TABLE IF NOT EXISTS)
  // ...
  
  // Seed admin if none exists
  const adminExists = db.prepare('SELECT 1 FROM users WHERE role = ? LIMIT 1').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Admin', 'admin@tracker.com', ?, 'admin')
    `).run(hash);
  }
}
```

## Gitignore
- tracker.db
- tracker.db-shm
- tracker.db-wal
