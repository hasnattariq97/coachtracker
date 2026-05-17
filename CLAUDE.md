# Coach Task Tracker

Dual-role web app: Admin assigns tasks to coaches with deadlines. Coaches log in, get auto-nudged, mark completion, and submit delay reasons. Coaching tone throughout.

## Tech Stack
- Frontend: React (Vite) + TailwindCSS, port 5173
- Backend: Node.js + Express, port 3001
- Database: SQLite via better-sqlite3 (server/tracker.db)
- Auth: JWT + bcrypt (roles: 'admin' | 'coach')
- Cron: node-cron (hourly nudge jobs)

## Key Commands
- `cd server && npm install && node index.js` — start backend
- `cd client && npm install && npm run dev` — start frontend

## Code Conventions
- No comments unless WHY is non-obvious
- Validate only at system boundaries (user input, external APIs)
- All admin routes: requireAdmin middleware
- All coach routes: scoped to req.user.id
- Never return password_hash in API responses

## Nudge Logic
1. **Midpoint**: now ≥ assigned_at + (due_date - assigned_at)/2 → notify coach
2. **Overdue**: now > due_date AND status ≠ 'completed' → status=overdue, notify coach
3. **Admin update**: on completion or overdue → notify admin

## Superpowers Workflow
This project uses **Brainstorm → Design → Plan → Execute → Review** methodology.
- Read [@docs/SUPERPOWERS.md](docs/SUPERPOWERS.md) for the full workflow
- Test-first development: RED-GREEN-REFACTOR for all features
- Use `/plan` for non-trivial changes (architecture review before coding)
- Use skills before implementing (see [@docs/SUPERPOWERS.md](docs/SUPERPOWERS.md#tools--skills))
- Use `/security-reviewer` for code audit before merging

## How to Use This Project
- Read [@docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design decisions
- Read [@docs/ROADMAP.md](docs/ROADMAP.md) for phase checklist
- Read [@docs/SUPERPOWERS.md](docs/SUPERPOWERS.md) for development workflow
- Use skills: `/skill-auth`, `/skill-api`, `/skill-db`, `/skill-frontend`, `/skill-notifications`, `/skill-cron`, `/skill-testing`

## Links
- [@README.md](README.md) — quick start
- [@docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — workflow & git
- [@docs/API.md](docs/API.md) — endpoint reference

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Ruflo: Multi-Agent AI Orchestration + SupaConductor Evaluation Framework

This project uses **Ruflo** with **SupaConductor quality patterns** to orchestrate 100+ specialized agents for development acceleration with explicit quality gates.

### Development Acceleration (Option A): Parallel Agents + Quality Evaluation
The **Phase Builder Agent** spawns a team of domain agents in parallel, evaluates outputs through 4 specialized assessors, and Board of Directors voting:

**Parallel Execution (Phase N):**
- Auth Agent (JWT, bcrypt, session management)
- Task Manager Agent (database schema, CRUD, lifecycle)
- Frontend Agent (React components, routing, UI)
- Notification Agent (cron jobs, nudge logic, messaging)

**Quality Evaluation Gates (SupaConductor Pattern):**
1. **UI/UX Evaluator** — responsive design, coaching tone, accessibility
2. **Code Quality Evaluator** — linting, type safety, conventions, no secrets
3. **Integration Evaluator** — API contracts, database schema, auth guards, idempotency
4. **Business Logic Evaluator** — feature completeness, tests, ROADMAP alignment

**Board of Directors Consensus (5 executives):**
- Chief Architect, Chief Product Officer, Chief Security Officer, Chief Operating Officer, Chief Experience Officer
- Each votes with rationale: APPROVE / REMEDIATE / ESCALATE
- Consensus required (4/5+)
- Fix loops (max 5 retries) if remediation needed
- ESCALATE to human if max retries exhausted

Trigger: `/phase-builder` or `Build Phase 1` → agents build in parallel → 4 evaluators assess → Board votes → results stored in AgentDB `phase-{N}-approved` or `phase-{N}-issues`

### Product Feature: Multi-Agent Coaching (Option B)
When coaches submit completed tasks or delay reasons, a 3-agent swarm analyzes:
1. **Pattern Agent**: compares to historical coach data
2. **Growth Agent**: identifies learning opportunities
3. **Risk Agent**: flags recurring delays or blockers

Consensus → stored as `coaching_insights` (Phase 7, deferred).

### Enterprise Platform (Option C)
**MCP Servers:**
- `ruflo` — core orchestration
- `ruv-swarm` — team coordination
- `flow-nexus` — autonomous workflows

**13 Installed Plugins:**
- Memory: agentdb, rag-memory, intelligence
- Orchestration: swarm, autopilot, goals, workflows
- Code Quality: testgen, docs, security-audit, observability
- Enterprise: federation, adr, cost-tracker

**AgentDB Namespaces:**
- `phase-{N}` — agents working on phase N store shared progress
- `claude-memories` — auto-synced from ~/.claude/projects/*/memory/
- `patterns` — neural learning (SONA trajectories)
- Reserved: do not shadow `pattern`, `default`

### When to Use Agent Commands

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
```

### Learning Loop
- Agents store decisions in AgentDB
- Pre-commit hook: consolidates learnings (pattern-consolidator.sh)
- Post-session: insights exported to ~/.claude/projects/*/memory/MEMORY.md
- Next session: agents auto-import learnings via SessionStart hook

### Rules
- Do NOT shadow reserved AgentDB namespaces
- Agents coordinate via `phase-{N}` namespace only
- All agent decisions logged in `.claude-flow/metrics/`
- On failure: agents report blocker to AgentDB, await human intervention
- Cost tracking: `/cost-tracker status` monitors token spend per phase

## Beads Work-Tracking System

Append-only JSONL event log for cross-session work durability. Solves the problem: **Phase Builder work disappears after context resets.**

### How It Works

**Three files track everything:**
- **`.beads/status.jsonl`** — work items (open → in_progress → closed)
- **`.beads/decisions.jsonl`** — Phase Board decisions (one per phase)
- **`.beads/failures.jsonl`** — evaluation failures requiring fix loops

### SessionStart Auto-Injection

Every session start, the SessionStart hook reads `.beads/status.jsonl` and injects open beads:

```
Open Work Items from Previous Session:
- Auth Agent: Implement server/auth.js
- Task Manager Agent: Schema + CRUD routes
```

This lets work resume seamlessly after context resets.

### Phase Builder Integration

Phase Builder logs to beads at key moments:

1. **Spawns agents** → creates open bead for each
2. **Agents update status** → in_progress, then closed
3. **Board votes** → logs decision to decisions.jsonl
4. **Evaluator fails** → logs issues to failures.jsonl
5. **SessionStart** → injects open beads next session

### Stop Hook Reminders

On session end, Stop hook reminds about unclosed beads:
```
⚠️  Note: 2 unclosed bead(s) in .beads/status.jsonl
```

### Metadata Contract

All `.md` files must have YAML frontmatter for freshness tracking:
```yaml
---
phase: "0"
status: "active"
owner: "phase-builder"
last_updated: "2026-05-17T22:30:00Z"
beads: []
---
```

See [@docs/METADATA-CONTRACT.md](docs/METADATA-CONTRACT.md) for full spec.

### Querying Beads

All beads are JSONL (one JSON object per line), queryable:
```bash
# Show open beads
grep '"status":"open"' .beads/status.jsonl

# Show phase decisions
grep '"type":"decision"' .beads/decisions.jsonl

# Show evaluation failures
grep '"type":"failure"' .beads/failures.jsonl
```

See [@.beads/README.md](.beads/README.md) for full documentation.
