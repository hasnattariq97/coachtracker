---
phase: "9"
status: "active"
owner: "subagent-driven-development"
last_updated: "2026-06-09T15:00:00Z"
beads: []
---

# Phase 9 Agent Handoff: Autonomous Multi-Agent Coaching System

## Quick Context

You're implementing **Phase 9: Autonomous Multi-Agent Coaching System** for Coach Task Tracker.

**What's this project?**
- Web app for admins to assign coaching tasks to coaches
- Coaches complete tasks and get notifications
- Phase 9 adds: autonomous monitoring agents that run 24/7

**What are YOU building?**
Three AI agents that work 24/7:
1. **Monitoring Agent** — Detects when coaches are stuck, behind deadline, or missing data
2. **Support Agent** — Takes proactive action (tags coaches in Google Sheets, sends emails)
3. **Reporting Agent** — Generates daily performance reports with pattern analysis

**Why this matters?** Admin won't have to check dashboard anymore. Agents handle everything.

---

## Before You Start

### 1. Read the Design Document

👉 **CRITICAL:** Read this first:
```
docs/superpowers/specs/2026-06-09-phase9-autonomous-coaching-design.md
```

This 724-line document explains:
- How the three agents work
- What data they read/write
- Communication channels (sheets, email, in-app)
- Error handling
- Database schema
- Daily reports

**Time:** 15-20 minutes. Worth it.

### 2. Read the Implementation Plan

👉 Read the task breakdown:
```
docs/superpowers/plans/2026-06-09-phase9-autonomous-coaching-plan.md
```

This explains:
- 8 major tasks (40+ git commits)
- Exact code for each task
- Test requirements (RED-GREEN-REFACTOR)
- Commit messages

**Time:** 10-15 minutes.

### 3. Understand the Codebase Structure

**Key directories:**
```
server/
├── agents/                    ← Where you'll add new files
├── services/                  ← Helper clients (Google Sheets, etc.)
├── db.js                      ← Database initialization
├── cron.js                    ← Job scheduling
├── __tests__/                 ← All tests go here
└── index.js                   ← Express server
```

**Tech stack already built (reuse these):**
- **Ruflo** — Multi-agent orchestrator (Phase 7) → use for agent coordination
- **AgentDB** — Shared agent state (Phase 7) → agents write to shared namespaces
- **Groq API** — LLM (Phase 7) → agents use for intelligent decisions
- **node-cron** — Job scheduler → already running, just add new schedules
- **Email queue** — Phase 8 → already built, just call `queEmail()`
- **PostgreSQL** — Railway → all data persisted

---

## Your Task: Execute the Plan

You'll execute **8 tasks** in order. Each task is 2-5 minutes.

### Task Execution Rules

1. **Read the plan first** — Every task has exact code, not descriptions
2. **Test-first (RED-GREEN-REFACTOR)** — Write failing test before implementing
3. **Commit after every step** — Small, frequent commits (git history is important)
4. **All tests must pass** — Run tests before committing
5. **No placeholders** — Every step is complete code, not "TBD"

### How to Execute

Use the `subagent-driven-development` skill:

```bash
# Launch a subagent for each task
/subagent-driven-development

# Tell it:
"Implement Task 1 from docs/superpowers/plans/2026-06-09-phase9-autonomous-coaching-plan.md
- Create server/db-migrations/phase9-schema.js
- Add migration runner to server/db.js
- Test database initialization
- Commit with message provided in plan

Follow exact code from plan. No changes. All tests must pass before commit."
```

### Expected Output Per Task

For each task, you should see:
- ✅ Tests written (RED stage)
- ✅ Tests fail with expected error
- ✅ Implementation written
- ✅ Tests pass (GREEN stage)
- ✅ Code committed with exact message from plan
- ✅ Move to next task

---

## Critical Success Criteria

### Before Moving to Task 2

- [ ] `server/db-migrations/phase9-schema.js` created with all 5 tables
- [ ] `server/db.js` modified to call `migratePhase9()`
- [ ] Database initializes without errors
- [ ] Git commit made with exact message from plan

### Before Moving to Task 3

- [ ] `server/services/google-sheets-client.js` created and exported
- [ ] Tests in `server/__tests__/services/google-sheets-client.test.js` pass
- [ ] `npm install googleapis` run (if not already present)
- [ ] Git commit made

### And so on for each task...

---

## Command Reference

### Running Tests

```bash
cd server

# Test specific file
npm test -- monitoring-agent.test.js

# Test all
npm test

# Watch mode (re-run on changes)
npm test -- --watch

# Verbose output
npm test -- --verbose
```

### Checking Database

```bash
# SQLite shell
sqlite3 server/tracker.db

# Query monitoring tables
sqlite3 server/tracker.db "SELECT * FROM monitoring_snapshots;"
sqlite3 server/tracker.db "SELECT * FROM sheet_comments;"
```

### Git Workflow

```bash
# Stage and commit
git add <files from task>
git commit -m "<exact message from plan>"

# View recent commits
git log --oneline -10

# See what changed
git diff HEAD~1
```

### Installing Dependencies

```bash
cd server

# Add new npm package if needed
npm install googleapis  # for Google Sheets API
```

---

## Troubleshooting

### Test Fails: "module not found"

**Problem:** You forgot to export the module

**Fix:** Check end of file has:
```javascript
module.exports = { monitoringAgent: new MonitoringAgent() };
```

### Test Fails: "Cannot find table monitoring_snapshots"

**Problem:** Database migration didn't run

**Fix:** 
1. Check `server/db.js` actually calls `migratePhase9(db)`
2. Check `server/db-migrations/phase9-schema.js` has `db.exec()` calls
3. Run database initialization test manually

### Test Fails: "Database is locked"

**Problem:** Another process holds the database

**Fix:**
```bash
# Kill all Node processes
taskkill /IM node.exe /F

# Run tests again
npm test
```

### Git Commit Fails: "nothing to commit"

**Problem:** Forgot to stage files

**Fix:**
```bash
git add server/agents/monitoring-agent.js server/__tests__/agents/monitoring-agent.test.js
git commit -m "..."
```

---

## Important: Dependencies Already Built

**DO NOT REBUILD THESE** — they already exist:

✅ Ruflo orchestrator → use it for agent coordination
✅ AgentDB → agents write shared state to `phase-9-*` namespaces
✅ Groq API → import `require('../services/groq-client')`
✅ Email queue → import `require('../services/email-service').queEmail`
✅ node-cron → already scheduling, just add to cron.js
✅ Google Sheets API → `npm install googleapis` (might already be there)

---

## Questions You Might Have

### Q: What if the plan code doesn't work?

**A:** The plan code has been tested. If it doesn't work:
1. Check you copied it exactly (no typos)
2. Check you're in the right directory (`server/`)
3. Check all imports are correct
4. Run the specific test and read the error message

### Q: Should I refactor the code?

**A:** No. Follow the plan exactly. Refactoring can happen in Phase 9b.

### Q: What if a test is unclear?

**A:** Run the test first (`npm test`). Read the error message. It tells you what's expected.

### Q: Can I skip a task?

**A:** No. Tasks build on each other. Task 2 (Google Sheets) is used by Task 3 (Monitoring).

### Q: How long should this take?

**A:** ~3-4 weeks if executing sequentially. Each task takes 2-5 minutes to implement, but you'll want to understand the design between tasks.

---

## What Success Looks Like

After completing all 8 tasks, you should have:

✅ 5 new database tables (monitoring, support, reporting, errors, reports)
✅ Google Sheets client (read + comment)
✅ 3 intelligent agents (Monitoring, Support, Reporting)
✅ Agent orchestration runner (Ruflo)
✅ Cron scheduling (every 30 min + daily 9am)
✅ 17+ tests, all passing
✅ 40+ git commits with clear messages
✅ Full documentation (agent behavior guide)

**System works:** Admin assigns task → agents monitor → admin gets daily report

---

## Next Steps

1. **Read the design doc** (15 min): `docs/superpowers/specs/2026-06-09-phase9-autonomous-coaching-design.md`
2. **Read the plan** (10 min): `docs/superpowers/plans/2026-06-09-phase9-autonomous-coaching-plan.md`
3. **Use subagent-driven-development skill** to start Task 1
4. **Follow exact code from plan** — no improvisation
5. **Test before commit** — RED-GREEN-REFACTOR always
6. **Commit with exact message from plan** — git history matters

---

## Contact/Escalation

If you get stuck:
1. Re-read the plan section for that task
2. Check the troubleshooting guide above
3. Run the test and read the error message
4. Search for similar patterns in existing code (e.g., how Phase 8 does email)

Good luck! 🚀
