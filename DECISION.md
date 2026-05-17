# DECISION.md — Architectural Decisions

## SQLite over PostgreSQL
Why: Single-machine deployment, zero infra overhead. Sufficient for <1000 tasks.
Trade-off: No horizontal scaling. Acceptable for this use case.

## JWT over Sessions
Why: Stateless, no server-side session store. Role embedded in token for easy guard checks.
Trade-off: Token revocation requires expiry or denylist. Using short expiry (24h).

## node-cron over External Queue (Bull/Redis)
Why: Avoids Redis dependency. Nudge jobs are idempotent — safe to re-run on restart.
Trade-off: Jobs stop if server crashes. Acceptable for internal tool.

## In-App Notifications over Email (MVP)
Why: No SMTP config required. Coaches must log in to see tasks anyway.
Trade-off: Coaches miss nudges if they don't log in. Email layer is Phase 7.

## Polling (30s) over WebSockets
Why: Simpler implementation. Notifications are not real-time critical.
Trade-off: Up to 30s delay. Acceptable for this workflow.
