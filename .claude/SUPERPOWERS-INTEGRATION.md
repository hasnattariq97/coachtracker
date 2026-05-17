# Superpowers Integration — Complete ✅

This document summarizes how Superpowers has been integrated into the Coach Task Tracker project.

## What Is Superpowers?

**Superpowers** is a development methodology: **Brainstorm → Design → Plan → Execute (RED-GREEN-REFACTOR) → Review**.

It emphasizes:
- ✅ Clarifying requirements before building
- ✅ Proposing designs with tradeoffs
- ✅ Planning architecture for complex changes
- ✅ Test-first development (RED-GREEN-REFACTOR)
- ✅ Systematic code review

---

## Integration Complete

### 1. Documentation ✅

| Document | Purpose |
|----------|---------|
| [@docs/SUPERPOWERS.md](../docs/SUPERPOWERS.md) | Full methodology (10 min read) |
| [@docs/SUPERPOWERS-QUICK-START.md](../docs/SUPERPOWERS-QUICK-START.md) | Examples & quick reference (5 min) |
| [@CLAUDE.md](../CLAUDE.md) | Updated with superpowers principles |
| [@README.md](../README.md) | Updated with workflow overview |
| [@docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md) | Updated with superpowers cycle |

### 2. Skills ✅

| Skill | Purpose |
|-------|---------|
| `/skill-auth` | JWT + bcrypt patterns |
| `/skill-db` | SQLite patterns |
| `/skill-api` | Express conventions |
| `/skill-frontend` | React + Vite patterns |
| `/skill-notifications` | Coaching tone messages |
| `/skill-cron` | Idempotent jobs |
| **`/skill-testing`** | **NEW: RED-GREEN-REFACTOR patterns** |

### 3. Agents ✅

| Agent | Purpose |
|-------|---------|
| `Plan` | Architecture planning (complex changes) |
| `Explore` | Code exploration by pattern |
| `security-reviewer` | Security audit before merge |
| `general-purpose` | Multi-step implementation |

### 4. Hooks (Ready) ✅

Hooks in `.claude/hooks/` can be configured for:
- Force tests before commits (coming in Phase 1 implementation)
- Check for password_hash in responses (security)
- Validate test coverage thresholds

### 5. Settings ✅

`.claude/settings.json` is ready for:
- Permissions (already configured)
- Hook automation (can be enabled per project)

---

## How to Use Superpowers in This Project

### For Every Task

1. **BRAINSTORM** (1 min)
   - Ask clarifying questions
   - Understand requirements

2. **DESIGN** (2 min)
   - Propose 2-3 approaches
   - Discuss tradeoffs
   - Get approval

3. **PLAN** (5 min, complex tasks only)
   - Use `/plan` for architecture review
   - Show multi-file implementation strategy
   - Get approval before coding

4. **EXECUTE** (RED-GREEN-REFACTOR)
   - Read the skill (e.g., `/skill-auth`)
   - RED: Write failing test
   - GREEN: Implement minimal code
   - REFACTOR: Improve without breaking tests

5. **REVIEW**
   - Use `/security-reviewer` for audit
   - Check code quality & security
   - Get approval to merge

### Example: Next Phase (Phase 1 — Auth System)

```
User: "Let's start Phase 1: implement auth"

BRAINSTORM
Claude: "Questions: which endpoints first? Do we seed an admin?
         Should JWT expire? Where to store tokens?"
User: "POST /api/auth/login first. Seed admin@tracker.com/admin123.
       JWT 24h expiry. localStorage on client."

DESIGN
Claude: "Option A: Auth in routes/auth.js
         Option B: Auth in middleware first
         I recommend A (simpler to start)."
User: "✓ Go with A"

PLAN (/plan)
Claude: /plan
  Research: better-sqlite3, jsonwebtoken, bcrypt setup
  Design: server/db.js (users table), server/auth.js (JWT verify),
          routes/auth.js (POST /api/auth/login)
  
User: "✓ Looks good"

EXECUTE (RED-GREEN-REFACTOR)
/skill-auth     (learn JWT + bcrypt patterns)
/skill-db       (learn SQLite patterns)
/skill-testing  (learn test patterns)

# RED: test/routes/auth.test.js
test('POST /api/auth/login returns JWT', () => { ... });
npm test → FAIL ✗

# GREEN: routes/auth.js
app.post('/api/auth/login', (req, res) => { ... });
npm test → PASS ✓

# REFACTOR
Extract to auth.js helper, improve error messages
npm test → PASS ✓

REVIEW
/security-reviewer
Check: password hashing, token in response, SQL injection, CORS
User: "✓ Ready to merge"

COMMIT
[Phase 1] Add POST /api/auth/login with JWT

RED: Test returns JWT on valid credentials
GREEN: Implement login endpoint with bcrypt
REFACTOR: Extract verify helper, add error handling
```

---

## Skills to Use Per Phase

| Phase | Skills |
|-------|--------|
| **Phase 1: Auth** | `/skill-auth`, `/skill-db`, `/skill-api`, `/skill-testing` |
| **Phase 2: Coaches** | `/skill-api`, `/skill-db`, `/skill-frontend`, `/skill-testing` |
| **Phase 3: Tasks** | `/skill-api`, `/skill-db`, `/skill-notifications`, `/skill-testing` |
| **Phase 4: Dashboard** | `/skill-frontend`, `/skill-testing` |
| **Phase 5: Notifications** | `/skill-notifications`, `/skill-cron`, `/skill-testing` |
| **Phase 6: Polish** | `/skill-frontend`, `/security-reviewer` |

---

## Key Principles

### 1. Test-First (RED-GREEN-REFACTOR)
```
❌ WRONG: Write code first, test later
✅ RIGHT: Write test, fail, implement, pass, refactor
```

### 2. Architecture Review (/plan)
```
❌ WRONG: Start coding immediately
✅ RIGHT: Use /plan for complex changes, get approval
```

### 3. Security Review (/security-reviewer)
```
❌ WRONG: Merge without review
✅ RIGHT: Run /security-reviewer before merging
```

### 4. Skill Reading
```
❌ WRONG: Guess patterns, make mistakes
✅ RIGHT: Read skill first, follow patterns
```

### 5. Idempotency in Notifications
```
❌ WRONG: Send notification every time
✅ RIGHT: Check if notification exists, don't send twice
```

---

## Commands in Your Workflow

| When | Command | Purpose |
|------|---------|---------|
| Planning complex task | `/plan` | Architecture review |
| Learning patterns | `/skill-auth`, `/skill-testing`, etc. | Skill reading |
| Writing tests | `npm test -- --watch` | RED-GREEN-REFACTOR |
| Code review | `/security-reviewer` | Security + quality audit |
| Finding code | `Agent(Explore)` | Search by pattern |

---

## What's New vs. Old Workflow

| Old | New (Superpowers) |
|-----|-------------------|
| Brainstorm in head | Ask questions, document requirements |
| Start coding | Use `/plan` for architecture |
| Code then test | RED-GREEN-REFACTOR: test first |
| Commit without review | Use `/security-reviewer` before merge |
| Guess patterns | Read `/skill-*` before implementing |

---

## Next Steps

1. ✅ Superpowers integrated
2. Start with Phase 1 (auth system)
3. Read [@docs/SUPERPOWERS.md](../docs/SUPERPOWERS.md) before first task
4. Use `/plan` for Phase 1 architecture
5. Read `/skill-auth` before implementing
6. Follow RED-GREEN-REFACTOR in `npm test`
7. Use `/security-reviewer` before marking Phase 1 complete

---

## Questions?

- **"How do I start?"** → Read [@docs/SUPERPOWERS-QUICK-START.md](../docs/SUPERPOWERS-QUICK-START.md)
- **"What about testing?"** → Read `/skill-testing` or [@docs/SUPERPOWERS.md](../docs/SUPERPOWERS.md#red-green-refactor-cycle)
- **"Which skill should I use?"** → Check the phase table above
- **"When do I skip brainstorm/design?"** → See [@docs/SUPERPOWERS.md](../docs/SUPERPOWERS.md#when-to-skip-brainstormdesign)

---

**Superpowers integration complete. Ready to build!** 🚀
