const db = require('./server/db');

// Get testcoach ID
const coach = db.prepare('SELECT id FROM users WHERE email = ?').get('testcoach@example.com');
console.log('\nTest Coach ID:', coach.id);

// Create a task for this coach
const result = db.prepare(`
  INSERT INTO tasks (coach_id, title, description, priority, due_date, status, assigned_at)
  VALUES (?, ?, ?, ?, ?, 'assigned', datetime('now'))
`).run(
  coach.id,
  'Test Dashboard Task',
  'This task is to verify the coach dashboard displays tasks correctly.',
  'high',
  '2026-06-20T18:00:00Z'
);

console.log('✓ Created task ID:', result.lastInsertRowid);
console.log('\nNow login as testcoach@example.com / testcoach123 to see the task\n');
