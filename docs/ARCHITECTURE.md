# Architecture Decisions

Why we chose certain technologies and patterns.

## SQLite over PostgreSQL
**Why:** Single-machine deployment, zero infra overhead. Sufficient for <1000 tasks.
**Trade-off:** No horizontal scaling. Acceptable for internal coaching tool.

## JWT over Sessions
**Why:** Stateless, no server-side session store. Role embedded in token for easy guard checks.
**Trade-off:** Token revocation requires expiry or denylist. Using 24h expiry.

## node-cron over External Queue (Bull/Redis)
**Why:** Avoids Redis dependency. Nudge jobs are idempotent — safe to re-run on restart.
**Trade-off:** Jobs stop if server crashes. Acceptable for internal tool.

## In-App Notifications over Email (MVP)
**Why:** No SMTP config required. Coaches must log in to see tasks anyway.
**Trade-off:** Coaches miss nudges if they don't log in. Email layer is Phase 7.

## Polling (30s) over WebSockets
**Why:** Simpler implementation. Notifications are not real-time critical.
**Trade-off:** Up to 30s delay. Acceptable for coaching workflow.

## Project Structure
- **Backend:** server/ with Express, SQLite, node-cron
- **Frontend:** client/ with React, Vite, TailwindCSS
- **Knowledge:** .claude/skills/ for domain patterns (loaded on-demand)
- **Automation:** .claude/hooks/ for safety enforcement
- **Docs:** docs/ for persistent team knowledge (Architecture, API, Roadmap, Contributing)

See [@docs/ROADMAP.md](ROADMAP.md) for phase-by-phase implementation.
