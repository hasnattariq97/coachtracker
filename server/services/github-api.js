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
   * Searches the full repo tree for the best matching file path.
   * Groq often returns bare filenames (e.g. 'login.js') that don't exist at
   * that path. This resolves them to the actual full path in the repo.
   *
   * Resolution order:
   *   1. Exact path match
   *   2. Case-insensitive basename match
   *   3. Stem fuzzy match (e.g. 'login' → 'LoginPage.jsx')
   *   4. Keyword match (any significant word in filename appears in path)
   *
   * Returns the resolved path string, or null if no match found.
   */
  async findFileInRepo(filename, branch = 'main') {
    const refData = await this._fetch(`/git/refs/heads/${encodeURIComponent(branch)}`);
    const commitSha = refData.object.sha;
    const commitData = await this._fetch(`/git/commits/${commitSha}`);
    const treeData = await this._fetch(`/git/trees/${commitData.tree.sha}?recursive=1`);
    const allPaths = (treeData.tree || [])
      .filter(item => item.type === 'blob')
      .map(item => item.path);

    const norm = filename.replace(/\\/g, '/');

    // 1. Exact match
    if (allPaths.includes(norm)) return norm;

    const inputBase = norm.split('/').pop();
    const inputExt = inputBase.split('.').pop().toLowerCase();
    const inputStem = inputBase.replace(/\.[^.]+$/, '').toLowerCase();

    const isScript = ext => ['js', 'jsx', 'ts', 'tsx'].includes(ext);

    // 2. Case-insensitive basename match
    const baseMatches = allPaths.filter(p =>
      p.split('/').pop().toLowerCase() === inputBase.toLowerCase() && isScript(p.split('.').pop().toLowerCase())
    );
    if (baseMatches.length === 1) return baseMatches[0];
    if (baseMatches.length > 1) {
      const prefer = ['jsx', 'tsx'].includes(inputExt)
        ? baseMatches.find(p => p.startsWith('client/')) : baseMatches.find(p => p.startsWith('server/'));
      return prefer || baseMatches[0];
    }

    // 3. Stem fuzzy match — e.g. 'login' matches 'LoginPage.jsx'
    const stemMatches = allPaths.filter(p => {
      if (!isScript(p.split('.').pop().toLowerCase())) return false;
      const pStem = p.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
      return pStem.includes(inputStem) || inputStem.includes(pStem);
    });
    if (stemMatches.length > 0) {
      stemMatches.sort((a, b) => a.length - b.length);
      return stemMatches[0];
    }

    // 4. Keyword match — extract CamelCase/lowercase words ≥4 chars
    const words = (inputBase.match(/[A-Z][a-z]+|[a-z]{4,}/g) || []).map(w => w.toLowerCase());
    if (words.length > 0) {
      const kwMatches = allPaths.filter(p => {
        if (!isScript(p.split('.').pop().toLowerCase())) return false;
        const pLower = p.toLowerCase();
        return words.some(w => pLower.includes(w));
      });
      if (kwMatches.length > 0) {
        kwMatches.sort((a, b) => a.length - b.length);
        return kwMatches[0];
      }
    }

    return null;
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
