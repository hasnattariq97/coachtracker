# Claude Code Architecture — Coach Task Tracker

This file documents how Claude Code is configured for this project per Anthropic best practices.

## Project Brain (CLAUDE.md)

`CLAUDE.md` is auto-loaded every session and contains:
- Project overview (1 sentence)
- Tech stack (5 lines)
- Key commands (3 lines)
- Code conventions (5 lines)
- How to use this project (link to skills, docs)

**Why short?** Long CLAUDE.md files cause Claude to ignore rules because they get lost in noise.

## Persistent Knowledge (docs/)

Team knowledge committed to git:
- `docs/ARCHITECTURE.md` — Why we chose SQLite, JWT, node-cron
- `docs/ROADMAP.md` — Phase-by-phase build checklist
- `docs/CONTRIBUTING.md` — Git workflow, conventions, debugging
- `docs/API.md` — Complete API endpoint reference

**Why separate?** These don't need to be re-read every session. They're referenced as needed. No context bloat.

## Skills (. claude/skills/)

Domain knowledge loaded on-demand:

| Skill | When to Use |
|-------|-----------|
| `/skill-auth` | Before auth work (JWT, bcrypt, middleware) |
| `/skill-db` | Before database work (schema, queries, transactions) |
| `/skill-api` | Before API routes (Express, validation, errors) |
| `/skill-frontend` | Before React work (components, hooks, polling) |
| `/skill-notifications` | Before notification work (DB table, messages, polling) |
| `/skill-cron` | Before cron jobs (midpoint, overdue, idempotency) |

**Why skills?** They're loaded on-demand, not in every session. No context waste. When Claude reads a skill file, it gains context only for that area.

Each skill is in `.claude/skills/skill-name/SKILL.md` with frontmatter:
```markdown
---
name: skill-auth
description: JWT + bcrypt auth patterns
---
```

## Agents (. claude/agents/)

Specialized subagents for isolated tasks:

| Agent | Purpose |
|-------|---------|
| `security-reviewer` | Review code for vulnerabilities, auth bypass, XSS, SQL injection |

**Why agents?** They run in separate context. Reviews don't clutter main session.

Usage: `use /security-reviewer to review this code for vulnerabilities`

## Hooks (.claude/hooks/)

Automatic enforcement at lifecycle events:

| Hook | When | Purpose |
|------|------|---------|
| `pre-tool-use.sh` | Before any tool call | Block `rm -rf /`, `git push --force` |
| `post-tool-use.sh` | After any tool call | Log to `.claude/audit.log` |
| `on-stop.sh` | When Claude stops | Prompt to update `.claude/session-log.md` |

**Why hooks?** They're deterministic. Unlike CLAUDE.md instructions (advisory), hooks guarantee the action happens.

## Settings (. claude/settings.json)

Configuration for permissions, env vars, and hooks:
- `permissions.allow` — safe commands (npm, git status, node)
- `permissions.deny` — dangerous commands (rm -rf, git push --force)
- `env` — NODE_ENV, PORT, REACT_PORT
- `hooks` — maps events to scripts

## Session Log (.claude/session-log.md)

After each session, append:
```
## Session YYYY-MM-DD
### Completed
- [task]
### Next
- [first unchecked [ ] in docs/ROADMAP.md]
```

**Why?** Persistent record of progress. Helps Claude context in next session.

---

## How Claude Code Works This Project

### Session Start
1. Read CLAUDE.md (project brain, navigation)
2. Read docs/ROADMAP.md (find next unchecked task)
3. Read relevant skill (e.g., `/skill-auth`)
4. Implement, checking off [ ] boxes

### Safeguards
- Hooks block dangerous commands (pre-tool-use)
- Hooks log all tool calls (post-tool-use)
- Hooks prompt session summary (on-stop)

### Specialized Tasks
- Code review: use `/security-reviewer`
- Investigation: use subagents to keep main session clean

### Context Management
- Skills load on-demand (no bloat)
- Docs are persistent but not in every session
- Session log tracks progress
- `/clear` between unrelated tasks

---

## File Organization

```
.claude/
├── ARCHITECTURE.md          ← This file
├── settings.json            ← Permissions, env vars, hooks config
├── session-log.md          ← Append after each session
├── audit.log               ← Auto-generated, gitignored
│
├── hooks/
│   ├── pre-tool-use.sh     ← Block dangerous commands
│   ├── post-tool-use.sh    ← Log all tool calls
│   └── on-stop.sh          ← Prompt session summary
│
├── skills/
│   ├── skill-auth/SKILL.md
│   ├── skill-db/SKILL.md
│   ├── skill-api/SKILL.md
│   ├── skill-frontend/SKILL.md
│   ├── skill-notifications/SKILL.md
│   └── skill-cron/SKILL.md
│
└── agents/
    └── security-reviewer.md
```

---

## Extending This Architecture

### Add a New Skill
1. Create `.claude/skills/skill-name/SKILL.md`
2. Add frontmatter with name, description
3. Write patterns and examples
4. Claude auto-discovers it

### Add a New Agent
1. Create `.claude/agents/agent-name.md`
2. Add frontmatter with name, description, tools, model
3. Write system prompt for the agent
4. Use: `use agent-name to [task]`

### Add a New Hook
1. Create `.claude/hooks/my-hook.sh`
2. Add entry to settings.json under appropriate event
3. Hook receives JSON via stdin, outputs JSON to stdout

---

## Philosophy

This architecture follows **Anthropic Claude Code best practices**:

1. **Small CLAUDE.md** — Reduces noise, improves rule adherence
2. **On-demand skills** — Only context you need, when you need it
3. **Persistent docs** — Knowledge shared with team, committed to git
4. **Deterministic hooks** — Safety guaranteed, not advisory
5. **Separation of concerns** — Codebase, docs, knowledge, automation each in right place

See the official [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) for full philosophy.

---

## References

- [@CLAUDE.md](../CLAUDE.md) — Project brain (start here)
- [@README.md](../README.md) — Quick start & features
- [@docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — System design (why SQLite, JWT, node-cron)
- [@docs/ROADMAP.md](../docs/ROADMAP.md) — Phase checklist
- [@docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md) — Development workflow
- [@docs/API.md](../docs/API.md) — API endpoints
