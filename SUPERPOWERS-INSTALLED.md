# Superpowers Framework — Fully Installed ✅

**Complete Superpowers integration from https://github.com/obra/superpowers**

Date installed: 2026-05-17

---

## What's Installed

### 🎯 Superpowers Methodology Skills (14 skills)

| Skill | Purpose |
|-------|---------|
| `/using-superpowers` | **START HERE** — Learn how to use superpowers |
| `/brainstorming` | Explore requirements, propose designs |
| `/writing-plans` | Write multi-step implementation plans |
| `/test-driven-development` | RED-GREEN-REFACTOR cycle |
| `/subagent-driven-development` | Execute plans with independent agents |
| `/dispatching-parallel-agents` | Run 2+ independent tasks in parallel |
| `/systematic-debugging` | Root-cause analysis for bugs |
| `/verification-before-completion` | Verify work before claiming done |
| `/requesting-code-review` | Request structured code review |
| `/receiving-code-review` | Handle review feedback rigorously |
| `/using-git-worktrees` | Isolated workspace management |
| `/finishing-a-development-branch` | Complete and integrate work |
| `/executing-plans` | Execute written plans in separate session |
| `/writing-skills` | Create or edit custom skills |

### 📚 Project-Specific Skills (7 skills)

| Skill | Purpose |
|-------|---------|
| `/skill-auth` | JWT + bcrypt patterns |
| `/skill-db` | SQLite patterns |
| `/skill-api` | Express conventions |
| `/skill-frontend` | React + Vite patterns |
| `/skill-notifications` | Coaching tone messages |
| `/skill-cron` | Idempotent job patterns |
| `/skill-testing` | Testing patterns (custom) |

### 🔧 Hooks

Installed in `.claude/hooks/`:
- `session-start` — Initialize superpowers session
- `hooks.json` — Hook configuration
- `run-hook.cmd` — Hook runner
- Plus your existing project hooks

---

## How to Use Superpowers Now

### Step 1: Read the Framework Guide
```
/using-superpowers
```
This tells you how to navigate and use all 14 superpowers skills.

### Step 2: For Any Feature/Bug, Follow This Cycle

1. **BRAINSTORM**
   ```
   /brainstorming
   Ask questions, explore intent, propose designs
   ```

2. **PLAN** (for complex tasks)
   ```
   /writing-plans
   Design 2-5 minute tasks, write specification
   ```

3. **EXECUTE**
   ```
   /test-driven-development
   RED-GREEN-REFACTOR: test first, then code
   ```
   
   For parallel work:
   ```
   /dispatching-parallel-agents
   Run 2+ independent tasks together
   ```
   
   For large plans:
   ```
   /subagent-driven-development
   Execute with checkpoints and reviews
   ```

4. **VERIFY**
   ```
   /verification-before-completion
   Confirm tests pass before marking done
   ```

5. **REVIEW**
   ```
   /requesting-code-review
   Get structured review before merge
   ```

### Step 3: Use Project Skills When Needed

```
/skill-auth        (before auth work)
/skill-db          (before database work)
/skill-api         (before API routes)
/skill-frontend    (before React work)
/skill-notifications (before notifications)
/skill-cron        (before cron jobs)
/skill-testing     (before writing tests)
```

---

## Example: Build Phase 1 (Auth System)

### 1. START
```
/using-superpowers
→ Understand the framework
```

### 2. BRAINSTORM
```
/brainstorming
"What's needed for Phase 1 auth?"
→ Clarify endpoints, token expiry, storage
```

### 3. PLAN
```
/writing-plans
"Outline Phase 1 auth implementation"
→ Design: server/db.js, server/auth.js, routes/auth.js
→ 5 tasks, each 2-5 minutes
```

### 4. EXECUTE
```
/test-driven-development
→ Learn RED-GREEN-REFACTOR pattern

/skill-auth
→ Learn JWT + bcrypt patterns

/skill-db
→ Learn SQLite setup

# Write test → fail → implement → pass → refactor
npm test -- --watch
```

### 5. VERIFY
```
/verification-before-completion
→ Confirm all tests pass
→ Check no password_hash in responses
```

### 6. REVIEW
```
/requesting-code-review
→ Get security review
→ Verify error handling
```

---

## Key Commands

| When | What to Do |
|------|-----------|
| Starting any task | `/using-superpowers` then `/brainstorming` |
| Understanding requirements | `/brainstorming` |
| Planning implementation | `/writing-plans` |
| Writing code | `/test-driven-development` |
| Debugging | `/systematic-debugging` |
| Parallel tasks | `/dispatching-parallel-agents` |
| Large plans | `/subagent-driven-development` |
| Before completion | `/verification-before-completion` |
| Before merging | `/requesting-code-review` |
| Isolated work | `/using-git-worktrees` |

---

## File Structure

```
.claude/
├── skills/
│   ├── brainstorming/                ← Explore requirements
│   ├── test-driven-development/      ← RED-GREEN-REFACTOR
│   ├── writing-plans/                ← Implementation planning
│   ├── subagent-driven-development/  ← Execute with agents
│   ├── systematic-debugging/         ← Debug methodically
│   ├── verification-before-completion/ ← Verify work
│   ├── requesting-code-review/       ← Request review
│   ├── receiving-code-review/        ← Handle feedback
│   ├── dispatching-parallel-agents/  ← Parallel execution
│   ├── using-git-worktrees/          ← Worktree management
│   ├── finishing-a-development-branch/ ← Branch completion
│   ├── executing-plans/              ← Execute plans
│   ├── writing-skills/               ← Custom skills
│   ├── using-superpowers/            ← Framework guide
│   ├── skill-auth/                   ← JWT patterns
│   ├── skill-db/                     ← SQLite patterns
│   ├── skill-api/                    ← Express patterns
│   ├── skill-frontend/               ← React patterns
│   ├── skill-notifications/          ← Notifications
│   ├── skill-cron/                   ← Cron patterns
│   └── skill-testing/                ← Testing patterns
├── hooks/
│   ├── session-start                 ← Initialize session
│   ├── hooks.json                    ← Configuration
│   └── run-hook.cmd                  ← Hook runner
└── settings.json                     ← Permissions
```

---

## Documentation Files

- **[@SUPERPOWERS-CLAUDE.md](SUPERPOWERS-CLAUDE.md)** — Original superpowers CLAUDE.md
- **[@SUPERPOWERS-INSTALLED.md](SUPERPOWERS-INSTALLED.md)** — This file (what you have)
- **[@docs/SUPERPOWERS.md](docs/SUPERPOWERS.md)** — Project-adapted guide
- **[@docs/SUPERPOWERS-QUICK-START.md](docs/SUPERPOWERS-QUICK-START.md)** — Quick examples
- **[@README.md](README.md)** — Project overview

---

## Next: Start Phase 1

When ready to implement Phase 1 (Auth System):

1. Read `/using-superpowers` (5 min)
2. Use `/brainstorming` to clarify requirements (2 min)
3. Use `/writing-plans` to design implementation (5 min)
4. Use `/test-driven-development` to execute (30 min)
5. Use `/verification-before-completion` to verify (2 min)
6. Use `/requesting-code-review` to review (5 min)

---

## Questions?

- **"How do I use superpowers?"** → `/using-superpowers`
- **"How do I brainstorm?"** → `/brainstorming`
- **"How do I write a plan?"** → `/writing-plans`
- **"How do I test-first?"** → `/test-driven-development`
- **"I have a bug"** → `/systematic-debugging`
- **"I'm done, how do I verify?"** → `/verification-before-completion`

---

**Superpowers fully installed and ready to use!** 🚀
