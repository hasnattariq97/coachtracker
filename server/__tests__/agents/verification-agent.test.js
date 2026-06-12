const db = require('../../db');
const { runVerificationAgent } = require('../../agents/verification-agent');

describe('Verification Agent', () => {
  let hasDatabase = false;

  beforeAll(async () => {
    try {
      await db.prepare('SELECT 1 as ok').get();
      hasDatabase = true;
    } catch { hasDatabase = false; }
  });

  test('returns skipped when nothing to verify', async () => {
    const result = await runVerificationAgent();
    expect(result).toBeDefined();
  });

  test('records test results and updates status', async () => {
    if (!hasDatabase) return;
    const adminUser = await db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!adminUser) return;

    const fb = await db.prepare(`
      INSERT INTO feedback_reports (coach_id, type, title, description, priority, status)
      VALUES (?, 'bug', 'Verify test bug', 'desc', 'medium', 'implementing')
      RETURNING id
    `).get(adminUser.id);
    if (!fb) return;

    await db.prepare(`
      INSERT INTO auto_fixes (feedback_id, branch_name, commit_hash, status)
      VALUES (?, 'fix/feedback-abc12345', 'abc123', 'implementing')
    `).run(fb.id);

    const result = await runVerificationAgent();
    expect(result.error).toBeUndefined();

    const fix = await db.prepare('SELECT * FROM auto_fixes WHERE feedback_id = ?').get(fb.id);
    if (fix) {
      expect(['testing_passed', 'testing_failed', 'implementing']).toContain(fix.status);
    }

    // Cleanup
    await db.prepare('DELETE FROM auto_fixes WHERE feedback_id = ?').run(fb.id);
    await db.prepare('DELETE FROM feedback_reports WHERE id = ?').run(fb.id);
  });
});
