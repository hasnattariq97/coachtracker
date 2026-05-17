# Architecture Structure Guide

## Complete File Structure (After Reorganization)

```
d:\Cursor_new\
│
├── 📄 CLAUDE.md                              ← Project brain (start here every session)
├── 📄 README.md                              ← Quick start & features
├── 📄 REORGANIZATION_SUMMARY.md              ← Why we reorganized
├── 📄 STRUCTURE_GUIDE.md                     ← This file
├── 📄 .gitignore                             ← What not to commit
│
├── 📁 docs/                                  ← Persistent team knowledge (committed)
│   ├── 📄 ARCHITECTURE.md                    ← Design decisions (SQLite, JWT, node-cron)
│   ├── 📄 ROADMAP.md                         ← Phase-by-phase checklist (Phase 0-6)
│   ├── 📄 CONTRIBUTING.md                    ← Git workflow, conventions, debugging
│   └── 📄 API.md                             ← API endpoint reference
│
├── 📁 .claude/                               ← Claude Code system configuration
│   │
│   ├── 📄 ARCHITECTURE.md                    ← This project's Claude setup
│   ├── 📄 settings.json                      ← Permissions, env vars, hooks config
│   ├── 📄 session-log.md                     ← Append after each session
│   ├── 📄 audit.log                          ← Auto-generated, shows all tool calls
│   │
│   ├── 📁 hooks/                             ← Safety enforcement scripts
│   │   ├── pre-tool-use.sh                   ← Blocks rm -rf, git push --force
│   │   ├── post-tool-use.sh                  ← Logs every tool call
│   │   └── on-stop.sh                        ← Prompts session summary
│   │
│   ├── 📁 skills/                            ← Domain knowledge (on-demand loading)
│   │   ├── skill-auth/
│   │   │   └── SKILL.md                      ← JWT + bcrypt patterns
│   │   ├── skill-db/
│   │   │   └── SKILL.md                      ← SQLite schema & query patterns
│   │   ├── skill-api/
│   │   │   └── SKILL.md                      ← Express route conventions
│   │   ├── skill-frontend/
│   │   │   └── SKILL.md                      ← React + Vite + Tailwind patterns
│   │   ├── skill-notifications/
│   │   │   └── SKILL.md                      ← Notification system patterns
│   │   └── skill-cron/
│   │       └── SKILL.md                      ← node-cron nudge job patterns
│   │
│   └── 📁 agents/
│       └── security-reviewer.md              ← Specialized security review agent
│
├── 📁 server/                                ← Node.js + Express backend (Phase 1+)
│   ├── index.js
│   ├── db.js
│   ├── auth.js
│   ├── cron.js
│   ├── .env                                  ← JWT_SECRET (gitignored)
│   ├── tracker.db                            ← SQLite database (gitignored)
│   └── routes/
│       ├── auth.js
│       ├── coaches.js
│       ├── tasks.js
│       └── notifications.js
│
├── 📁 client/                                ← React + Vite frontend (Phase 1+)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/
│   │   ├── components/
│   │   └── layout/
│   └── public/
│
├── 📁 skills/                                ← OLD: root-level skills (DEPRECATED)
│   └── (These files are superseded by .claude/skills/)
│
├── DECISION.md                               ← OLD: Use docs/ARCHITECTURE.md instead
├── MEMORY.md                                 ← OLD: Merged into CLAUDE.md + docs/
└── PLANNING.md                               ← OLD: Use docs/ROADMAP.md instead
```

---

## How to Use This Structure

### Every Session Start
1. **Read CLAUDE.md** (2 min) — Project overview, how to use
2. **Read docs/ROADMAP.md** (1 min) — Find next unchecked [ ] task
3. **Read relevant skill** (5-10 min) — `/skill-auth`, `/skill-api`, etc.
4. **Implement** — Check off tasks as you complete them
5. **Append to .claude/session-log.md** — Summary when done

### When Stuck
- **Debugging?** Read docs/CONTRIBUTING.md ("Debugging" section)
- **Git workflow?** Read docs/CONTRIBUTING.md ("Git Workflow" section)
- **API question?** Read docs/API.md (endpoint reference)
- **Design question?** Read docs/ARCHITECTURE.md (why each choice)

### For Code Review
- Use `/security-reviewer` to review code for vulnerabilities
- Example: `use /security-reviewer to review the auth routes for XSS and auth bypass`

### For Investigation
- Use subagents to explore without bloating main session
- Example: `use a subagent to investigate how our auth system handles token refresh`

---

## Key Files at a Glance

| File | Purpose | Read When |
|------|---------|-----------|
| CLAUDE.md | Project brain | Every session start |
| README.md | Quick start & features | First time setup |
| docs/ARCHITECTURE.md | Design decisions | Understanding "why" |
| docs/ROADMAP.md | Phase checklist | Finding next task |
| docs/CONTRIBUTING.md | Development guidelines | Before committing code |
| docs/API.md | Endpoint reference | Building API routes |
| .claude/skills/skill-*/SKILL.md | Implementation patterns | Before implementing feature |
| .claude/agents/security-reviewer.md | Security review process | Before code review |
| .claude/settings.json | Permissions & hooks | Configuring Claude Code |

---

## Old Files (Deprecated)

These files are superseded and can be deleted once Phase 1+ is complete:

- `skills/skill-*.md` (7 files) → Moved to `.claude/skills/skill-*/SKILL.md`
- `DECISION.md` → Moved to `docs/ARCHITECTURE.md`
- `MEMORY.md` → Merged into CLAUDE.md + docs/
- `PLANNING.md` → Moved to `docs/ROADMAP.md`
- `SESSION_LOG.md` → Moved to `.claude/session-log.md`
- `REORGANIZATION_SUMMARY.md` → Reference only, can delete

---

## Philosophy

This structure follows **Anthropic Claude Code Best Practices**:

1. **CLAUDE.md < 100 lines** — Reduces noise, improves rule adherence
2. **Skills on-demand** — Only load context when needed
3. **Docs persistent** — Shared with team, committed to git
4. **Hooks deterministic** — Safety guaranteed
5. **Separation of concerns** — Each type in right place

See the official [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) for full rationale.

---

## Starting Phase 1

1. You're at Phase 0 ✅ (scaffold complete)
2. Next: Phase 1 (Auth System)
3. Read: [@docs/ROADMAP.md](docs/ROADMAP.md) "## Phase 1 — Auth System"
4. Use: `/skill-auth` and `/skill-db` before starting
5. Implement: Backend init, DB, login route, frontend auth
6. Verify: POST /api/auth/login returns JWT ✅

---

**Questions?** Read [@CLAUDE.md](CLAUDE.md) or [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

**Ready?** Start Phase 1 in [@docs/ROADMAP.md](docs/ROADMAP.md).
