require('dotenv').config();
const express = require('express');
const db = require('./db');
const { authenticateToken, requireAdmin } = require('./auth');

const app = express();

app.use(express.json());

app.get('/test1', (req, res) => {
  res.json({ test: 'ok' });
});

app.get('/test2', authenticateToken, (req, res) => {
  res.json({ auth: 'ok', user: req.user });
});

app.get('/test3', authenticateToken, requireAdmin, (req, res) => {
  res.json({ admin: 'ok' });
});

app.get('/test4', authenticateToken, requireAdmin, (req, res) => {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
    res.json({ db: 'ok', count: result.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/test5', authenticateToken, requireAdmin, (req, res) => {
  try {
    const coaches = db.prepare(`
      SELECT u.id, u.name, u.email, u.role
      FROM users u
      WHERE u.role = 'coach'
    `).all();
    res.json({ coaches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => {
  console.log('✓ Test API on :3001');
});
