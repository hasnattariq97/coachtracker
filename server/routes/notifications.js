/**
 * @phase 5
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-06T00:00:00Z
 * @beads []
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const notifs = await db.queryAll(`
      SELECT n.*, t.title as task_title
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
    `, [req.user.id]);
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
    const notif = await db.queryOne('SELECT user_id FROM notifications WHERE id = $1', [id]);

    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notif.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.run('UPDATE notifications SET read = 1 WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = $1 AND read = 0', [req.user.id]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
