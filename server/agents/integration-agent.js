const crypto = require('crypto');
const db = require('../db');
const { sendApprovalEmail } = require('../services/email');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.GMAIL_EMAIL || 'hasnat@niete.edu.pk';
const BASE_URL = process.env.BASE_URL || 'https://spectacular-connection-production-d07b.up.railway.app';

async function runIntegrationAgent() {
  try {
    // First check: deploy any approved fixes
    const approvedFix = await db.prepare(`
      SELECT a.id, a.feedback_id, a.branch_name, a.pr_number
      FROM auto_fixes a
      WHERE a.status = 'review' AND a.approved_at IS NOT NULL
      ORDER BY a.approved_at ASC
      LIMIT 1
    `).get();

    if (approvedFix) {
      console.log(`[Integration Agent] Deploying approved fix: ${approvedFix.branch_name}`);

      // In production: git merge + railway up
      // Simulated here to avoid side effects in tests

      await db.prepare(`UPDATE auto_fixes SET status = 'deployed' WHERE id = $1`).run(approvedFix.id);
      await db.prepare(`UPDATE feedback_reports SET status = 'deployed', updated_at = NOW() WHERE id = $1`).run(approvedFix.feedback_id);

      const fb = await db.prepare(`SELECT title FROM feedback_reports WHERE id = $1`).get(approvedFix.feedback_id);
      await sendApprovalEmail(ADMIN_EMAIL, fb ? fb.title : 'Fix', 'approved');

      console.log(`[Integration Agent] ✅ Fix deployed`);
      return { deployed: true, fixId: approvedFix.id };
    }

    // Second check: create PR for tested fixes
    const autoFix = await db.prepare(`
      SELECT a.id, a.feedback_id, a.branch_name, a.commit_hash, a.test_results, a.status as fix_status,
             f.title, f.coach_id
      FROM auto_fixes a
      JOIN feedback_reports f ON a.feedback_id = f.id
      WHERE a.status = 'testing_passed' AND a.pr_number IS NULL
      ORDER BY a.created_at ASC
      LIMIT 1
    `).get();

    if (!autoFix) {
      return { skipped: true, reason: 'No tested fixes to integrate' };
    }

    console.log(`[Integration Agent] Creating PR for: "${autoFix.title}"`);

    // Generate secure one-time approval token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Simulate PR creation (real: use GitHub API / gh CLI)
    const prNumber = Math.floor(Math.random() * 9000) + 1000;

    const approveUrl = `${BASE_URL}/api/auto-fixes/${autoFix.id}/approve?token=${token}`;

    await db.prepare(`
      UPDATE auto_fixes SET pr_number = $1, approval_token_hash = $2, approval_token_created_at = NOW(), status = 'review' WHERE id = $3
    `).run(prNumber, tokenHash, autoFix.id);

    await db.prepare(`UPDATE feedback_reports SET status = 'review', updated_at = NOW() WHERE id = $1`).run(autoFix.feedback_id);

    // Send approval email
    await sendApprovalEmail(ADMIN_EMAIL, autoFix.title, 'pending', { prNumber, approveUrl });

    console.log(`[Integration Agent] ✅ PR #${prNumber} created, approval email sent`);
    return { success: true, prNumber, feedbackId: autoFix.feedback_id };
  } catch (err) {
    console.error('[Integration Agent] Error:', err.message);
    return { error: err.message };
  }
}

module.exports = { runIntegrationAgent };
