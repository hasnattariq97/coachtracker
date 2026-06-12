---
phase: "10"
status: "complete"
owner: "Claude Code"
last_updated: "2026-06-12T00:00:00Z"
beads: ["phase10-design"]
---

# Phase 9b: Autonomous Bug Fix System (Groq-Powered) — Design Specification

**Date:** 2026-06-10  
**Goal:** Coaches report bugs via in-app form. Autonomous agents (powered by Groq API) diagnose, plan, implement, test, and create pull requests. User approves via one-click email link. Agents auto-merge and deploy.

**Status:** Design approved, ready for implementation

---

## 1. Executive Summary

Phase 9b adds **autonomous bug diagnosis and fixing** to Coach Task Tracker. Coaches submit bug reports through a new feedback form. A 5-agent swarm (all powered by Groq API) automatically:

1. **Diagnoses** the root cause (by reading logs + code)
2. **Plans** the fix (detailed implementation steps)
3. **Implements** the code (test-first, RED-GREEN-REFACTOR)
4. **Verifies** the fix (runs unit tests)
5. **Creates a PR** and sends approval email to you

You review the PR in email (one click to approve), agents auto-merge and deploy.

**Key constraint:** Only attempt simple/safe fixes. Escalate complex/risky bugs (security, multi-file refactors, database schema changes).

---

## 2. Architecture Overview

### 2.1 System Flow

```
Coach submits bug via /api/feedback form
    ↓ (Railway backend receives, stores in PostgreSQL)
Stored in feedback_reports table with status='submitted'
    ↓ (Every 5 minutes, Railway cron job wakes up)

CYCLE 1 (5-10 min):
  Diagnostic Agent reads feedback
  → Clones repo from GitHub
  → Calls Groq API: "Analyze this bug"
  → Saves diagnosis to database
  → Updates status='diagnosing'

CYCLE 2 (10-15 min):
  Planning Agent reads diagnosis
  → Calls Groq API: "Create implementation plan"
  → Checks complexity (escalate if too complex)
  → Saves plan to database
  → Updates status='planned'

CYCLE 3 (15-20 min):
  Implementation Agent reads plan
  → Creates feature branch on GitHub
  → Writes failing test (RED phase)
  → Implements code to pass test (GREEN phase)
  → Refactors if needed (REFACTOR phase)
  → Commits and pushes to GitHub
  → Updates status='implementing'

CYCLE 4 (20-25 min):
  Verification Agent runs tests
  → Executes: npm test (unit tests)
  → Executes: npm run lint (code quality)
  → Records test results in database
  → Updates status='testing_passed' or 'testing_failed'

CYCLE 5 (25-30 min):
  Integration Agent creates PR
  → Creates Pull Request on GitHub
  → Generates secure approval token
  → Sends email to hasnat@niete.edu.pk with [Approve] button
  → Updates status='review'

YOU REVIEW (anytime):
  Read email notification
  Click [Approve] link in email
  → Sets auto_fixes.approved=true
  → Updates feedback_reports.status='approved'

CYCLE 6+ (next 5 min):
  Integration Agent sees approval
  → Merges PR to main branch
  → Runs: railway up (deploy to Railway)
  → Updates status='deployed'
  → Sends success email to coach
  ✅ Fix is now LIVE

Total time: ~30 minutes from report to PR creation
Your review time: ~5 minutes
Auto-deploy time: ~2 minutes
```

### 2.2 Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| **Agent implementation** | Full code implementation | Truly autonomous, faster ROI |
| **Complexity handling** | Auto-escalate risky bugs | Protects critical systems, maintains quality |
| **Code context** | Full repo access (clone + read) | Better diagnosis accuracy |
| **Testing** | Unit tests only (no E2E) | Fast feedback, you catch UI issues in PR |
| **Rate limiting** | Sequential processing (1 bug/cycle) | Stays under 30 RPM limit, respects constraints |
| **Approval method** | One-click email link | Frictionless, works anywhere (phone, email client) |
| **Failed tests** | Create PR anyway (you decide) | Agents show their work, you have final say |
| **Processing model** | Railway cron jobs (every 5 min) | Simple, no webhooks, already have cron infrastructure |
| **Cost** | Groq free tier only | ~$0.05 per fix, basically free (~$1-2/month) |

---

## 3. Data Model

### 3.1 PostgreSQL Tables

**Table: feedback_reports**  
Coaches submit bugs here.

```sql
CREATE TABLE feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('bug', 'feature_request', 'problem')),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' 
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(50) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'diagnosing', 'planned', 'implementing', 
                      'testing', 'review', 'approved', 'deployed', 'escalated', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_coach_id (coach_id)
);
```

**Table: diagnoses**  
Agent's analysis of the bug.

```sql
CREATE TABLE diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE UNIQUE,
  root_cause TEXT NOT NULL,
  affected_files TEXT[] NOT NULL DEFAULT '{}',
  severity VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence DECIMAL(3, 2) NOT NULL DEFAULT 0.5
    CHECK (confidence >= 0 AND confidence <= 1),
  analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  escalation_reason VARCHAR(200),  -- If escalated, why?
  INDEX idx_feedback_id (feedback_id)
);
```

**Table: implementation_plans**  
How to fix the bug.

```sql
CREATE TABLE implementation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL,  -- Markdown format with steps
  estimated_effort_hours DECIMAL(5, 2) NOT NULL DEFAULT 1,
  complexity VARCHAR(20) NOT NULL DEFAULT 'simple'
    CHECK (complexity IN ('simple', 'moderate', 'complex')),
  dependencies TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_id (feedback_id)
);
```

**Table: auto_fixes**  
Tracks the implementation and PR.

```sql
CREATE TABLE auto_fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE UNIQUE,
  branch_name VARCHAR(100),
  commit_hash VARCHAR(40),
  pr_number INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'implementing'
    CHECK (status IN ('implementing', 'testing_passed', 'testing_failed', 
                      'review', 'approved', 'deployed', 'failed')),
  test_results JSONB,  -- {passed: 42, failed: 0, skipped: 1}
  approval_token VARCHAR(255),  -- Secure one-time approval token
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_feedback_id (feedback_id)
);
```

---

## 4. Agent Specifications

### 4.1 Diagnostic Agent

**Trigger:** Every 5 minutes, runs if feedback_reports.status = 'submitted'

**Process:**

1. Query: `SELECT * FROM feedback_reports WHERE status='submitted' LIMIT 1`
2. If no feedback, sleep
3. Clone repo from GitHub (using existing credentials)
4. Read server logs from Railway (if available)
5. Call Groq API with prompt:
   ```
   Analyze this bug report:
   Title: {title}
   Description: {description}
   Error logs: {logs}
   Relevant code: {code_snippets}
   
   Provide:
   1. Root cause (1-2 sentences)
   2. List affected files
   3. Severity (low/medium/high/critical)
   4. Confidence (0.0-1.0)
   ```
6. Parse response, save to diagnoses table
7. Update feedback_reports: status='diagnosing', updated_at=now()
8. Log completion

**Groq API calls:** ~0.5-1 call (short diagnosis)  
**Time:** ~30-60 seconds

**Error handling:**
- If Groq times out: retry once
- If code clone fails: skip code context, use only logs
- If no logs found: work with description text only

---

### 4.2 Planning Agent

**Trigger:** Every 5 minutes, runs if diagnosis exists but no implementation_plan

**Process:**

1. Query: 
   ```sql
   SELECT f.*, d.* FROM feedback_reports f
   JOIN diagnoses d ON f.id = d.feedback_id
   LEFT JOIN implementation_plans p ON f.id = p.feedback_id
   WHERE p.id IS NULL LIMIT 1
   ```

2. **Escalation check:** If any condition matches, escalate:
   - `d.affected_files` contains: 'auth.js', 'db.js', 'cron.js' → escalate (critical files)
   - `array_length(d.affected_files, 1) > 5` → escalate (too many files)
   - Description contains: 'security', 'password', 'login', 'encrypt' → escalate
   - `d.complexity` = 'complex' → escalate
   - If escalating: save escalation_reason to diagnoses, update feedback.status='escalated', send email to user, return

3. Call Groq API with prompt:
   ```
   Based on this diagnosis, create a detailed implementation plan:
   
   Root cause: {root_cause}
   Affected files: {affected_files}
   Code context: {relevant_code}
   
   Provide:
   1. Step-by-step implementation plan (numbered list)
   2. Files to change (with line numbers if known)
   3. Test cases to write (describe behavior)
   4. Estimated effort (hours)
   5. Potential side effects
   6. Risk assessment
   ```

4. Parse response, save to implementation_plans table
5. Extract estimated_effort_hours
6. If estimated_effort > 4 → update complexity='complex', escalate
7. Update feedback_reports: status='planned'
8. Log completion

**Groq API calls:** ~1 call  
**Time:** ~2-3 minutes

---

### 4.3 Implementation Agent

**Trigger:** Every 5 minutes, runs if plan exists but status != 'implementing'

**Process:**

1. Query: 
   ```sql
   SELECT f.*, p.plan FROM feedback_reports f
   JOIN implementation_plans p ON f.id = p.feedback_id
   WHERE f.status='planned' LIMIT 1
   ```

2. Clone repo to temp directory
3. Create feature branch: `fix/feedback-{feedback_id}`
4. **RED Phase:** Call Groq to write a failing test
   ```
   Based on this plan, write a test that reproduces the bug:
   {plan}
   
   Write a single Jest test that:
   - Describes the bug scenario
   - Would fail with current code
   - Passes after fix is implemented
   ```
   - Parse response, write to appropriate test file
   - Run: `npm test -- specific-test.js` (verify it fails)

5. **GREEN Phase:** Call Groq to implement minimal fix
   ```
   Write the minimal code to make this test pass:
   {test_code}
   {plan}
   
   Provide only the code changes needed, nothing extra.
   ```
   - Parse response, write to source file
   - Run: `npm test -- specific-test.js` (verify it passes)

6. **REFACTOR Phase:** Call Groq to improve code quality
   ```
   Improve this code for readability and maintainability:
   {code}
   
   Extract helpers, improve variable names, add edge case handling.
   ```
   - Parse and apply refactorings
   - Run: `npm test` (verify all tests still pass)

7. Commit changes:
   ```bash
   git config user.name "Coach-Tracker-Agents"
   git config user.email "agents@coachtracker.local"
   git add -A
   git commit -m "[Phase 9b] Fix: {title} (feedback-{id})"
   git push origin fix/feedback-{id}
   ```

8. Save commit_hash and branch_name to auto_fixes table
9. Update feedback_reports: status='implementing'
10. Log completion

**Groq API calls:** ~3 calls (test + implementation + refactor)  
**Time:** ~5-10 minutes

**Error handling:**
- If tests fail after GREEN: rollback to original, call Groq again with error message
- If syntax error in generated code: log error, escalate to user
- If git push fails: check credentials, retry once

---

### 4.4 Verification Agent

**Trigger:** Every 5 minutes, runs if status='implementing' and not already verified

**Process:**

1. Query: `SELECT * FROM auto_fixes WHERE status='implementing' LIMIT 1`
2. Get branch_name, checkout to that branch on fresh clone
3. Run: `cd server && npm test 2>&1` (capture output and exit code)
4. Run: `cd client && npm run lint 2>&1` (ESLint)
5. Run: `npm run test:e2e 2>&1` (optional, skip if timeout > 30 seconds)
6. Parse results:
   ```json
   {
     "unit_tests": {"passed": 157, "failed": 0, "skipped": 1},
     "lint": {"errors": 0, "warnings": 2},
     "coverage": {"lines": 87, "branches": 82, "functions": 90}
   }
   ```
7. Save test_results to auto_fixes table
8. If all passed:
   - Update auto_fixes.status='testing_passed'
   - Update feedback_reports.status='testing'
9. If any failed:
   - Update auto_fixes.status='testing_failed'
   - Update feedback_reports.status='testing'
10. Log completion with results

**Note:** Integration Agent will create PR regardless of test status. Failed tests just add ⚠️ warning.

**Time:** ~1-2 minutes

---

### 4.5 Integration Agent

**Trigger:** Every 5 minutes, runs if status='testing' and no PR yet

**Process:**

1. Query: `SELECT * FROM auto_fixes WHERE status='testing' AND pr_number IS NULL LIMIT 1`
2. Get feedback and diagnosis info
3. Generate PR title:
   ```
   If test_results.unit_tests.failed > 0:
     "⚠️ Fix (tests failing): {title}"
   Else:
     "Fix: {title}"
   ```
4. Generate PR description (markdown):
   ```markdown
   ## Bug Report
   **Title:** {title}
   **Priority:** {priority}
   **Reporter:** Coach {coach_name}
   
   **Description:**
   {description}
   
   ---
   
   ## Diagnosis
   **Root Cause:** {root_cause}
   **Affected Files:** {affected_files}
   **Severity:** {severity}
   
   ---
   
   ## Implementation
   **Plan:**
   {plan}
   
   **Files Changed:** {branch_name}
   **Test Results:**
   - Unit Tests: {passed}/{total} passing
   - Lint: {lint_errors} errors
   - Coverage: {coverage}%
   
   ---
   
   ## Next Steps
   **To approve this fix:**
   [Approve](https://your-domain.com/api/auto-fixes/{id}/approve?token={approval_token})
   
   **To reject:** Reply to this email with "reject"
   ```

5. Call GitHub API to create PR:
   ```bash
   gh pr create \
     --title "{pr_title}" \
     --body "{pr_body}" \
     --base main \
     --head fix/feedback-{id}
   ```

6. Parse response, get pr_number
7. Generate secure approval token:
   ```javascript
   const token = crypto.randomBytes(32).toString('hex');
   const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
   // Store tokenHash in database (not plaintext)
   // Send plaintext token in email URL
   ```

8. Send email to hasnat@niete.edu.pk:
   ```
   Subject: ✅ Auto-fix ready for review: {title}
   
   Hi,
   
   An autonomous agent has fixed a reported bug:
   
   Bug: {title}
   Root Cause: {root_cause}
   Files Changed: {file_count}
   
   Pull Request: https://github.com/hasnattariq97/coachtracker/pull/{pr_number}
   
   One-Click Approval:
   [✅ APPROVE FIX](https://your-domain.com/api/auto-fixes/{id}/approve?token={token})
   
   Or review on GitHub: {pr_url}
   
   Cheers,
   Coach Tracker Agents
   ```

9. Save pr_number and approval_token to auto_fixes table
10. Update auto_fixes.status='review'
11. Log completion

**Email security:**
- Token expires after 7 days
- One-time use only (delete token after approval)
- Logged to audit trail

**Time:** ~30 seconds

---

## 5. Approval & Deployment

### 5.1 Approval Endpoint

**POST /api/auto-fixes/{id}/approve**

```javascript
async function approveAutoFix(req, res) {
  const { id } = req.params;
  const { token } = req.query;
  
  // Validate token
  const fix = await db.query('SELECT * FROM auto_fixes WHERE id = ?', [id]);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  if (tokenHash !== fix.approval_token_hash) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Mark as approved
  await db.query('UPDATE auto_fixes SET approved=true, approved_at=now() WHERE id = ?', [id]);
  await db.query('UPDATE feedback_reports SET status=? WHERE id = ?', ['approved', fix.feedback_id]);
  
  // Delete token (one-time use)
  await db.query('UPDATE auto_fixes SET approval_token_hash=NULL WHERE id = ?', [id]);
  
  res.json({ success: true, message: 'Fix approved. Will deploy in next cycle.' });
}
```

### 5.2 Auto-Merge & Deploy

**In Integration Agent (next 5-min cycle):**

1. Query: `SELECT * FROM auto_fixes WHERE status='review' AND approved=true LIMIT 1`
2. If approved, merge PR:
   ```bash
   git checkout main
   git pull origin main
   git merge --ff-only fix/feedback-{id}
   git push origin main
   ```
3. Deploy to Railway:
   ```bash
   railway login
   railway up --service backend
   ```
4. Wait for deploy to succeed (~2-3 min)
5. Update auto_fixes.status='deployed'
6. Update feedback_reports.status='deployed'
7. Send success email to coach:
   ```
   Subject: 🎉 Your reported bug is fixed!
   
   Hi {coach_name},
   
   The bug you reported is now fixed and live in production:
   
   Bug: {title}
   Fix: {root_cause}
   
   Try it out now!
   
   Thanks for reporting,
   Coach Tracker Team
   ```

---

## 6. Safety Guardrails

### 6.1 Escalation Rules

**Planning Agent MUST escalate (don't attempt) if:**

1. **Critical files touched:**
   - `server/auth.js` (authentication logic)
   - `server/db.js` (database layer)
   - `server/cron.js` (scheduled jobs)

2. **Scope too large:**
   - Changes > 5 files
   - Modifies database schema
   - Modifies migration files

3. **Security keywords detected:**
   - Description contains: "security", "password", "login", "encrypt", "token", "api key", "credential"

4. **Complexity threshold:**
   - Estimated effort > 4 hours
   - Complexity marked as 'complex'

**When escalating:**
- Save escalation_reason to diagnoses table
- Update feedback_reports.status='escalated'
- Send email to user: "⚠️ This needs human review because {reason}"
- Include diagnosis so user can manually fix or approve escalation

### 6.2 Error Recovery

**If test generation fails:**
- Log error with full traceback
- Escalate to user: "Couldn't generate tests automatically"
- Include plan for manual implementation

**If code implementation fails:**
- Log error
- Create PR anyway with note: "Implementation incomplete, needs human fix"
- User sees attempted code, can comment/fix

**If deployment fails:**
- Revert merge to main
- Send alert email: "Deployment failed, PR still open for review"
- Investigation required before retry

---

## 7. Monitoring & Observability

### 7.1 Status Dashboard Query

```sql
-- Overall status
SELECT 
  status, 
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM feedback_reports
GROUP BY status
ORDER BY count DESC;

-- Time in each stage
SELECT
  status,
  EXTRACT(EPOCH FROM (MAX(updated_at) - MIN(updated_at))) / 3600 as hours_to_complete
FROM feedback_reports
WHERE status IN ('diagnosing', 'planned', 'implementing', 'testing', 'review', 'deployed')
GROUP BY status;
```

### 7.2 Agent Logs

**View real-time logs:**
```bash
railway logs --service backend | grep "Agent"
```

**Log format (each agent):**
```
[2026-06-10 14:32:15] [Diagnostic Agent] Starting...
[2026-06-10 14:32:16] [Diagnostic Agent] Found 1 feedback to diagnose
[2026-06-10 14:32:45] [Diagnostic Agent] Diagnosis saved: race condition in NotificationBell
[2026-06-10 14:32:46] [Diagnostic Agent] Complete (30 sec)
```

---

## 8. Testing Strategy

### 8.1 Agent Tests

Each agent needs:
- ✅ Unit tests for Groq API calls (mock responses)
- ✅ Integration tests with real database
- ✅ End-to-end test of full 5-cycle flow

### 8.2 Approval Flow Tests

- ✅ Token generation and validation
- ✅ One-time token consumption
- ✅ Email sending
- ✅ PR creation and merge

---

## 9. Implementation Timeline

| Task | Effort | Owner |
|------|--------|-------|
| Database schema + migration | 1h | Engineering |
| Feedback endpoint (POST /api/feedback) | 1h | Engineering |
| Diagnostic Agent | 2h | Agents |
| Planning Agent | 2h | Agents |
| Implementation Agent | 3h | Agents |
| Verification Agent | 1h | Agents |
| Integration Agent + approval endpoint | 2h | Agents |
| GitHub Actions workflow (.yml) | 1h | Engineering |
| Cron job scheduling | 0.5h | Engineering |
| Email templates + sending | 1h | Engineering |
| Testing suite (all agents) | 3h | QA |
| Documentation | 1h | Docs |
| **Total** | **~18 hours** | — |

**Breakdown:** 8h agents, 5h infrastructure, 3h testing, 1h docs, 1h integration

---

## 10. Success Criteria

✅ Coaches can submit bugs via `/api/feedback` form  
✅ Agents diagnose bugs within 5 minutes  
✅ Agents plan fixes within 10 minutes  
✅ Agents implement + test within 20 minutes  
✅ PR created with full context  
✅ User receives one-click approval email  
✅ Agents auto-merge and deploy after approval  
✅ Coach receives notification when fix is live  
✅ Escalated bugs don't block workflow  
✅ Failed tests don't prevent PR creation  
✅ All agents log completion status  
✅ Cost stays under $5/month (Groq free tier)  

---

## 11. Future Enhancements (Phase 9c+)

- **Autonomous Enhancement Proposals:** Agents analyze coach behavior, propose new features
- **Retry Logic:** Agents automatically attempt to fix their own code if tests fail
- **Cost Optimization:** Batch multiple bugs per cycle if queue grows
- **Learning:** Track which agents succeed most, adjust strategy
- **Performance Monitoring:** Add metrics for fix quality, success rate, time-to-deploy

---

## Approval & Sign-Off

**Design approved by:** [User]  
**Date approved:** 2026-06-10  
**Ready for implementation:** Yes ✅

