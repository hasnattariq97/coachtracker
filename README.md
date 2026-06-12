# Coach Task Tracker

A dual-role web application for managing coaching tasks. Admins assign tasks with deadlines to coaches, coaches get auto-nudged as deadlines approach, and can mark completion or submit delay reasons.

## Quick Start

### Prerequisites
- Node.js 16+
- npm

### Setup (Local Development)

**Backend:**
```bash
cd server
npm install

# Setup environment variables (create .env file):
echo "JWT_SECRET=test-secret-key-minimum-32-characters-requirement" > .env
echo "GROQ_API_KEY=gsk_YOUR_KEY_HERE" >> .env
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/coach_tracker" >> .env

node index.js
```
Runs on http://localhost:3001

**Frontend:**
```bash
cd client
npm install
npm run dev
```
Runs on http://localhost:5173

### Production Deployment

**Current Deployment (Live ✅):**
- **Frontend:** https://coachtracker-theta.vercel.app (Vercel)
- **Backend API:** https://spectacular-connection-production-d07b.up.railway.app (Railway)
- **Database:** Railway PostgreSQL (persistent across redeploys)
- **Status:** All systems operational ✓

### Default Login
- Email: `hasnat@niete.edu.pk`
- Password: `Hasnat97`

### Knowledge Graph (Graphify)

Graphify automatically indexes your codebase into a queryable knowledge graph.

**First time? Generate the graph locally:**
```bash
pip install graphifyy
export ANTHROPIC_API_KEY="sk-ant-..."  # or OPENAI_API_KEY, GEMINI_API_KEY
graphify extract . --out .graphify
```

**Then query it in future sessions:**
```bash
graphify query "How do coaches get notified?"
graphify path "coach" "notification"
graphify explain "midpoint_nudge"
```

Graph outputs auto-rebuild on commit (git hooks installed). See [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#knowledge-graph-graphify) for details.

---

## Project Structure

```
d:\Cursor_new\
├── CLAUDE.md                          ← Project brain (read first)
├── README.md                          ← This file
├── docs/
│   ├── ARCHITECTURE.md                ← Design decisions
│   ├── ROADMAP.md                    ← Phase checklist
│   ├── SUPERPOWERS.md                ← Methodology: Brainstorm→Design→Plan→Execute→Review
│   ├── SUPERPOWERS-QUICK-START.md    ← Examples & quick reference
│   ├── CONTRIBUTING.md               ← Git & development workflow
│   └── API.md                        ← API endpoint reference
├── .claude/
│   ├── settings.json                 ← Claude Code permissions & hooks
│   ├── hooks/                        ← Automation scripts
│   ├── agents/
│   │   └── security-reviewer.md      ← Security review subagent
│   └── skills/
│       ├── skill-auth/SKILL.md              ← JWT + bcrypt patterns
│       ├── skill-db/SKILL.md                ← SQLite patterns
│       ├── skill-api/SKILL.md               ← Express conventions
│       ├── skill-frontend/SKILL.md          ← React + Vite patterns
│       ├── skill-notifications/SKILL.md     ← Notification system
│       ├── skill-cron/SKILL.md              ← node-cron jobs
│       └── skill-testing/SKILL.md           ← RED-GREEN-REFACTOR patterns
├── server/                            ← Node.js + Express backend
│   ├── index.js
│   ├── db.js
│   ├── auth.js
│   ├── cron.js
│   └── routes/
└── client/                            ← React + Vite frontend
    └── src/
```

---

## Features

### Admin
- Create and manage coaches
- Assign tasks with priority and deadline (single or multiple coaches)
- **Attach resource links** (Google Sheets, Drive, Docs, etc.) to tasks
- Multi-coach assignment: assign one task to several coaches with individual notifications
- View all task progress
- Read delay reasons from coaches
- Get notifications when tasks complete or are overdue

### Coach
- View assigned tasks with attached resources
- **Click links** to access docs, sheets, and drive folders
- Mark tasks as complete
- Submit delay reasons for overdue tasks
- Get auto-nudged at task midpoint
- Get overdue notifications
- Receive **coaching insights** (AI analysis of performance patterns)

### Automated
- **Midpoint nudge**: Coach notified when 50% of task time has elapsed
- **Overdue nudge**: Coach notified and admin alerted when task is past due
- **Coaching tone**: All messages encourage growth and accountability
- **Multi-Agent Coaching Insights** (Phase 7): Groq API-powered 3-agent consensus swarm analyzes coach behavior patterns on task completion/delay submission. No cost, fire-and-forget, never blocks UX.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React (Vite), TailwindCSS, Axios |
| Backend | Node.js, Express, SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Automation | node-cron (hourly nudge jobs) |
| LLM (Phase 7) | Groq API (llama-3.3-70b-versatile) — free tier, 30 RPM, no credit card |

---

## Key Commands

```bash
# Development
cd server && node index.js &     # Start backend
cd client && npm run dev &       # Start frontend

# Production
cd client && npm run build       # Build frontend
cd server && node index.js       # Run backend

# Database
sqlite3 server/tracker.db        # Open database shell

# Logs
cat .claude/audit.log            # View audit log of Claude tool calls
```

---

## API

### Authentication
- **POST** `/api/auth/login` — login with email + password

### Coaches (admin only)
- **GET** `/api/coaches` — list all coaches
- **POST** `/api/coaches` — create coach
- **PUT** `/api/coaches/:id` — update coach
- **DELETE** `/api/coaches/:id` — delete coach

### Tasks
- **GET** `/api/tasks` (admin), `/api/tasks/mine` (coach) — list tasks
- **POST** `/api/tasks` (admin) — assign task
- **PUT** `/api/tasks/:id/complete` (coach) — mark complete
- **PUT** `/api/tasks/:id/delay-reason` (coach) — submit delay reason

### Notifications
- **GET** `/api/notifications` — list user notifications
- **PUT** `/api/notifications/:id/read` — mark read
- **PUT** `/api/notifications/read-all` — mark all read

See [@docs/API.md](docs/API.md) for full endpoint reference.

---

## Development (Superpowers Framework)

This project uses the **Superpowers** methodology from https://github.com/obra/superpowers.

### Full Superpowers Integration

All 14 superpowers skills are installed in `.claude/skills/`:

**Methodology skills:**
- `/using-superpowers` ← **START HERE**
- `/brainstorming` — Explore requirements
- `/writing-plans` — Design implementation
- `/test-driven-development` — RED-GREEN-REFACTOR
- `/subagent-driven-development` — Execute with agents
- `/verification-before-completion` — Verify before claiming done
- `/requesting-code-review` — Request structured review
- `/receiving-code-review` — Handle feedback rigorously
- `/systematic-debugging` — Root-cause analysis
- `/dispatching-parallel-agents` — Parallel execution
- `/using-git-worktrees` — Isolated workspaces
- `/finishing-a-development-branch` — Branch completion
- `/executing-plans` — Execute written plans
- `/writing-skills` — Create custom skills

**Project-specific skills:**
- `/skill-auth`, `/skill-db`, `/skill-api`, `/skill-frontend`, `/skill-notifications`, `/skill-cron`, `/skill-testing`

### To Build a Feature

1. `/using-superpowers` — Understand the framework (5 min)
2. `/brainstorming` — Explore requirements
3. `/writing-plans` — Design multi-step tasks
4. `/test-driven-development` — RED-GREEN-REFACTOR
5. `/verification-before-completion` — Verify before done
6. `/requesting-code-review` — Get structured review

### Code Conventions

- **No comments** unless WHY is non-obvious
- **Validate at boundaries** — only at user input, external APIs
- **Admin routes** — wrap with `requireAdmin` middleware
- **Coach routes** — verify `req.user.id` matches resource owner
- **Notifications** — always check idempotency (no double-nudge)
- **Tests** — RED-GREEN-REFACTOR, use real SQLite (see `/skill-testing`)

See [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for full guidelines.

---

## Architecture

**Why SQLite?** Single-machine deployment, zero infra. Sufficient for <1000 tasks.

**Why JWT?** Stateless auth, role embedded in token, no session store needed.

**Why node-cron?** Avoids Redis/queue complexity. Nudge jobs are idempotent and safe to re-run.

**Why polling (30s)?** Simple, notifications aren't real-time critical.

See [@docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full design rationale.

---

## Debugging

⚠️ **CRITICAL ISSUE:** If all API endpoints return 500 errors, see [@docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for the quick fix (usually just stuck Node processes).

| Problem | Solution |
|---------|----------|
| **All APIs return 500 (but code works)** | **Run `scripts/cleanup.cmd` — old Node processes on port 3001** |
| **Port 3001 already in use** | **Run `scripts/cleanup.cmd` to kill stuck processes** |
| Backend won't start | `.env` has `JWT_SECRET`, `npm install` ran |
| Frontend won't connect | Backend on 3001, Vite proxy in `vite.config.js` |
| Notifications not showing | Table has rows, bell polls every 30s |
| Cron not running | `cron.js` imported in `index.js`, schedule set |

**Quick Fix for "All APIs Return 500":**
```bash
# Windows
scripts\cleanup.cmd

# Linux/Mac
./scripts/cleanup.sh
```

Then start fresh servers in **two new terminal windows**:
```bash
# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npm run dev
```

See [@docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for detailed troubleshooting, prevention strategies, and diagnostic tools.

---

## Contributing

- Branch: `feature/X` or `bugfix/X`
- Commits: `[Phase #] Description`
- Before push: run tests, check lint
- Create PR with phase context

See [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for full workflow.

---

## Next Steps

1. Start backend and frontend
2. Login with seed credentials
3. Create 2-3 coaches
4. Assign tasks with near-future due dates
5. Login as coach to see dashboard
6. Mark a task complete, check admin notification
7. Read [@docs/ROADMAP.md](docs/ROADMAP.md) for next phases

---

## License

MIT

---

## Questions?

- **"How do I use superpowers?"** → `/using-superpowers`
- **"How do I start?"** → Read [@SUPERPOWERS-INSTALLED.md](SUPERPOWERS-INSTALLED.md)
- **"How do I brainstorm?"** → `/brainstorming`
- **"How do I write a plan?"** → `/writing-plans`
- **"How do I test-first?"** → `/test-driven-development`
- **Project overview?** → [@CLAUDE.md](CLAUDE.md)
- **Development guidelines?** → [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- **API reference?** → [@docs/API.md](docs/API.md)
