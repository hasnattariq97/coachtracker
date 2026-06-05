const db = require('./server/db');
const bcrypt = require('bcrypt');

const email = 'testcoach@example.com';
const password = 'testcoach123';
const hashedPassword = bcrypt.hashSync(password, 12);

// Delete if exists
try {
  db.prepare('DELETE FROM users WHERE email = ?').run(email);
} catch (e) {}

// Create new coach
const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
  'Test Coach',
  email,
  hashedPassword,
  'coach'
);

console.log('\n✓ Created test coach:');
console.log('  Email:', email);
console.log('  Password:', password);
console.log('  ID:', result.lastInsertRowid);
