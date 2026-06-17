const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { regionFilter } = require('../auth');
const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateEmail = (email) => EMAIL_REGEX.test(email);

// GET /api/coaches — list all coaches with task counts
router.get('/', async (req, res) => {
  console.log('[GET /coaches] Route called');
  try {
    const regionId = regionFilter(req.user);

    let sql = `
      SELECT
        u.id, u.name, u.email, u.role,
        COUNT(CASE WHEN t.status IN ('assigned','in_progress') THEN 1 END) AS assigned,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END)                 AS completed,
        COUNT(CASE WHEN t.status = 'overdue'   THEN 1 END)                 AS overdue,
        COUNT(t.id)                                                         AS total
      FROM users u
      LEFT JOIN tasks t ON t.coach_id = u.id
      WHERE u.role = 'coach'
    `;
    const params = [];
    if (regionId) {
      sql += ' AND u.region_id = ?';
      params.push(regionId);
    }
    sql += ' GROUP BY u.id ORDER BY u.name';

    const coaches = await db.prepare(sql).all(...params);
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
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const regionId = req.user.region_id;
    const result = await db.prepare(
      'INSERT INTO users (name, email, password_hash, role, region_id) VALUES (?, ?, ?, ?, ?) RETURNING id'
    ).run(trimmedName, trimmedEmail, hash, 'coach', regionId);

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
    const regionId = regionFilter(req.user);
    const coach = regionId
      ? await db.prepare('SELECT id FROM users WHERE id = ? AND role = ? AND region_id = ?').get(id, 'coach', regionId)
      : await db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(id, 'coach');
    if (!coach) return res.status(404).json({ error: 'Coach not found' });

    if (name !== undefined) {
      if (typeof name !== 'string') {
        return res.status(400).json({ error: 'Name must be a string' });
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        return res.status(400).json({ error: 'Name must be 1-100 characters' });
      }
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(trimmedName, id);
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
      const conflict = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(trimmedEmail, id);
      if (conflict) return res.status(409).json({ error: 'Email already in use' });
      await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(trimmedEmail, id);
    }

    if (password !== undefined) {
      if (typeof password !== 'string') {
        return res.status(400).json({ error: 'Password must be a string' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const hash = await bcrypt.hash(password, 10);
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
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
    const regionId = regionFilter(req.user);
    const coach = regionId
      ? await db.prepare('SELECT id FROM users WHERE id = ? AND role = ? AND region_id = ?').get(id, 'coach', regionId)
      : await db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(id, 'coach');
    if (!coach) return res.status(404).json({ error: 'Coach not found' });

    await db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
