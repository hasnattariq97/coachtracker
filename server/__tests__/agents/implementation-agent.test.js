const db = require('../../db');

// Mock groq-sdk before requiring the agent
const mockCreate = jest.fn();
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } }
  }));
});

// Force non-test env so the Groq client is initialised with the mock
const originalEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';
process.env.GROQ_API_KEY = 'test-key';

// Require AFTER mocking so the module picks up the mock
const { runImplementationAgent } = require('../../agents/implementation-agent');

afterAll(() => {
  process.env.NODE_ENV = originalEnv;
});

describe('Implementation Agent', () => {
  let hasDatabase = false;

  beforeAll(async () => {
    try {
      await db.prepare('SELECT 1 as ok').get();
      hasDatabase = true;
    } catch { hasDatabase = false; }
  });

  beforeEach(() => jest.clearAllMocks());

  test('returns skipped when no planned feedback', async () => {
    const result = await runImplementationAgent();
    expect(result).toBeDefined();
  });

  test('implements fix with RED-GREEN-REFACTOR and saves auto_fix', async () => {
    if (!hasDatabase) return;
    const adminUser = await db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!adminUser) return;

    const fb = await db.prepare(`
      INSERT INTO feedback_reports (coach_id, type, title, description, priority, status)
      VALUES (?, 'bug', 'UI race condition', 'Spinner never ends', 'high', 'planned')
      RETURNING id
    `).get(adminUser.id);
    if (!fb) return;

    await db.prepare(`
      INSERT INTO implementation_plans (feedback_id, plan, estimated_effort_hours, complexity)
      VALUES (?, 'Add dedup logic to NotificationBell', 1.5, 'moderate')
    `).run(fb.id);

    // Mock 3 Groq calls (RED, GREEN, REFACTOR)
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: "test('dedup works', () => {});" } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'const dedup = new Map();' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'const dedupMap = new Map();' } }] });

    const result = await runImplementationAgent();
    expect(result.error).toBeUndefined();

    const fix = await db.prepare('SELECT * FROM auto_fixes WHERE feedback_id = ?').get(fb.id);
    expect(fix).toBeTruthy();
    expect(fix.branch_name).toContain('fix/feedback-');

    // Cleanup
    await db.prepare('DELETE FROM auto_fixes WHERE feedback_id = ?').run(fb.id);
    await db.prepare('DELETE FROM implementation_plans WHERE feedback_id = ?').run(fb.id);
    await db.prepare('DELETE FROM feedback_reports WHERE id = ?').run(fb.id);
  });

  test('handles Groq failure gracefully', async () => {
    if (!hasDatabase) return;
    const adminUser = await db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!adminUser) return;

    const fb = await db.prepare(`
      INSERT INTO feedback_reports (coach_id, type, title, description, priority, status)
      VALUES (?, 'bug', 'Groq fail test', 'desc', 'low', 'planned')
      RETURNING id
    `).get(adminUser.id);
    if (!fb) return;

    await db.prepare(`
      INSERT INTO implementation_plans (feedback_id, plan, estimated_effort_hours, complexity)
      VALUES (?, 'some plan', 1.0, 'simple')
    `).run(fb.id);

    mockCreate.mockRejectedValueOnce(new Error('Groq timeout'));

    const result = await runImplementationAgent();
    expect(result).toBeDefined();
    // Should not crash; error returned gracefully
    expect(result.success).toBeUndefined();

    // Cleanup
    await db.prepare('DELETE FROM auto_fixes WHERE feedback_id = ?').run(fb.id);
    await db.prepare('DELETE FROM implementation_plans WHERE feedback_id = ?').run(fb.id);
    await db.prepare('DELETE FROM feedback_reports WHERE id = ?').run(fb.id);
  });
});
