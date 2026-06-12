const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../auth');

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/auto-fixes/:id/approve?token=<token>
// One-click approval link from email — token-based auth, no JWT needed
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Approval token required' });
    }

    const autoFix = await db.prepare('SELECT * FROM auto_fixes WHERE id = $1').get(id);
    if (!autoFix) {
      return res.status(404).json({ error: 'Fix not found' });
    }

    if (autoFix.status !== 'review') {
      return res.status(409).json({ error: `Fix is in '${autoFix.status}' status, not 'review'` });
    }

    if (!autoFix.approval_token_hash) {
      return res.status(400).json({ error: 'No pending approval token' });
    }

    // Check token age (7-day expiry) — treat missing timestamp as expired
    if (!autoFix.approval_token_created_at ||
        Date.now() - new Date(autoFix.approval_token_created_at).getTime() > TOKEN_EXPIRY_MS) {
      return res.status(401).json({ error: 'Approval token has expired' });
    }

    // Verify token (constant-time comparison to prevent timing attacks)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const storedHash = autoFix.approval_token_hash;
    if (tokenHash.length !== storedHash.length) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const valid = crypto.timingSafeEqual(
      Buffer.from(tokenHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );

    if (!valid) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Mark approved and invalidate token
    await db.prepare(`
      UPDATE auto_fixes SET approved_at = NOW(), approval_token_hash = NULL WHERE id = $1
    `).run(id);

    await db.prepare(`UPDATE feedback_reports SET status = 'approved', updated_at = NOW() WHERE id = $1`)
      .run(autoFix.feedback_id);

    res.json({ success: true, message: 'Fix approved. Will deploy in the next agent cycle (within 5 minutes).' });
  } catch (err) {
    console.error('[Auto-Fixes] Approval error:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// GET /api/auto-fixes — admin only
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const fixes = await db.prepare(`
      SELECT a.*, f.title, f.type, f.priority, f.coach_id
      FROM auto_fixes a
      JOIN feedback_reports f ON a.feedback_id = f.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `).all();
    res.json(fixes || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fixes' });
  }
});

module.exports = router;
