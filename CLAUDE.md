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

## Phase 9 — Autonomous Multi-Agent Coaching System ✅ COMPLETE & DEPLOYED

Three autonomous agents continuously monitor coaches and provide real-time support:

1. **Monitoring Agent** (every 30 min) — Detects at-risk/overdue tasks, analyzes coach behavior patterns (fast-track, procrastinator, steady, inconsistent), saves snapshots to database
2. **Support Agent** (every 30 min) — Reads snapshots, decides interventions (email, tag, escalate), prevents message fatigue (30-min tag window, 4-hour email window)
3. **Reporting Agent** (daily 9am) — Synthesizes 24-hour actions, generates recommendations, creates HTML digest for admin

**Status:** ✅ **LIVE ON RAILWAY** (commit `5d66d79`)
- Backend: https://spectacular-connection-production-d07b.up.railway.app
- All agents running on schedule (30-min + 9am daily cycles)
- 192+ tests passing (100% success rate)
- Database: 5 Phase 9 tables + full observability via agent_errors table

**Key Features:**
- 🤖 Autonomous decision-making without admin intervention
- 🔍 Pattern-based analysis (not just deadline-based alerts)
- 🎯 Preventive support before tasks are late
- 😌 Built-in fatigue prevention rules (30-min tag window, 4-hour email window)
- 📊 Daily digests with actionable insights
- 🔄 Google Sheets integration (read-only, gracefully degrades if unavailable)

**Implementation:** 1,379 lines of agent code + 697 lines of tests, 156+ tests passing (100%). All agents operational, tested, and deployed to production.

**Handoff & Documentation:**
- [@docs/PHASE9-HANDOFF-SESSION-1.md](docs/PHASE9-HANDOFF-SESSION-1.md) — Session 1 status (75% complete before cleanup)
- [@docs/PHASE9B-HANDOFF-SESSION-1.md](docs/PHASE9B-HANDOFF-SESSION-1.md) — Phase 9b planning (AI enhancement layer with Groq)

## Workflow: Superpowers (Brainstorm → Design → Plan → Execute → Review)

Every task follows this cycle:

1. **Brainstorm** — Ask clarifying questions, propose designs
2. **Design** — Discuss tradeoffs, get approval
3. **Plan** — Use `/plan` for complex tasks (architecture review)
4. **Execute** — RED-GREEN-REFACTOR: test first, then code
5. **Review** — Use `/security-reviewer` before merge

**For implementation:** Read [@docs/SUPERPOWERS.md](docs/SUPERPOWERS.md) and use skills:

**Domain skills** (code patterns):
- `/skill-auth` — JWT + bcrypt
- `/skill-api` — Express routes
- `/skill-db` — SQLite/PostgreSQL patterns
- `/skill-frontend` — React + Vite
- `/skill-notifications` — Coaching tone messaging
- `/skill-cron` — Idempotent jobs
- `/skill-testing` — RED-GREEN-REFACTOR

**Operations skills** (deployments & commits):
- `/skill-railway-deploy` — Deploy to Railway CLI (zero context)
- `/skill-github-push` — Commit + push (Anthropic best practices)

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

## Graphify: Knowledge Graph — GRAPHIFY-FIRST ⭐

**CORE RULE: Always use graphify for queries. Never grep first.**

Query the codebase instead of grepping:

```bash
# ✅ First choice (30-50 tokens):
python3 -m graphifyy query "How do coaches get notified of overdue tasks?"
python3 -m graphifyy path "coach_id" "notification"
python3 -m graphifyy explain "midpoint_nudge"

# ❌ Last resort (5000+ tokens):
grep -r "notifications" server/
```

**Benefits:**
- Scoped subgraph (~50 tokens) vs. full files (5000+ tokens)
- 100x more efficient token usage
- Structured relationships instead of raw text
- Respects the knowledge graph investment

See [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#knowledge-graph-graphify---graphify-first-rule-) and [@docs/GRAPHIFY-FIRST.md](docs/GRAPHIFY-FIRST.md) for detailed guide.
