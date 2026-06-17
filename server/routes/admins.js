const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', async (req, res) => {
  try {
    const admins = await db.prepare(`
      SELECT u.id, u.name, u.email, u.role, r.name AS region_name
      FROM users u
      LEFT JOIN regions r ON r.id = u.region_id
      WHERE u.role = 'admin'
      ORDER BY u.name
    `).all();
    res.json(admins);
  } catch (err) {
    console.error('GET /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, email, password, region_id } = req.body;

  if (!name || !email || !password || !region_id) {
    return res.status(400).json({ error: 'Name, email, password, and region_id are required' });
  }
  if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const numericRegionId = Number.parseInt(region_id, 10);
  if (!Number.isInteger(numericRegionId) || numericRegionId < 1) {
    return res.status(400).json({ error: 'region_id must be a positive integer' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  try {
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.prepare(
      `INSERT INTO users (name, email, password_hash, role, region_id) VALUES (?, ?, ?, 'admin', ?) RETURNING id`
    ).run(trimmedName, trimmedEmail, hash, numericRegionId);

    const newId = result.rows[0]?.id;
    if (!newId) return res.status(500).json({ error: 'Internal server error' });
    const created = await db.prepare(`
      SELECT u.id, u.name, u.email, u.role, r.name AS region_name
      FROM users u LEFT JOIN regions r ON r.id = u.region_id
      WHERE u.id = ?
    `).get(newId);

    res.json(created);
  } catch (err) {
    console.error('POST /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid admin id' });

  try {
    const admin = await db.prepare(
      "SELECT id FROM users WHERE id = ? AND role = 'admin'"
    ).get(id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const { name, email, password } = req.body;

    if (name !== undefined) {
      const t = name.trim();
      if (!t || t.length > 100) return res.status(400).json({ error: 'Name must be 1-100 characters' });
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(t, id);
    }
    if (email !== undefined) {
      const t = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(t)) return res.status(400).json({ error: 'Invalid email format' });
      const conflict = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(t, id);
      if (conflict) return res.status(409).json({ error: 'Email already in use' });
      await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(t, id);
    }
    if (password !== undefined) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const hash = await bcrypt.hash(password, 12);
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    }

    res.json({ id });
  } catch (err) {
    console.error('PUT /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid admin id' });

  try {
    const admin = await db.prepare(
      "SELECT id, email FROM users WHERE id = ? AND role = 'admin'"
    ).get(id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    await db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/regions/overview', async (req, res) => {
  try {
    const overview = await db.prepare(`
      SELECT
        r.id,
        r.name,
        u_admin.name  AS admin_name,
        u_admin.email AS admin_email,
        COUNT(DISTINCT coaches.id)                                            AS coach_count,
        COUNT(CASE WHEN t.status IN ('assigned','in_progress') THEN 1 END)   AS active_tasks,
        COUNT(CASE WHEN t.status = 'overdue' THEN 1 END)                     AS overdue_tasks
      FROM regions r
      LEFT JOIN users u_admin ON u_admin.region_id = r.id AND u_admin.role = 'admin'
      LEFT JOIN users coaches  ON coaches.region_id = r.id AND coaches.role = 'coach'
      LEFT JOIN tasks t        ON t.coach_id = coaches.id
      GROUP BY r.id, r.name, u_admin.name, u_admin.email
      ORDER BY r.name
    `).all();
    res.json(overview);
  } catch (err) {
    console.error('GET /api/admins/regions/overview error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/regions/:id/coaches', async (req, res) => {
  const regionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(regionId)) return res.status(400).json({ error: 'Invalid region id' });

  try {
    const coaches = await db.prepare(`
      SELECT
        u.id, u.name, u.email,
        COUNT(CASE WHEN t.status IN ('assigned','in_progress') THEN 1 END) AS active_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END)                 AS completed,
        COUNT(CASE WHEN t.status = 'overdue' THEN 1 END)                   AS overdue
      FROM users u
      LEFT JOIN tasks t ON t.coach_id = u.id
      WHERE u.role = 'coach' AND u.region_id = ?
      GROUP BY u.id, u.name, u.email
      ORDER BY u.name
    `).all(regionId);
    res.json(coaches);
  } catch (err) {
    console.error('GET /api/admins/regions/:id/coaches error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/regions/:id/tasks', async (req, res) => {
  const regionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(regionId)) return res.status(400).json({ error: 'Invalid region id' });

  try {
    const tasks = await db.prepare(`
      SELECT t.id, t.title, t.status, t.priority, t.due_date, u.name AS coach_name
      FROM tasks t
      JOIN users u ON u.id = t.coach_id
      WHERE u.region_id = ?
      ORDER BY t.due_date ASC
    `).all(regionId);
    res.json(tasks);
  } catch (err) {
    console.error('GET /api/admins/regions/:id/tasks error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
