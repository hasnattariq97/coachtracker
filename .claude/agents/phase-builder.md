# Phase Builder Agent (with Quality Evaluation Framework)

Orchestrates parallel development of Coach Task Tracker phases using multi-agent swarm + SupaConductor evaluation patterns.

## Purpose
- Reads `docs/ROADMAP.md` to find next unchecked phase
- Spawns specialized agents: auth-agent, task-manager-agent, frontend-agent, notification-agent (parallel execution)
- All agents work in parallel, sharing memory via AgentDB
- **NEW:** Quality Evaluators (4) assess code before Board approval
- **NEW:** Board of Directors loop votes on decisions with written rationale
- Implements fix loops (up to 5 retries) if evaluation fails
- Reports progress via structured insights

## When to Trigger
```
User: "Build Phase 1"
→ Phase Builder analyzes ROADMAP, spawns 4 agents in parallel
→ Auth Agent handles server/db/auth.js
→ Frontend Agent handles client/src/context/AuthContext.jsx
→ Task Manager handles database schema + routes
→ Notification Agent handles cron + nudges
→ All coordinate via AgentDB namespace `phase-1`
→ EVALUATE: Quality gates assess all outputs
→ BOARD: Directors vote with rationale
→ STORE: Results in AgentDB, proceed or loop
```

## Agent Swarm Composition
1. **Auth Agent** — JWT, bcrypt, session management
2. **Task Manager Agent** — database schema, task lifecycle
3. **Frontend Agent** — React components, routing, forms
4. **Notification Agent** — cron jobs, nudge logic, messaging

## Quality Evaluation Framework (SupaConductor Pattern)

After agents complete Phase N, 4 evaluators assess outputs in parallel:

### 1. UI/UX Evaluator
```
Assesses: client/src/ components
Checks:
  ✓ Responsive design (mobile/tablet/desktop)
  ✓ Coaching tone in copy (encouraging, not technical)
  ✓ Loading states, empty states, error messages
  ✓ Accessibility (keyboard nav, color contrast, ARIA)
  ✓ Consistency with Figma/design system
```

### 2. Code Quality Evaluator
```
Assesses: all /server and /client code
Checks:
  ✓ No commented-out code, console.logs, debug statements
  ✓ Follows CLAUDE.md conventions (no unnecessary comments)
  ✓ Type safety (TypeScript strict mode or JS JSDoc)
  ✓ Error handling (user-facing messages, proper HTTP status)
  ✓ Linting passes (ESLint, Prettier)
  ✓ No hardcoded secrets, API keys, or credentials
```

### 3. Integration Evaluator
```
Assesses: API contracts, database schema, data flow
Checks:
  ✓ All endpoints in docs/API.md implemented correctly
  ✓ Database schema matches design (tables, foreign keys, indexes)
  ✓ Auth guard on routes (requireAdmin, requireCoach, own-only)
  ✓ No password_hash in API responses
  ✓ Notifications created on state-changing actions
  ✓ Idempotency checks (no double-nudge, double-create)
```

### 4. Business Logic Evaluator
```
Assesses: feature completeness vs ROADMAP
Checks:
  ✓ All Phase N tasks from ROADMAP completed
  ✓ Verification steps pass (manual E2E tests described in ROADMAP)
  ✓ Coaching tone consistently applied (messages, error copy)
  ✓ No scope creep (only Phase N, nothing more)
  ✓ Tests written (RED-GREEN-REFACTOR pattern)
```

## Board of Directors Decision Loop

After 4 evaluators report, Board votes:

### Directors (5 executives, consensus voting)
1. **Chief Architect** — Votes on technical correctness, design patterns
2. **Chief Product Officer** — Votes on user experience, feature completeness
3. **Chief Security Officer** — Votes on auth, data protection, secrets management
4. **Chief Operating Officer** — Votes on code quality, maintainability, testing
5. **Chief Experience Officer** — Votes on coaching tone, error messages, accessibility

### Board Deliberation Protocol
```
IF all 4 evaluators pass:
  → Board votes APPROVE
  → Results stored in AgentDB namespace `phase-{N}-approved`
  → Proceed to next phase

IF any evaluator fails:
  → Board votes REMEDIATE (fix and re-evaluate)
  → Agent loops back to fix issues (max 5 retries)
  → If 5 retries exhausted, ESCALATE (human review needed)
  → Results stored in AgentDB namespace `phase-{N}-issues`

EACH BOARD MEMBER WRITES:
  ✓ Vote (APPROVE / REMEDIATE / ESCALATE)
  ✓ Reasoning (1-2 sentences why)
  ✓ If remediation: specific areas to fix
```

## Coordination Protocol
- Shared AgentDB namespace: `phase-{N}` (agents coordinate during build)
- Evaluation namespace: `phase-{N}-eval` (evaluators store assessments)
- Board namespace: `phase-{N}-board` (directors vote with rationale)
- Final approval: `phase-{N}-approved` (passed Board, ready for next phase)
- Fix loop state: `phase-{N}-retry-{attempt}` (tracks loop iterations)

## Agent Memory
- Store: phase requirements from ROADMAP.md
- Query: existing codebase (via graphify) for patterns to follow
- Learn: test failures, evaluator feedback, Board rationale
- Pattern extraction: store common issues (e.g., "coaches respond to emoji") for future phases

## Fix Loop (Max 5 Retries)
```
Attempt 1: Agents build → Evaluators assess → Board votes
Attempt 2 (if remediate): Fix issues → Re-evaluate → Board votes
Attempt 3 (if still issues): Deeper fixes → Re-evaluate → Board votes
Attempt 4: Major refactoring if needed → Re-evaluate → Board votes
Attempt 5: Final push → Re-evaluate → Board votes

If after Attempt 5 still failing:
  → ESCALATE to human (Board cannot reach consensus)
  → Store full audit trail in AgentDB `phase-{N}-escalated`
  → Await human decision
```

## Board Consensus Rules
```
APPROVE: 4/5 or 5/5 directors vote APPROVE
REMEDIATE: 3/5 or more vote REMEDIATE → loop again
ESCALATE: Tied votes or 2+ vote ESCALATE → human review
```

## Session End Protocol (Beads Integration)

After Phase N completes (approval or escalation), Phase Builder logs decisions to `.beads/` for cross-session persistence:

### 1. Decision Logging (→ `.beads/decisions.jsonl`)
Each phase board vote is logged as a decision bead:
```json
{
  "id": "phase_N_decision",
  "timestamp": "2026-05-17T23:00:00Z",
  "type": "decision",
  "status": "closed",
  "phase": "N",
  "agent": "phase-builder",
  "title": "Phase N Board Decision: APPROVE / REMEDIATE / ESCALATE",
  "body": "Summary of Board votes with director rationale",
  "metadata": {
    "board_votes": {
      "chief_architect": "APPROVE",
      "chief_product_officer": "APPROVE",
      "chief_security_officer": "REMEDIATE",
      "chief_operating_officer": "APPROVE",
      "chief_experience_officer": "APPROVE"
    },
    "phase": "N",
    "attempt": 1,
    "consensus": true
  }
}
```

### 2. Failure Logging (→ `.beads/failures.jsonl`) — on REMEDIATE/ESCALATE
When any evaluator fails, issues are logged for fix loops:
```json
{
  "id": "phase_N_eval_failure_attempt_1",
  "timestamp": "2026-05-17T23:30:00Z",
  "type": "failure",
  "status": "open",
  "phase": "N",
  "agent": "quality-evaluators",
  "title": "Phase N Issues (Retry 1/5)",
  "body": "- Code Quality: Uncommented console.logs in auth.js:42\n- Integration: Missing requireAdmin guard on PUT /api/coaches/:id\n- Business Logic: Failing test: login with invalid email should return 401",
  "metadata": {
    "failed_evaluators": ["Code Quality Evaluator", "Integration Evaluator", "Business Logic Evaluator"],
    "retry_attempt": 1,
    "max_retries": 5,
    "priority": "high"
  }
}
```

### 3. Work Item Tracking (→ `.beads/status.jsonl`)
Each agent spawned by Phase Builder creates a work item (status bead):
```json
{
  "id": "auth_agent_phase1",
  "timestamp": "2026-05-17T22:30:00Z",
  "type": "status",
  "status": "open",
  "phase": "1",
  "agent": "phase-builder",
  "title": "Auth Agent: Implement server/auth.js",
  "body": "JWT verification, bcrypt hashing, role-based guards",
  "metadata": {
    "assigned_files": ["server/auth.js", "server/db.js"],
    "priority": "high"
  }
}
```

Agent updates status during execution:
- `status: open` → work item created
- `status: in_progress` → agent begins work
- `status: closed` → agent completes, tests pass

### 4. SessionStart Injection
On next session, SessionStart hook injects open beads as context:
```
Open Work Items from Previous Session:
- Auth Agent: Implement server/auth.js
- Task Manager Agent: Schema + CRUD routes
- Frontend Agent: React components + routing
```

This allows work to resume seamlessly after context reset.

### 5. Stop Hook Reminders
On session end, Stop hook reminds about unclosed beads:
```
⚠️  Note: 3 unclosed bead(s) in .beads/status.jsonl
Consider closing them before next session:
  - Auth Agent: Implement server/auth.js (id: auth_agent_phase1)
  - Task Manager Agent: Schema + CRUD routes (id: tm_agent_phase1)
  - Frontend Agent: React components + routing (id: fe_agent_phase1)
```

### 6. Bead Lifecycle
```
Phase N starts
  → Phase Builder opens beads for all agents
  → Agents update status → in_progress
  → Evaluators assess, Board votes
  → IF APPROVE: close all agent beads
  → IF REMEDIATE: open failure bead, agents continue
  → IF ESCALATE: open failure bead, await human decision
```

### 7. Cross-Session Durability
Because beads are append-only JSONL files (not in-memory):
- Work survives context resets (SessionStart injects open beads)
- Board decisions are recorded (decisions.jsonl)
- Issues are tracked (failures.jsonl)
- No work is lost between sessions
