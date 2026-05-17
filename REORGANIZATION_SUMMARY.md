# Architecture Reorganization Summary

**Date**: 2026-05-08  
**Basis**: Anthropic Claude Code Best Practices (May 2026)

## What Changed

The project was reorganized from a monolithic root-level documentation structure to follow **Anthropic's official Claude Code best practices**, separating knowledge by purpose and scope.

## Before → After

| Content Type | Before | After |
|---|---|---|
| Project brain | CLAUDE.md | CLAUDE.md (slimmed to <100 lines) |
| Design decisions | DECISION.md (root) | docs/ARCHITECTURE.md |
| Phase checklist | PLANNING.md (root) | docs/ROADMAP.md |
| Development workflow | N/A | docs/CONTRIBUTING.md |
| API reference | N/A | docs/API.md |
| Skill files (7) | skills/skill-*.md (root) | .claude/skills/skill-*/SKILL.md (with frontmatter) |
| Session log | SESSION_LOG.md (root) | .claude/session-log.md |
| Memory facts | MEMORY.md (root) | Embedded in CLAUDE.md + docs/ |
| Security reviewer | N/A | .claude/agents/security-reviewer.md |

## New File Locations

### Project Brain
- **CLAUDE.md** — <100 lines, navigation only (Anthropic best practice)
- **README.md** — Quick start guide, feature overview
- **docs/** — Persistent team documentation (committed to git)

### Claude Code Automation
- **.claude/settings.json** — Permissions, env vars, hooks config
- **.claude/hooks/** — Safety enforcement (pre-tool-use, post-tool-use, on-stop)
- **.claude/skills/** — Domain knowledge, loaded on-demand per skill
- **.claude/agents/** — Specialized subagents (e.g., security-reviewer)
- **.claude/audit.log** — Generated audit trail (gitignored)

### Application Code
- **server/** — Node.js + Express backend
- **client/** — React + Vite frontend

---

## Why This Structure

### 1. CLAUDE.md Under 100 Lines
**Anthropic Finding**: Long CLAUDE.md files cause Claude to ignore important rules because they get lost in noise.

**Solution**: Keep CLAUDE.md as navigation only. Detailed knowledge goes in docs/ (persistent) or skills/ (on-demand).

### 2. Skills in .claude/skills/
**Anthropic Finding**: Skills should be discoverable, loadable on-demand, not cluttering every session.

**Solution**: Each skill in its own folder with frontmatter metadata (`name`, `description`). Claude loads them automatically when relevant.

### 3. Docs in Root docs/ Folder
**Anthropic Finding**: Team knowledge should be committed to git and persistent across sessions.

**Solution**: docs/ contains ARCHITECTURE, ROADMAP, CONTRIBUTING, API reference — no session bloat, shared with team.

### 4. Hooks in .claude/ (Not Root)
**Anthropic Finding**: Hooks are system-level automation, not project knowledge.

**Solution**: Keep in .claude/hooks/ with settings.json, separate from codebase and docs.

### 5. Agents for Specialized Tasks
**Anthropic Finding**: Subagents isolate complex reviews without cluttering main conversation.

**Solution**: .claude/agents/security-reviewer.md for dedicated security reviews.

---

## How Claude Uses This

### Per Session
1. Read CLAUDE.md (navigation, conventions)
2. Read docs/ROADMAP.md (find next task)
3. Use `/skill-auth` (or relevant skill) before implementing
4. Read docs/CONTRIBUTING.md (workflow)

### Hooks Automate
- `pre-tool-use.sh` — blocks dangerous commands (rm -rf, git push --force)
- `post-tool-use.sh` — logs every tool call to audit.log
- `on-stop.sh` — prompts session summary

### Subagents for Reviews
- `/security-reviewer` — reviews code for vulnerabilities
- Can be extended with other specialists

---

## Files Deleted

The following old root-level files are superseded:
- `skills/skill-*.md` (7 files) → moved to `.claude/skills/`
- `MEMORY.md` → merged into CLAUDE.md + docs/
- `DECISION.md` → moved to docs/ARCHITECTURE.md
- `PLANNING.md` → moved to docs/ROADMAP.md
- `SESSION_LOG.md` → `.claude/session-log.md`

Keep only:
- **CLAUDE.md** (updated, slimmed)
- **README.md** (new)
- **docs/*** (new)
- **.claude/*** (new)

---

## What Stayed the Same

- Backend code pattern (server/)
- Frontend code pattern (client/)
- Database schema
- API endpoints
- Auth flow
- Notification system
- Cron jobs
- Coaching tone

Only the **knowledge organization** changed, not the application itself.

---

## How to Transition

### If you have existing work:
1. Don't re-run Phase 0 — it's already done
2. Jump to Phase 1 in docs/ROADMAP.md
3. Before implementing, read the relevant skill file:
   - `/skill-auth` for auth work
   - `/skill-db` for database work
   - `/skill-api` for API routes
   - Etc.

### If you're starting fresh:
1. Read CLAUDE.md (this projects's brain)
2. Read README.md (quick start, features)
3. Read docs/ROADMAP.md (phases)
4. Run: `cd server && npm install && node index.js`
5. Run: `cd client && npm install && npm run dev`
6. Login with `admin@tracker.com / admin123`

---

## Alignment with Anthropic Best Practices

This structure follows official guidance from:

1. **[Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)** — CLAUDE.md <100 lines, skills on-demand, planning before code
2. **[Extend Claude Code](https://code.claude.com/docs/en/features-overview)** — skills, hooks, subagents, MCP
3. **[How Anthropic teams use Claude Code](https://www-cdn.anthropic.com/58284b19e702b49db9302d5b6f135ad8871e7658.pdf)** — multi-agent patterns, context management
4. **[GitHub best practices repos](https://github.com/MuhammadUsmanGM/claude-code-best-practices)** — CLAUDE.md templates, skill organization

---

## Questions?

- **Why not everything in CLAUDE.md?** — Long files cause Claude to miss rules (Anthropic finding). Docs are persistent; skills load on-demand.
- **Why .claude/skills/ not root/skills/?** — Keeps .claude/ as system-level; skills are automation, not code.
- **Can I add more skills?** — Yes! Create `.claude/skills/skill-name/SKILL.md` with frontmatter. Claude will auto-discover it.
- **What about session logs?** — Append to `.claude/session-log.md` at end of each session (hook reminds you).

---

**Next Step**: Start Phase 1 in [@docs/ROADMAP.md](docs/ROADMAP.md)
