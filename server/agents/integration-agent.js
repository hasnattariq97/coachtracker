// server/agents/integration-agent.js
/**
 * @phase 10
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-12T00:00:00Z
 */

const crypto = require('crypto');
const db = require('../db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.GMAIL_EMAIL || 'hasnat@niete.edu.pk';
const BASE_URL = process.env.BASE_URL || 'https://spectacular-connection-production-d07b.up.railway.app';

async function runIntegrationAgent() {
  try {
    // ── 1. Deploy any approved fixes ────────────────────────────────────────
    const approvedResult = await db.query(`
      SELECT a.id, a.feedback_id, a.branch_name, a.pr_number
      FROM auto_fixes a
      WHERE a.status = 'review' AND a.approved_at IS NOT NULL
      ORDER BY a.approved_at ASC
      LIMIT 1
    `);
    const approvedFix = approvedResult.rows[0];

    if (approvedFix) {
      console.log(`[Integration Agent] Merging approved fix: ${approvedFix.branch_name}`);

      try {
        const { GitHubApiService } = require('../services/github-api');
        const github = new GitHubApiService();
        await github.mergeBranch(
          approvedFix.branch_name,
          'main',
          `Auto-fix: merge ${approvedFix.branch_name} (#${approvedFix.pr_number || 'auto'})`
        );

        // Merge succeeded — deploy.yml triggers automatically from the push-to-main event
        await db.query(
          `UPDATE auto_fixes SET status = $1 WHERE id = $2`,
          ['deployed', approvedFix.id]
        );
        await db.query(
          `UPDATE feedback_reports SET status = $1, updated_at = NOW() WHERE id = $2`,
          ['deployed', approvedFix.feedback_id]
        );

        const fbResult = await db.query(
          `SELECT title FROM feedback_reports WHERE id = $1`,
          [approvedFix.feedback_id]
        );
        const title = fbResult.rows[0] ? fbResult.rows[0].title : 'Fix';
        const { sendApprovalEmail } = require('../services/email');
        await sendApprovalEmail(ADMIN_EMAIL, title, 'approved');

        console.log(`[Integration Agent] ✅ Merged and deployed: ${approvedFix.branch_name}`);
        return { deployed: true, fixId: approvedFix.id };
      } catch (mergeErr) {
        console.error('[Integration Agent] Merge failed:', mergeErr.message);
        // Flag as merge_failed so admin can investigate
        await db.query(
          `UPDATE auto_fixes SET status = $1 WHERE id = $2`,
          ['merge_failed', approvedFix.id]
        );
        await db.query(
          `UPDATE feedback_reports SET status = $1, updated_at = NOW() WHERE id = $2`,
          ['failed', approvedFix.feedback_id]
        );
        return { error: `merge_failed: ${mergeErr.message}` };
      }
    }

    // ── 2. Create approval email for testing_passed fixes ────────────────────
    const testedResult = await db.query(`
      SELECT a.id, a.feedback_id, a.branch_name, a.commit_hash, a.test_results,
             a.status as fix_status, f.title, f.coach_id
      FROM auto_fixes a
      JOIN feedback_reports f ON a.feedback_id = f.id
      WHERE a.status = 'testing_passed' AND a.approval_token_hash IS NULL
      ORDER BY a.created_at ASC
      LIMIT 1
    `);
    const autoFix = testedResult.rows[0];

    // ── 2b. Notify admin when tests failed ──────────────────────────────────
    const failedResult = await db.query(`
      SELECT a.id, a.feedback_id, a.branch_name, a.test_results, f.title
      FROM auto_fixes a
      JOIN feedback_reports f ON a.feedback_id = f.id
      WHERE a.status = 'testing_failed' AND a.approval_token_hash IS NULL
      ORDER BY a.created_at ASC
      LIMIT 1
    `);
    const failedFix = failedResult.rows[0];

    if (failedFix) {
      let results = {};
      try {
        results = typeof failedFix.test_results === 'string'
          ? JSON.parse(failedFix.test_results) : (failedFix.test_results || {});
      } catch {}

      await db.query(
        `UPDATE auto_fixes SET approval_token_hash = 'notified' WHERE id = $1`,
        [failedFix.id]
      );

      const { sendEmail } = require('../services/email');
      await sendEmail(
        ADMIN_EMAIL,
        `❌ Auto-fix tests failed: ${failedFix.title}`,
        `<h2>❌ Auto-Fix Tests Failed — Manual Fix Required</h2>
         <p>The autonomous pipeline generated a fix but tests did not pass:</p>
         <table style="border-collapse:collapse;width:100%;margin:16px 0">
           <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;width:140px">Bug</td><td style="padding:8px;border:1px solid #e5e7eb">${failedFix.title}</td></tr>
           <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Branch</td><td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace">${failedFix.branch_name}</td></tr>
           <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Tests</td><td style="padding:8px;border:1px solid #e5e7eb;color:#dc2626">${results.passed || 0} passed, ${results.failed || 0} failed</td></tr>
         </table>
         <p style="color:#6b7280;font-size:13px">Review the branch on <a href="https://github.com/hasnattariq97/coachtracker/tree/${failedFix.branch_name}">GitHub</a> and fix manually, or check the <a href="https://coachtracker-theta.vercel.app/admin/auto-fixes">Auto Fixes page</a>.</p>`
      );

      console.log(`[Integration Agent] ✉️ Testing-failed email sent for: "${failedFix.title}"`);
      return { notified: true, reason: 'testing_failed', fixId: failedFix.id };
    }

    if (!autoFix) {
      return { skipped: true, reason: 'No tested fixes to integrate' };
    }

    console.log(`[Integration Agent] Sending approval email for: "${autoFix.title}"`);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const approveUrl = `${BASE_URL}/api/auto-fixes/${autoFix.id}/approve?token=${token}`;

    // Parse test results for the email
    let testSummary = '';
    try {
      const results = typeof autoFix.test_results === 'string'
        ? JSON.parse(autoFix.test_results) : autoFix.test_results;
      testSummary = `${results.passed} tests passing, ${results.failed} failing`;
    } catch {
      testSummary = 'Tests passed';
    }

    await db.query(
      `UPDATE auto_fixes
       SET approval_token_hash = $1, approval_token_created_at = NOW(), status = 'review'
       WHERE id = $2`,
      [tokenHash, autoFix.id]
    );

    await db.query(
      `UPDATE feedback_reports SET status = 'review', updated_at = NOW() WHERE id = $1`,
      [autoFix.feedback_id]
    );

    const { sendApprovalEmail } = require('../services/email');
    await sendApprovalEmail(ADMIN_EMAIL, autoFix.title, 'pending', {
      approveUrl,
      branchName: autoFix.branch_name,
      testSummary,
    });

    console.log(`[Integration Agent] ✅ Approval email sent (branch: ${autoFix.branch_name})`);
    return { success: true, feedbackId: autoFix.feedback_id, branch: autoFix.branch_name };
  } catch (err) {
    console.error('[Integration Agent] Error:', err.message);
    return { error: err.message };
  }
}

module.exports = { runIntegrationAgent };
