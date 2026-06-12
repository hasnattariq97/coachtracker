// server/__tests__/services/github-api.test.js

// Mock native fetch before requiring the module
global.fetch = jest.fn();

const { GitHubApiService } = require('../../services/github-api');

const OWNER = 'hasnattariq97';
const REPO = 'coachtracker';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GITHUB_TOKEN = 'test-token-abc';
});

function mockFetch(status, body) {
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('GitHubApiService.getDefaultBranch', () => {
  test('returns default branch name from repo info', async () => {
    mockFetch(200, { default_branch: 'main' });
    const svc = new GitHubApiService();
    const branch = await svc.getDefaultBranch();
    expect(branch).toBe('main');
    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.github.com/repos/${OWNER}/${REPO}`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token-abc' }) })
    );
  });
});

describe('GitHubApiService.getFileSha', () => {
  test('returns sha and content for existing file', async () => {
    const encodedContent = Buffer.from('console.log("hello")').toString('base64');
    mockFetch(200, { sha: 'abc123', content: encodedContent + '\n' });
    const svc = new GitHubApiService();
    const result = await svc.getFileSha('server/index.js', 'main');
    expect(result.sha).toBe('abc123');
    expect(result.content).toBe('console.log("hello")');
  });

  test('throws on 404', async () => {
    mockFetch(404, { message: 'Not Found' });
    const svc = new GitHubApiService();
    await expect(svc.getFileSha('does-not-exist.js', 'main')).rejects.toThrow('GitHub API 404');
  });
});

describe('GitHubApiService.createBranch', () => {
  test('creates branch from sha', async () => {
    // getMainSha fetch
    mockFetch(200, { object: { sha: 'base-sha-xyz' } });
    // create ref fetch
    mockFetch(201, { ref: 'refs/heads/fix/feedback-1234' });
    const svc = new GitHubApiService();
    const sha = await svc.createBranch('fix/feedback-1234', 'main');
    expect(sha).toBe('base-sha-xyz');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('GitHubApiService.commitFile', () => {
  test('commits file content to branch', async () => {
    mockFetch(200, { commit: { sha: 'commit-sha-999' } });
    const svc = new GitHubApiService();
    const commitSha = await svc.commitFile(
      'server/routes/tasks.js',
      'fix: correct null check',
      'const x = 1;',
      'old-file-sha',
      'fix/feedback-1234'
    );
    expect(commitSha).toBe('commit-sha-999');
    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(callBody.message).toBe('fix: correct null check');
    expect(callBody.branch).toBe('fix/feedback-1234');
  });
});

describe('GitHubApiService.mergeBranch', () => {
  test('merges branch into base', async () => {
    mockFetch(201, { sha: 'merge-commit-sha' });
    const svc = new GitHubApiService();
    const result = await svc.mergeBranch('fix/feedback-1234', 'main', 'fix: applied auto-fix');
    expect(result.sha).toBe('merge-commit-sha');
  });

  test('throws on merge conflict', async () => {
    mockFetch(409, { message: 'Merge conflict' });
    const svc = new GitHubApiService();
    await expect(svc.mergeBranch('fix/feedback-1234', 'main', 'fix')).rejects.toThrow('GitHub API 409');
  });
});

describe('GitHubApiService.dispatchWorkflow', () => {
  test('dispatches workflow_dispatch event', async () => {
    mockFetch(204, {});
    const svc = new GitHubApiService();
    await expect(
      svc.dispatchWorkflow('auto-fix.yml', 'main', { feedback_id: '42', branch_name: 'fix/feedback-42' })
    ).resolves.not.toThrow();
  });
});

describe('GitHubApiService.getWorkflowRun', () => {
  test('returns most recent run for workflow', async () => {
    mockFetch(200, {
      workflow_runs: [
        { id: 999, status: 'completed', conclusion: 'success', created_at: new Date().toISOString() },
      ],
    });
    const svc = new GitHubApiService();
    const run = await svc.getWorkflowRun('auto-fix.yml', 'fix/feedback-1234');
    expect(run.id).toBe(999);
    expect(run.conclusion).toBe('success');
  });

  test('returns null when no runs found', async () => {
    mockFetch(200, { workflow_runs: [] });
    const svc = new GitHubApiService();
    const run = await svc.getWorkflowRun('auto-fix.yml', 'fix/feedback-1234');
    expect(run).toBeNull();
  });
});
