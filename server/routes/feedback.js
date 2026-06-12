const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../auth');

// POST /api/feedback — coaches submit bug reports / feature requests
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { type, title, description, priority } = req.body;

    if (!type || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields: type, title, description' });
    }
    if (!['bug', 'feature_request', 'problem'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be bug, feature_request, or problem' });
    }
    const validPriority = priority || 'medium';
    if (!['low', 'medium', 'high', 'critical'].includes(validPriority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'Title too long (max 200 chars)' });
    }
    if (description.length > 5000) {
      return res.status(400).json({ error: 'Description too long (max 5000 chars)' });
    }

    const result = await db.prepare(`
      INSERT INTO feedback_reports (coach_id, type, title, description, priority, status)
      VALUES ($1, $2, $3, $4, $5, 'submitted')
      RETURNING id
    `).get(req.user.id, type, title, description, validPriority);

    res.json({
      success: true,
      feedback_id: result.id,
      message: 'Feedback submitted. Autonomous agents will diagnose and fix within 30 minutes.'
    });
  } catch (err) {
    console.error('[Feedback] Error:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/feedback — coaches see their own submissions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT id, type, title, priority, status, created_at, updated_at
      FROM feedback_reports
      WHERE coach_id = $1
      ORDER BY created_at DESC
    `).all(req.user.id);
    res.json(rows || []);
  } catch (err) {
    console.error('[Feedback] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

module.exports = router;
