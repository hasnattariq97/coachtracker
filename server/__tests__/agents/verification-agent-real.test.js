// server/__tests__/agents/verification-agent-real.test.js

// Mock native fetch (used by GitHubApiService inside verification agent)
global.fetch = jest.fn();

const db = require('../../db');
const { runVerificationAgent } = require('../../agents/verification-agent');

function mockFetch(status, body) {
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GITHUB_TOKEN = 'test-gh-token';
  process.env.BASE_URL = 'https://example.railway.app';
});

describe('runVerificationAgent', () => {
  test('returns skipped when no implementing auto_fix', async () => {
    const origQuery = db.query;
    db.query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const result = await runVerificationAgent();
    expect(result.skipped).toBe(true);
    db.query = origQuery;
  });

  test('dispatches GitHub Actions and marks testing_pending', async () => {
    const origQuery = db.query;
    const mockFix = { id: 77, feedback_id: 42, branch_name: 'fix/feedback-42abc' };

    // First db.query: find auto_fix
    db.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockFix] })     // SELECT auto_fix
      .mockResolvedValueOnce({ rows: [] })              // UPDATE auto_fixes testing_pending
      .mockResolvedValueOnce({ rows: [] });             // UPDATE feedback_reports

    // GitHub dispatch = 204
    mockFetch(204, {});

    const result = await runVerificationAgent();
    expect(result.dispatched).toBe(true);
    expect(result.branch).toBe('fix/feedback-42abc');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    db.query = origQuery;
  });

  test('handles GitHub dispatch failure gracefully', async () => {
    const origQuery = db.query;
    const mockFix = { id: 88, feedback_id: 55, branch_name: 'fix/feedback-55xyz' };

    db.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockFix] })     // SELECT auto_fix
      .mockResolvedValueOnce({ rows: [] })              // UPDATE auto_fixes testing_pending
      .mockResolvedValueOnce({ rows: [] });             // UPDATE feedback_reports

    // GitHub dispatch returns 422 (unprocessable)
    mockFetch(422, { message: 'Workflow not found' });

    const result = await runVerificationAgent();
    // Should not crash — returns error string
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');

    db.query = origQuery;
  });
});
