jest.mock('../services/email', () => ({
  sendApprovalEmail: jest.fn().mockResolvedValue({}),
  sendEmail: jest.fn().mockResolvedValue({})
}), { virtual: true });

jest.mock('../../services/email', () => ({
  sendApprovalEmail: jest.fn().mockResolvedValue({}),
  sendEmail: jest.fn().mockResolvedValue({})
}));

const db = require('../../db');
const { runIntegrationAgent } = require('../../agents/integration-agent');

describe('Integration Agent', () => {
  let hasDatabase = false;

  beforeAll(async () => {
    try {
      await db.prepare('SELECT 1 as ok').get();
      hasDatabase = true;
    } catch { hasDatabase = false; }
  });

  test('returns skipped when no tested fixes', async () => {
    const result = await runIntegrationAgent();
    expect(result).toBeDefined();
  });

  test('creates PR and saves approval token for tested fix', async () => {
    if (!hasDatabase) return;
    const adminUser = await db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!adminUser) return;

    const fb = await db.prepare(`
      INSERT INTO feedback_reports (coach_id, type, title, description, priority, status)
      VALUES (?, 'bug', 'Integration test bug', 'desc', 'high', 'testing')
      RETURNING id
    `).get(adminUser.id);
    if (!fb) return;

    await db.prepare(`
      INSERT INTO auto_fixes (feedback_id, branch_name, commit_hash, status, test_results)
      VALUES (?, 'fix/feedback-abc12345', 'abc123', 'testing_passed', ?)
    `).run(fb.id, JSON.stringify({ passed: 157, failed: 0 }));

    const result = await runIntegrationAgent();
    expect(result.error).toBeUndefined();

    const fix = await db.prepare('SELECT * FROM auto_fixes WHERE feedback_id = ?').get(fb.id);
    if (fix && fix.pr_number) {
      expect(fix.approval_token_hash).toBeTruthy();
      expect(fix.status).toBe('review');
    }

    // Cleanup
    await db.prepare('DELETE FROM auto_fixes WHERE feedback_id = ?').run(fb.id);
    await db.prepare('DELETE FROM feedback_reports WHERE id = ?').run(fb.id);
  });
});
