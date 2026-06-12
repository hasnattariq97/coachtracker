// server/services/github-api.js
/**
 * @phase 10
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-12T00:00:00Z
 */

const OWNER = 'hasnattariq97';
const REPO = 'coachtracker';
const BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;

class GitHubApiService {
  constructor(token) {
    this.token = token || process.env.GITHUB_TOKEN;
  }

  async _fetch(path, options = {}) {
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    // 204 No Content — no body to parse
    if (response.status === 204) return {};
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${data.message || JSON.stringify(data)}`);
    }
    return data;
  }

  /** Returns the default branch name ('main') */
  async getDefaultBranch() {
    const data = await this._fetch('');
    return data.default_branch;
  }

  /**
   * Returns { sha, content } for a file path on a branch.
   * content is the decoded UTF-8 string.
   */
  async getFileSha(filePath, branch) {
    const data = await this._fetch(`/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`);
    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    return { sha: data.sha, content };
  }

  /**
   * Creates a new branch off baseBranch.
   * Returns the base commit SHA (used later as parent SHA for commits).
   */
  async createBranch(branchName, baseBranch) {
    const refData = await this._fetch(`/git/refs/heads/${encodeURIComponent(baseBranch)}`);
    const baseSha = refData.object.sha;
    await this._fetch('/git/refs', {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });
    return baseSha;
  }

  /**
   * Commits a new file content to branchName.
   * fileSha is the current blob SHA (from getFileSha).
   * Returns the new commit SHA.
   */
  async commitFile(filePath, commitMessage, newContent, fileSha, branchName) {
    const encoded = Buffer.from(newContent, 'utf-8').toString('base64');
    const data = await this._fetch(`/contents/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
        sha: fileSha,
        branch: branchName,
      }),
    });
    return data.commit.sha;
  }

  /**
   * Merges branchName into baseBranch.
   * Returns { sha } of the merge commit.
   */
  async mergeBranch(branchName, baseBranch, commitMessage) {
    return this._fetch('/merges', {
      method: 'POST',
      body: JSON.stringify({ base: baseBranch, head: branchName, commit_message: commitMessage }),
    });
  }

  /**
   * Triggers a workflow_dispatch event on workflowFile (e.g. 'auto-fix.yml').
   * inputs is a plain object of string key-values passed to the workflow.
   */
  async dispatchWorkflow(workflowFile, ref, inputs) {
    await this._fetch(`/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref, inputs }),
    });
  }

  /**
   * Returns the most-recent workflow run for workflowFile on headBranch,
   * or null if none found.
   */
  async getWorkflowRun(workflowFile, headBranch) {
    const data = await this._fetch(
      `/actions/workflows/${encodeURIComponent(workflowFile)}/runs?branch=${encodeURIComponent(headBranch)}&per_page=1`
    );
    if (!data.workflow_runs || data.workflow_runs.length === 0) return null;
    return data.workflow_runs[0];
  }
}

module.exports = { GitHubApiService };
