---
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-06-04T00:00:00Z"
beads: []
---

# Ruflo: Multi-Agent AI Orchestration + SupaConductor Evaluation Framework

Advanced feature for parallel agent-driven development with quality gates. **Optional** — only use if coordinating 100+ specialized agents.

## Three Implementation Options

### Option A: Development Acceleration (Parallel Agents)

Spawn a team of domain agents that work in parallel, evaluate outputs through 4 assessors, and reach Board consensus.

**Parallel Execution (Phase N):**
- Auth Agent (JWT, bcrypt, session management)
- Task Manager Agent (database schema, CRUD, lifecycle)
- Frontend Agent (React components, routing, UI)
- Notification Agent (cron jobs, nudge logic, messaging)

**Quality Evaluation Gates:**
1. **UI/UX Evaluator** — responsive design, coaching tone, accessibility
2. **Code Quality Evaluator** — linting, type safety, conventions, no secrets
3. **Integration Evaluator** — API contracts, database schema, auth guards, idempotency
4. **Business Logic Evaluator** — feature completeness, tests, ROADMAP alignment

**Board of Directors Consensus:**
- Chief Architect, Chief Product Officer, Chief Security Officer, Chief Operating Officer, Chief Experience Officer
- Each votes: APPROVE / REMEDIATE / ESCALATE
- Consensus required (4/5+)
- Fix loops (max 5 retries) if remediation needed
- ESCALATE to human if max retries exhausted

**Trigger:**
```bash
/phase-builder
Build Phase 1
```

Results stored in AgentDB: `phase-{N}-approved` or `phase-{N}-issues`

### Option B: Product Feature (Multi-Agent Coaching)

When coaches submit completed tasks or delay reasons, a 3-agent swarm analyzes:
1. **Pattern Agent** — compares to historical coach data
2. **Growth Agent** — identifies learning opportunities
3. **Risk Agent** — flags recurring delays or blockers

Consensus stored as `coaching_insights` notification to coach (Phase 7, deferred).

### Option C: Enterprise Platform

**MCP Servers:**
- `ruflo` — core orchestration
- `ruv-swarm` — team coordination
- `flow-nexus` — autonomous workflows

**13 Installed Plugins:**
- Memory: agentdb, rag-memory, intelligence
- Orchestration: swarm, autopilot, goals, workflows
- Code Quality: testgen, docs, security-audit, observability
- Enterprise: federation, adr, cost-tracker

## AgentDB Namespaces

- `phase-{N}` — agents working on phase N store shared progress
- `claude-memories` — auto-synced from ~/.claude/projects/*/memory/
- `patterns` — neural learning (SONA trajectories)
- Reserved: do not shadow `pattern`, `default`

## Agent Commands

```bash
# Trigger phase builder for parallel development
/phase-builder
Build Phase 1

# Search shared agent memory
/agentdb search "How do we handle overdue tasks?"

# Spawn a specialized agent for a task
/swarm spawn task-manager-agent "Implement task CRUD routes"

# Check agent team status
/swarm status

# Export agent insights to memory
/memory save-result --question "Q" --answer "A" --type query --nodes node1 node2

# View cost tracking
/cost-tracker status
```

## Learning Loop

- Agents store decisions in AgentDB
- Pre-commit hook: consolidates learnings (pattern-consolidator.sh)
- Post-session: insights exported to ~/.claude/projects/*/memory/MEMORY.md
- Next session: agents auto-import learnings via SessionStart hook

## Rules

- Do NOT shadow reserved AgentDB namespaces
- Agents coordinate via `phase-{N}` namespace only
- All agent decisions logged in `.claude-flow/metrics/`
- On failure: agents report blocker to AgentDB, await human intervention
- Cost tracking: `/cost-tracker status` monitors token spend per phase
