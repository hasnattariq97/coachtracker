// server/routes/auto-fixes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../auth');

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/auto-fixes/:id/test-results
// Called by GitHub Actions after running npm test on the fix branch.
// Body: { passed: number, failed: number, skipped: number, workflow_run_id: string }
// Secured by WORKFLOW_CALLBACK_SECRET env var (shared secret in GH Actions + Railway).
router.post('/:id/test-results', async (req, res) => {
  try {
    const { id } = req.params;
    const secret = process.env.WORKFLOW_CALLBACK_SECRET;
    const providedSecret = req.headers['x-callback-secret'];

    // Require secret if configured; skip check only in test env
    if (secret && process.env.NODE_ENV !== 'test') {
      if (!providedSecret || providedSecret !== secret) {
        return res.status(401).json({ error: 'Invalid callback secret' });
      }
    }

    const { passed, failed, skipped, workflow_run_id } = req.body;

    if (typeof passed !== 'number' || typeof failed !== 'number') {
      return res.status(400).json({ error: 'passed and failed must be numbers' });
    }

    const autoFix = await db.query('SELECT * FROM auto_fixes WHERE id = $1', [id]);
    const fix = autoFix.rows[0];
    if (!fix) return res.status(404).json({ error: 'Fix not found' });

    const testResults = {
      passed,
      failed,
      skipped: skipped || 0,
      workflow_run_id: workflow_run_id || null,
      simulated: false,
      timestamp: new Date().toISOString(),
    };

    const newStatus = failed === 0 ? 'testing_passed' : 'testing_failed';

    await db.query(
      `UPDATE auto_fixes SET status = $1, test_results = $2 WHERE id = $3`,
      [newStatus, JSON.stringify(testResults), id]
    );

    await db.query(
      `UPDATE feedback_reports SET status = 'testing', updated_at = NOW() WHERE id = $1`,
      [fix.feedback_id]
    );

    console.log(`[Auto-Fixes] Test results received: ${passed} passed, ${failed} failed → ${newStatus}`);
    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('[Auto-Fixes] Test results error:', err);
    res.status(500).json({ error: 'Failed to record test results' });
  }
});

// POST /api/auto-fixes/:id/approve?token=<token>
// One-click approval link from email — token-based auth, no JWT needed
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Approval token required' });
    }

    const autoFix = await db.query('SELECT * FROM auto_fixes WHERE id = $1', [id]);
    const fix = autoFix.rows[0];
    if (!fix) {
      return res.status(404).json({ error: 'Fix not found' });
    }

    if (fix.status !== 'review') {
      return res.status(409).json({ error: `Fix is in '${fix.status}' status, not 'review'` });
    }

    if (!fix.approval_token_hash) {
      return res.status(400).json({ error: 'No pending approval token' });
    }

    if (!fix.approval_token_created_at ||
        Date.now() - new Date(fix.approval_token_created_at).getTime() > TOKEN_EXPIRY_MS) {
      return res.status(401).json({ error: 'Approval token has expired' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const storedHash = fix.approval_token_hash;
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

    await db.query(
      `UPDATE auto_fixes SET approved_at = NOW(), approval_token_hash = NULL WHERE id = $1`,
      [id]
    );

    await db.query(
      `UPDATE feedback_reports SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [fix.feedback_id]
    );

    res.json({ success: true, message: 'Fix approved. Will deploy in the next agent cycle (within 5 minutes).' });
  } catch (err) {
    console.error('[Auto-Fixes] Approval error:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// GET /api/auto-fixes/escalated — admin only
router.get('/escalated', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.id, f.title, f.type, f.priority, f.created_at, f.updated_at,
             d.root_cause, d.affected_files, d.severity, d.escalation_reason
      FROM feedback_reports f
      LEFT JOIN diagnoses d ON f.id = d.feedback_id
      WHERE f.status = 'escalated'
      ORDER BY f.updated_at DESC
      LIMIT 50
    `);
    res.json(result.rows || []);
  } catch (err) {
    console.error('[Auto-Fixes] Escalated fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch escalated bugs' });
  }
});

// GET /api/auto-fixes — admin only
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const fixes = await db.query(`
      SELECT a.*, f.title, f.type, f.priority, f.coach_id
      FROM auto_fixes a
      JOIN feedback_reports f ON a.feedback_id = f.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `);
    res.json(fixes.rows || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fixes' });
  }
});

module.exports = router;
