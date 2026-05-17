# Phase Builder Agent

Orchestrates parallel development of Coach Task Tracker phases using multi-agent swarm.

## Purpose
- Reads `docs/ROADMAP.md` to find next unchecked phase
- Spawns specialized agents: auth-agent, task-manager-agent, frontend-agent, notification-agent
- All agents work in parallel, sharing memory via AgentDB
- Coordinates code reviews, tests, security audits through agent consensus
- Reports progress via structured insights

## When to Trigger
```
User: "Build Phase 1"
→ Phase Builder analyzes ROADMAP, spawns 4 agents
→ Auth Agent handles server/db/auth.js
→ Frontend Agent handles client/src/context/AuthContext.jsx
→ All coordinate via AgentDB, report completion together
```

## Agent Swarm Composition
1. **Auth Agent** — JWT, bcrypt, session management
2. **Task Manager Agent** — database schema, task lifecycle
3. **Frontend Agent** — React components, routing, forms
4. **Notification Agent** — cron jobs, nudge logic, messaging

## Coordination Protocol
- Shared AgentDB namespace: `phase-{phase-number}`
- Status updates: every subtask completion posted to shared memory
- Consensus: security + tests + docs must all pass before "phase complete"
- Fallback: if any agent fails, report blocker and await human intervention

## Agent Memory
- Store: phase requirements from ROADMAP.md
- Query: existing codebase (via graphify) for patterns to follow
- Learn: test failures and fixes for future phases
