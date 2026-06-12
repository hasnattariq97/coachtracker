// server/__tests__/agents/integration-agent.test.js

// Mock email service
jest.mock('../../services/email', () => ({
  sendApprovalEmail: jest.fn().mockResolvedValue({}),
  sendEmail: jest.fn().mockResolvedValue({}),
}));

// Mock GitHubApiService — factory creates a fresh jest.fn() per instantiation
jest.mock('../../services/github-api', () => ({
  GitHubApiService: jest.fn(),
}));

const db = require('../../db');
const { GitHubApiService } = require('../../services/github-api');
const { runIntegrationAgent } = require('../../agents/integration-agent');

// Shared mock function for mergeBranch
let mockMergeBranch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GITHUB_TOKEN = 'test-token';
  // Set up a fresh mergeBranch mock for each test
  mockMergeBranch = jest.fn();
  GitHubApiService.mockImplementation(() => ({
    mergeBranch: mockMergeBranch,
  }));
});

describe('runIntegrationAgent — deploy path (merge)', () => {
  test('returns skipped when no approved fixes', async () => {
    const origQuery = db.query;
    db.query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })   // no approved fix
      .mockResolvedValueOnce({ rows: [] });  // no testing_passed fix
    const result = await runIntegrationAgent();
    expect(result.skipped).toBe(true);
    db.query = origQuery;
  });

  test('calls mergeBranch and sets status=deployed on approval', async () => {
    const origQuery = db.query;
    const approvedFix = {
      id: 10,
      feedback_id: 55,
      branch_name: 'fix/feedback-55abc',
      pr_number: 42,
    };

    mockMergeBranch.mockResolvedValueOnce({ sha: 'merge-sha-999' });

    db.query = jest.fn()
      .mockResolvedValueOnce({ rows: [approvedFix] })              // SELECT approved fix
      .mockResolvedValueOnce({ rows: [] })                          // UPDATE auto_fixes deployed
      .mockResolvedValueOnce({ rows: [] })                          // UPDATE feedback_reports deployed
      .mockResolvedValueOnce({ rows: [{ title: 'Login spinner bug' }] }); // SELECT title

    const result = await runIntegrationAgent();
    expect(result.deployed).toBe(true);
    expect(result.fixId).toBe(10);
    expect(mockMergeBranch).toHaveBeenCalledWith(
      'fix/feedback-55abc',
      'main',
      expect.stringContaining('Auto-fix')
    );

    // Confirm status was set to 'deployed'
    const updateCall = db.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE auto_fixes SET status/);
    expect(updateCall[1][0]).toBe('deployed');

    db.query = origQuery;
  });

  test('handles merge conflict gracefully — sets status=merge_failed', async () => {
    const origQuery = db.query;
    const approvedFix = { id: 11, feedback_id: 56, branch_name: 'fix/feedback-56xyz', pr_number: 43 };

    mockMergeBranch.mockRejectedValueOnce(new Error('GitHub API 409: Merge conflict'));

    db.query = jest.fn()
      .mockResolvedValueOnce({ rows: [approvedFix] })
      .mockResolvedValueOnce({ rows: [] })  // UPDATE auto_fixes merge_failed
      .mockResolvedValueOnce({ rows: [] }); // UPDATE feedback_reports

    const result = await runIntegrationAgent();
    expect(result.error).toMatch(/merge_failed/i);

    // Confirm merge_failed status was written
    const updateCall = db.query.mock.calls[1];
    expect(updateCall[1][0]).toBe('merge_failed');

    db.query = origQuery;
  });

  test('creates approval token and sends email for testing_passed fix', async () => {
    const origQuery = db.query;
    const { sendApprovalEmail } = require('../../services/email');

    const testedFix = {
      id: 20,
      feedback_id: 66,
      branch_name: 'fix/feedback-66def',
      commit_hash: 'abc123',
      test_results: JSON.stringify({ passed: 157, failed: 0 }),
      fix_status: 'testing_passed',
      title: 'Spinner race condition',
      coach_id: 5,
    };

    db.query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })          // no approved fix
      .mockResolvedValueOnce({ rows: [testedFix] }) // testing_passed fix
      .mockResolvedValueOnce({ rows: [] })            // UPDATE auto_fixes review
      .mockResolvedValueOnce({ rows: [] });            // UPDATE feedback_reports review

    const result = await runIntegrationAgent();
    expect(result.success).toBe(true);
    expect(sendApprovalEmail).toHaveBeenCalled();

    db.query = origQuery;
  });
});
