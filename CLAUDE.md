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

## Ruflo: Multi-Agent AI Orchestration

This project uses **Ruflo** to orchestrate 100+ specialized agents for development acceleration and product features.

### Development Acceleration (Option A)
The **Phase Builder Agent** spawns a team of domain agents that work in parallel:
- Auth Agent (JWT, bcrypt, session management)
- Task Manager Agent (database schema, CRUD, lifecycle)
- Frontend Agent (React components, routing, UI)
- Notification Agent (cron jobs, nudge logic, messaging)

Trigger: `/phase-builder` or `Build Phase 1` → agents coordinate via AgentDB, report consensus completion.

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
