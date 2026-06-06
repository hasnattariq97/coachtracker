const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateEmail = (email) => EMAIL_REGEX.test(email);

// GET /api/coaches — list all coaches with task counts
router.get('/', async (req, res) => {
  console.log('[GET /coaches] Route called');
  try {
    const coaches = await db.queryAll(`
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
    `);
    res.json(coaches);
  } catch (err) {
    console.error('GET /api/coaches error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/coaches — create coach
router.post('/', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Name, email and password must be strings' });
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.toLowerCase().trim();

  if (trimmedName.length === 0 || trimmedName.length > 100) {
    return res.status(400).json({ error: 'Name must be 1-100 characters' });
  }

  if (trimmedEmail.length === 0 || trimmedEmail.length > 255) {
    return res.status(400).json({ error: 'Email must be 1-255 characters' });
  }

  if (!validateEmail(trimmedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [trimmedName, trimmedEmail, hash, 'coach']
    );

    const newId = result.rows[0]?.id;
    res.json({ id: newId, name: trimmedName, email: trimmedEmail, role: 'coach' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/coaches/:id — update name/email/password
router.put('/:id', async (req, res) => {
  const { name, email, password } = req.body;
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid coach id' });
  }

  try {
    const coach = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [id, 'coach']);
    if (!coach) return res.status(404).json({ error: 'Coach not found' });

    if (name !== undefined) {
      if (typeof name !== 'string') {
        return res.status(400).json({ error: 'Name must be a string' });
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        return res.status(400).json({ error: 'Name must be 1-100 characters' });
      }
      await db.run('UPDATE users SET name = $1 WHERE id = $2', [trimmedName, id]);
    }

    if (email !== undefined) {
      if (typeof email !== 'string') {
        return res.status(400).json({ error: 'Email must be a string' });
      }
      const trimmedEmail = email.toLowerCase().trim();
      if (trimmedEmail.length === 0 || trimmedEmail.length > 255) {
        return res.status(400).json({ error: 'Email must be 1-255 characters' });
      }
      if (!validateEmail(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const conflict = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [trimmedEmail, id]);
      if (conflict) return res.status(409).json({ error: 'Email already in use' });
      await db.run('UPDATE users SET email = $1 WHERE id = $2', [trimmedEmail, id]);
    }

    if (password !== undefined) {
      if (typeof password !== 'string') {
        return res.status(400).json({ error: 'Password must be a string' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hash = await bcrypt.hash(password, 10);
      await db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    }

    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/coaches/:id
router.delete('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid coach id' });
  }

  try {
    const coach = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [id, 'coach']);
    if (!coach) return res.status(404).json({ error: 'Coach not found' });

    await db.run('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
