# Coach Task Tracker

Dual-role web app: Admin assigns tasks to coaches (single or multiple) with deadlines. Coaches log in, get auto-nudged, mark completion, and submit delay reasons. Coaching tone throughout.

## Quick Start Checklist

New to this project? Do this first:

1. **Read** [@README.md](README.md) — 5 min quick start
2. **Read** [@CLAUDE.md](CLAUDE.md) — you're here (project brain)
3. **Setup Groq API Key** — Go to https://console.groq.com, sign up (email only), copy key, paste in `server/.env` as `GROQ_API_KEY=...`
4. **Skim** [@docs/ROADMAP.md](docs/ROADMAP.md) — see the phases
5. **Run** `cd server && npm install && node index.js` — start backend on :3001
6. **Run** `cd client && npm install && npm run dev` — start frontend on :5173
7. **Login** with admin@tracker.com / admin123

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React (Vite) + TailwindCSS, port 5173 |
| Backend | Node.js + Express, port 3001 |
| Database | SQLite via better-sqlite3 (server/tracker.db) |
| Auth | JWT + bcrypt (roles: 'admin' \| 'coach') |
| Automation | node-cron (hourly nudge jobs) |
| E2E Testing | Agent-Browser (deterministic element refs) |
| LLM (Phase 7) | Groq API (llama-3.3-70b-versatile) — free tier, 30 RPM, no credit card |

## Code Conventions

**Core rules:**
- No comments unless WHY is non-obvious
- Validate only at system boundaries (user input, external APIs)
- All admin routes: `requireAdmin` middleware
- All coach routes: scoped to `req.user.id`
- Never return `password_hash` in API responses

**Frontend design:** See [@memory/frontend_design_system.md](~/.claude/projects/d--Cursor-new/memory/frontend_design_system.md) — uses ui-ux-pro-max-skill (Teal #0D9488, Orange #EA580C).

## Workflow: Superpowers (Brainstorm → Design → Plan → Execute → Review)

Every task follows this cycle:

1. **Brainstorm** — Ask clarifying questions, propose designs
2. **Design** — Discuss tradeoffs, get approval
3. **Plan** — Use `/plan` for complex tasks (architecture review)
4. **Execute** — RED-GREEN-REFACTOR: test first, then code
5. **Review** — Use `/security-reviewer` before merge

**For implementation:** Read [@docs/SUPERPOWERS.md](docs/SUPERPOWERS.md) and use skills: `/skill-auth`, `/skill-api`, `/skill-db`, `/skill-frontend`, `/skill-notifications`, `/skill-cron`, `/skill-testing`.

## Nudge Logic (Auto-Notifications)

Coaches get automatically notified when:
1. **Midpoint nudge** — 50% of task time elapsed
2. **Overdue nudge** — Task past due date
3. **Admin notification** — Coach completes or delays task

## Key Documentation

**Essential:**
- [@docs/API.md](docs/API.md) — all endpoints
- [@docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — why we chose SQLite, JWT, node-cron
- [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — git workflow & conventions
- [@docs/ROADMAP.md](docs/ROADMAP.md) — phase checklist (phases 0–7)

**Testing & E2E:**
- [@docs/E2E-AGENT-BROWSER.md](docs/E2E-AGENT-BROWSER.md) — End-to-end testing with agent-browser
- [@docs/E2E-TEST-COVERAGE.md](docs/E2E-TEST-COVERAGE.md) — Test coverage status (11/11 passing ✅)
- [@docs/HANDOFF-AGENT-BROWSER.md](docs/HANDOFF-AGENT-BROWSER.md) — Agent-browser integration guide
- [@client/AGENT-BROWSER-QUICKSTART.md](client/AGENT-BROWSER-QUICKSTART.md) — Quick reference

**Advanced (optional):**
- [@docs/RUFLO.md](docs/RUFLO.md) — multi-agent orchestration framework
- [@.beads/README.md](.beads/README.md) — cross-session work tracking
- [@docs/METADATA-CONTRACT.md](docs/METADATA-CONTRACT.md) — file metadata standards

## Graphify: Knowledge Graph

Query the codebase instead of grepping:

```bash
graphify query "How do coaches get notified of overdue tasks?"
graphify path "coach_id" "notification"
graphify explain "midpoint_nudge"
```

See [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#knowledge-graph-graphify) for setup.
