// server/agents/verification-agent.js
/**
 * @phase 10
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-12T00:00:00Z
 */

const db = require('../db');
const { GitHubApiService } = require('../services/github-api');

const WORKFLOW_FILE = 'auto-fix.yml';

async function runVerificationAgent() {
  try {
    // Find the oldest auto_fix ready to verify:
    // - 'implementing' with no results (new), OR
    // - 'testing_pending' with no results for >15 min (workflow failed/never ran — re-dispatch)
    const fixResult = await db.query(`
      SELECT a.id, a.feedback_id, a.branch_name
      FROM auto_fixes a
      WHERE a.test_results IS NULL
        AND (
          a.status = 'implementing'
          OR (a.status = 'testing_pending' AND a.created_at < NOW() - INTERVAL '15 minutes')
        )
      ORDER BY a.created_at ASC
      LIMIT 1
    `);
    const autoFix = fixResult.rows[0];

    if (!autoFix) {
      return { skipped: true, reason: 'No implementations to verify' };
    }

    console.log(`[Verification Agent] Dispatching tests for: ${autoFix.branch_name}`);

    // Mark as testing_pending so we don't re-dispatch on next cycle
    await db.query(
      `UPDATE auto_fixes SET status = 'testing_pending' WHERE id = $1`,
      [autoFix.id]
    );
    await db.query(
      `UPDATE feedback_reports SET status = 'testing', updated_at = NOW() WHERE id = $1`,
      [autoFix.feedback_id]
    );

    // Dispatch GitHub Actions workflow with feedback_id + branch_name
    const github = new GitHubApiService();
    await github.dispatchWorkflow(WORKFLOW_FILE, 'main', {
      auto_fix_id: String(autoFix.id),
      branch_name: autoFix.branch_name,
    });

    console.log(`[Verification Agent] ✅ Dispatched ${WORKFLOW_FILE} for branch ${autoFix.branch_name}`);
    return { dispatched: true, branch: autoFix.branch_name, feedbackId: autoFix.feedback_id };

    // Note: test results arrive asynchronously via POST /api/auto-fixes/:id/test-results
    // The Integration Agent reads status='testing_passed' or 'testing_failed'
  } catch (err) {
    console.error('[Verification Agent] Error:', err.message);
    return { error: err.message };
  }
}

// Called by GitHub Actions workflow after tests complete
// Returns current auto_fix for the given feedbackId
async function getAutoFixForFeedback(feedbackId) {
  const result = await db.query(
    `SELECT * FROM auto_fixes WHERE feedback_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [feedbackId]
  );
  return result.rows[0] || null;
}

module.exports = { runVerificationAgent, getAutoFixForFeedback };
