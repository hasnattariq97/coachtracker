# Superpowers Workflow — Coach Task Tracker

This project uses the Superpowers development methodology: **Brainstorm → Design → Plan → Execute → Review**.

## The Workflow

### 1. Brainstorm & Design
When given a feature request or bug:
1. Ask clarifying questions
2. Understand the requirements fully
3. Propose 2-3 design approaches with tradeoffs
4. Get user approval before proceeding

**Tools:** Conversation, no code yet.

### 2. Plan (EnterPlanMode)
For non-trivial tasks (>1 file, >30 minutes):
1. Use `/plan` to enter planning mode
2. Research the codebase (read relevant files, understand architecture)
3. Design step-by-step implementation strategy
4. Identify critical files and dependencies
5. Present plan for user approval before coding

**When to use:**
- New features (Phase 1-5)
- Refactors across multiple files
- Complex bug fixes
- Security changes

**When NOT to use:**
- Single-file changes
- Typos or one-liners
- Straightforward API endpoints

### 3. Execute with Tests (Red-Green-Refactor)
Test-first development ensures correctness:

**RED:** Write failing test first
```javascript
// Specify what should happen
test('POST /api/coaches creates coach with hashed password', () => {
  // Test implementation
});
```

**GREEN:** Write minimal code to pass test
```javascript
// Implement the endpoint
app.post('/api/coaches', (req, res) => { ... });
```

**REFACTOR:** Improve code without breaking tests
```javascript
// Extract to helper, improve error handling
```

**Tools:** `/skill-testing` before writing tests.

### 4. Execute via Subagents
For complex implementation:
- Break into 2-5 minute tasks
- Use Agent tool with specialized subagents
- Parallel execution where possible
- Track progress with TodoWrite

**Subagents available:**
- `Explore` — find code by pattern
- `Plan` — design architecture
- `general-purpose` — multi-step tasks
- `security-reviewer` — security audit

### 5. Code Review (Two-Stage)

**Stage 1: Spec Compliance**
- ✅ Does implementation match the plan?
- ✅ All subtasks completed?
- ✅ Tests passing (RED-GREEN-REFACTOR)?

**Stage 2: Code Quality**
- ✅ Follows conventions (CLAUDE.md)
- ✅ No security vulnerabilities
- ✅ Performance acceptable
- ✅ Error handling correct

**Tools:** `/security-reviewer` for automated checks.

---

## Example: Adding a Feature

### Before: Without Superpowers
```
User: Add email notifications
Claude: Writes email code immediately
Result: Might miss requirements, no tests, security issues
```

### After: With Superpowers
```
User: Add email notifications

BRAINSTORM
Claude: What's the frequency? Which events? Retry logic? Template format?
User: Every completion, include task title, 3 retries

DESIGN
Claude: Option A: Nodemailer + queue. Option B: SendGrid API. Option C: External service.
User: SendGrid, async sending

PLAN (/plan)
Claude: Research SendGrid SDK, design task flow, identify 4 files to change
User: ✅ Approved

RED-GREEN-REFACTOR
Claude: Write failing test → implement → refactor
All tests green ✅

REVIEW (/security-reviewer)
Claude: Audit email template (XSS), API key handling, rate limits
User: ✅ Approved

COMMIT
Branch merged, feature shipped
```

---

## Conventions with Superpowers

### Testing
- **Backend:** Jest with real SQLite (in-memory)
- **Frontend:** React Testing Library + Vitest
- **Coverage:** 80%+ for critical paths (auth, notifications)
- **Pattern:** One test file per route/component

### Code Review Checklist
- [ ] Tests written first (RED-GREEN-REFACTOR)
- [ ] All tests passing
- [ ] No security vulnerabilities
- [ ] Follows CLAUDE.md conventions
- [ ] No commented-out code
- [ ] Error messages coaching-tone
- [ ] No password_hash in responses

### Commit Messages
```
[Phase #] Brief description

RED-GREEN-REFACTOR
- RED: describe failing test
- GREEN: implement
- REFACTOR: improve

Closes #123 (if applicable)
```

---

## When to Skip Brainstorm/Design

**Single-file, obvious fixes:**
```
User: "Change assignedAt to assigned_at in tasks.js"
Claude: Just does it (no brainstorm needed)
```

**One-liner updates:**
```
User: "Add description field to coaches table"
Claude: Writes migration (no plan needed)
```

**Follow-up tasks with approved plan:**
```
User: "Implement step 3 from the plan we approved"
Claude: Executes with confidence (plan already approved)
```

---

## Tools & Skills

Use these before implementing:

| Task | Skill |
|------|-------|
| Auth (JWT, bcrypt) | `/skill-auth` |
| Database (SQLite) | `/skill-db` |
| API routes (Express) | `/skill-api` |
| Frontend (React) | `/skill-frontend` |
| Notifications | `/skill-notifications` |
| Cron jobs | `/skill-cron` |
| **Testing** | `/skill-testing` |
| Security review | `/security-reviewer` |

---

## Phases with Superpowers

Each phase follows: **Brainstorm → Design → Plan → Execute (RED-GREEN-REFACTOR) → Review**

- **Phase 1:** Auth system (login, JWT, role guards)
- **Phase 2:** Coach CRUD (create, read, update, delete)
- **Phase 3:** Task assignment (with tests)
- **Phase 4:** Coach dashboard (UI tests)
- **Phase 5:** Notifications (idempotency tests)
- **Phase 6:** Polish & security audit

See [@docs/ROADMAP.md](ROADMAP.md) for details.

---

## Quick Start: Use This Now

Next time you work on a task:

1. **Read the phase** in [@docs/ROADMAP.md](ROADMAP.md)
2. **Ask clarifying questions** if needed (BRAINSTORM)
3. **For big tasks:** Say `/plan` to enter planning mode (DESIGN + PLAN)
4. **Read the skill** (e.g., `/skill-auth`)
5. **Write failing test first** (RED)
6. **Implement to pass test** (GREEN)
7. **Refactor** (REFACTOR)
8. **Use `/security-reviewer`** for code audit (REVIEW)

Questions? Read [@CLAUDE.md](../CLAUDE.md) or [@docs/CONTRIBUTING.md](CONTRIBUTING.md).
