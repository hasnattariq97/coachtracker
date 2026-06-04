const db = require('./db');

console.log('Testing database...');

try {
  const coaches = db.prepare(`
    SELECT
      u.id, u.name, u.email, u.role,
      COUNT(CASE WHEN t.status IN ('assigned','in_progress') THEN 1 END) AS assigned,
      COUNT(CASE WHEN t.status = 'completed' THEN 1 END)                 AS completed,
      COUNT(CASE WHEN t.status = 'overdue'   THEN 1 END)                 AS overdue
    FROM users u
    LEFT JOIN tasks t ON t.coach_id = u.id
    WHERE u.role = 'coach'
    GROUP BY u.id
    ORDER BY u.name
  `).all();

  console.log('✓ Query successful');
  console.log('Coaches:', JSON.stringify(coaches, null, 2));
} catch (err) {
  console.error('✗ Query failed:', err.message);
  console.error('Stack:', err.stack);
}
