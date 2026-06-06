/**
 * @phase 5
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-03T00:00:00Z
 * @beads []
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const notifs = await db.prepare(`
      SELECT n.*, t.title as task_title
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
    `).all(req.user.id);
    res.json(notifs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/read', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  try {
    const notif = await db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(id);

    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notif.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
