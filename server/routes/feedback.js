const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireSuperAdmin } = require('../auth');

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

    const result = await db.query(
      `INSERT INTO feedback_reports (coach_id, type, title, description, priority, status)
       VALUES ($1, $2, $3, $4, $5, 'submitted')
       RETURNING id`,
      [req.user.id, type, title, description, validPriority]
    );

    res.json({
      success: true,
      feedback_id: result.rows[0].id,
      message: 'Feedback submitted. Autonomous agents will diagnose and fix within 30 minutes.'
    });
  } catch (err) {
    console.error('[Feedback] Error:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/feedback — super_admin sees all reports
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.id, f.coach_id, f.type, f.title, f.priority, f.status,
             f.created_at, f.updated_at,
             u.name AS coach_name,
             d.escalation_reason, d.severity
      FROM feedback_reports f
      LEFT JOIN users u ON f.coach_id = u.id
      LEFT JOIN diagnoses d ON f.id = d.feedback_id
      ORDER BY f.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows || []);
  } catch (err) {
    console.error('[Feedback] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

module.exports = router;
