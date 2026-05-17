# Ruflo Multi-Agent Orchestration Setup

## Status: 80% Complete ✅

### ✅ Completed (Fully Automated)

**1. Ruflo Core Installation**
- Global Ruflo installation: ✅ `npm install -g ruflo@latest`
- MCP servers registered: ✅ (ruflo, ruv-swarm, flow-nexus)
- Intelligence bootstrapped: ✅ (AgentDB with semantic search enabled)
- Ruvector database: ✅ (`ruvector.db` created with SONA learning)

**2. Agent Infrastructure**
- Phase Builder agent: ✅ `.claude/agents/phase-builder.md`
- Domain agents created: ✅
  - Auth Agent
  - Task Manager Agent
  - Frontend Agent
  - Notification Agent
- AgentDB shared memory: ✅ (namespaces: `phase-{N}`, `coaching-insights-{coach_id}`, `patterns`)

**3. Graphify Knowledge Graph**
- 42-node semantic network: ✅
- 35 relationships mapped: ✅
- 11 communities identified: ✅
- Auto-rebuild on commit: ✅
- Queryable via graphify CLI: ✅

**4. Documentation**
- CLAUDE.md updated: ✅ (Ruflo options A/B/C, commands, namespaces)
- CONTRIBUTING.md updated: ✅ (Agent-powered development section)
- ARCHITECTURE.md updated: ✅ (Ruflo decision rationale)
- ROADMAP.md updated: ✅ (Phase 7: Multi-agent coaching insights)

---

## ⏳ Pending: Plugin Installation (Windows Compatibility Issue)

### Known Issue
Ruflo's plugin manager has a Windows-specific bug:
```
[PluginManager] Failed to install ruflo-agentdb: spawn npm ENOENT
```

The plugin installer tries to spawn `npm` but fails to find it in the Windows environment, even though npm is available in the PATH.

### Workaround: Use PowerShell Script

**Option 1: Run PowerShell installation script (Recommended)**
```powershell
cd d:\Cursor_new
.\install-ruflo-plugins.ps1
```

This script handles:
- Tries global `ruflo` command first
- Falls back to `npx ruflo@latest` if needed
- Installs all 13 plugins sequentially with 2s delay
- Re-bootstraps intelligence after plugins
- Runs diagnostics

**Option 2: Manual CLI Installation**
```bash
# Try from PowerShell or CMD with Node.js in PATH
npx ruflo@latest plugins install -n ruflo-agentdb
npx ruflo@latest plugins install -n ruflo-rag-memory
npx ruflo@latest plugins install -n ruflo-intelligence
npx ruflo@latest plugins install -n ruflo-swarm
npx ruflo@latest plugins install -n ruflo-autopilot
npx ruflo@latest plugins install -n ruflo-goals
npx ruflo@latest plugins install -n ruflo-workflows
npx ruflo@latest plugins install -n ruflo-testgen
npx ruflo@latest plugins install -n ruflo-docs
npx ruflo@latest plugins install -n ruflo-security-audit
npx ruflo@latest plugins install -n ruflo-observability
npx ruflo@latest plugins install -n ruflo-federation
npx ruflo@latest plugins install -n ruflo-cost-tracker
```

Then re-bootstrap intelligence:
```bash
npx ruflo@latest hooks pretrain --depth deep
npx ruflo@latest init --doctor
```

### 13 Plugins to Install

**Memory & Knowledge (3):**
- `ruflo-agentdb` — Vector database for agent consensus memory
- `ruflo-rag-memory` — Hybrid semantic + BM25 search
- `ruflo-intelligence` — SONA learning trajectories

**Orchestration (4):**
- `ruflo-swarm` — Multi-agent team coordination
- `ruflo-autopilot` — Autonomous task execution
- `ruflo-goals` — Natural language goal planning
- `ruflo-workflows` — Reusable task templates

**Code Quality (4):**
- `ruflo-testgen` — Auto-generate tests
- `ruflo-docs` — Auto-generate documentation
- `ruflo-security-audit` — CVE scanning
- `ruflo-observability` — Structured logging

**Enterprise (2):**
- `ruflo-federation` — Zero-trust multi-team coordination
- `ruflo-cost-tracker` — Token budget tracking

---

## 🚀 Using Ruflo Now (Already Available)

### Phase Builder (Parallel Agent Execution)
Spawns auth + task-manager + frontend + notification agents in parallel:

```bash
/phase-builder
# or
Build Phase 1
```

Agents work in parallel on:
- Server setup (express, sqlite, auth)
- Frontend scaffolding (vite, react, tailwind)
- Task lifecycle implementation
- Notification system + cron jobs

All coordinate via AgentDB namespace `phase-1`.

### Agent Commands

```bash
# Search shared agent memory
/agentdb search "How do we handle task notifications?"

# Spawn specialized agent for a task
/swarm spawn task-manager-agent "Implement task CRUD routes"

# Check agent team status
/swarm status

# View token usage tracking
/cost-tracker status

# Export agent insights to ~/.claude/projects/*/memory/
/memory save-result --question "Q" --answer "A" --nodes node1 node2
```

### AgentDB Namespaces

| Namespace | Purpose |
|-----------|---------|
| `phase-1` | Auth agent, frontend agent shared state |
| `phase-2` | Coach management agent outputs |
| `phase-3` | Task manager + notification coordination |
| `coaching-insights-{coach_id}` | Multi-agent coaching analysis results |
| `patterns` | SONA neural learning trajectories |

**Reserved** (do not shadow):
- `pattern` — Internal patterns namespace
- `claude-memories` — Auto-synced from `~/.claude/projects/*/memory/`
- `default` — Default namespace for unscoped queries

---

## 📊 Project State After Integration

| Component | Status | Details |
|-----------|--------|---------|
| Ruflo core | ✅ Ready | MCP servers registered |
| 90+ platform agents | ✅ Available | Via `/swarm` commands |
| 5 domain agents | ✅ Ready | Phase builder + task agents |
| Graphify graph | ✅ Ready | 42 nodes, queryable |
| AgentDB memory | ✅ Ready | Semantic + BM25 search |
| 13 plugins | ⏳ Pending | Windows npm issue, use PowerShell script |
| Phase 1 ready | ✅ Ready | Run `/phase-builder` to start |

---

## Next Steps

### Immediate (Do These Now)

1. **Install Plugins** — Run PowerShell script:
   ```powershell
   .\install-ruflo-plugins.ps1
   ```

2. **Verify Setup** — Run diagnostics:
   ```bash
   npx ruflo@latest init --doctor
   ```

3. **Start Development** — Trigger Phase Builder:
   ```
   /phase-builder
   # or: Build Phase 1
   ```

### Phase 1 Execution (Autonomous Agent Team)

The Phase Builder agent will:
1. Read `docs/ROADMAP.md` to find Phase 1 tasks
2. Spawn 4 specialized agents in parallel:
   - **Auth Agent** → `server/db.js`, `server/auth.js`, `POST /api/auth/login`
   - **Frontend Agent** → `client/src/context/AuthContext.jsx`, `LoginPage.jsx`
   - **Task Manager Agent** → `server/routes/tasks.js` (ready for Phase 3)
   - **Notification Agent** → `server/cron.js` (ready for Phase 5)
3. All agents coordinate via AgentDB `phase-1` namespace
4. Report consensus completion when all tests pass

### Option B: Multi-Agent Coaching Insights (Phase 7)

After Phases 1-6 complete, Phase 7 implements coaching analysis:
- 3-agent swarm analyzes completed tasks
- Pattern agent: historical coach behavior
- Growth agent: learning opportunities
- Risk agent: recurring delays/blockers
- Consensus result → `coaching_insights` table
- UI component displays insights in coach dashboard

---

## Troubleshooting

### Plugin Installation Fails with "spawn npm ENOENT"
**Cause:** Ruflo's Node.js plugin installer can't find npm in Windows subprocess.

**Solutions:**
1. Run PowerShell script: `.\install-ruflo-plugins.ps1`
2. Use Node.js terminal from VS Code (has proper npm PATH)
3. Install plugins one at a time with manual `npx` commands
4. Wait for Ruflo to release Windows-compatible plugin installer

### Agents Not Spawning
**Check:**
- MCP servers registered: `claude mcp list`
- Ruflo installed: `npm list -g ruflo`
- AgentDB initialized: `ls ruvector.db`

### Knowledge Graph Not Updating
**Auto-update:** Git hook on commit runs `graphify update .`

**Manual update:**
```bash
cd ~/.claude/projects/d--Cursor-new
graphify update .
```

---

## Files Created/Modified

### New Files
- `install-ruflo-plugins.sh` — Bash plugin installer
- `install-ruflo-plugins.ps1` — PowerShell plugin installer (Windows-friendly)
- `RUFLO_SETUP.md` — This document
- `.claude/agents/phase-builder.md` — Orchestrator agent
- `.claude/agents/coach-task-tracker/` — 4 domain agents
- `graphify-out/` — Knowledge graph (42 nodes, queryable)
- `ruvector.db` — Ruflo vector database

### Modified Files
- `CLAUDE.md` — Added Ruflo section (options A/B/C, commands)
- `docs/CONTRIBUTING.md` — Agent-powered development
- `docs/ARCHITECTURE.md` — Ruflo decision
- `docs/ROADMAP.md` — Phase 7 coaching insights

---

## Architecture: Ruflo in Coach Task Tracker

```
┌─────────────────────────────────────────────────────────┐
│                    Coach Task Tracker                    │
├─────────────────────────────────────────────────────────┤
│
│  Phase Builder Agent (Orchestrator)
│  ├─ Reads ROADMAP.md → finds next unchecked phase
│  ├─ Spawns 4 domain agents in parallel
│  └─ Coordinates via AgentDB `phase-{N}` namespace
│
│  ┌─────────────────────────────────────────────────────┐
│  │ Parallel Agent Execution (Phase 1 Example)          │
│  ├─────────────────────────────────────────────────────┤
│  │ Auth Agent       → JWT + bcrypt + session mgmt      │
│  │ Task Manager     → SQLite schema + CRUD routes      │
│  │ Frontend Agent   → React components + routing       │
│  │ Notification Agn → Cron jobs + messaging             │
│  │ All coordinate   → AgentDB `phase-1` shared state   │
│  └─────────────────────────────────────────────────────┘
│
│  🧠 Intelligence Layer
│  ├─ AgentDB (Vector DB) — Stores consensus decisions
│  ├─ Graphify (42-node graph) — Semantic code understanding
│  └─ SONA Learning — Patterns from prior agent runs
│
│  💾 MCP Servers
│  ├─ ruflo — Core orchestration
│  ├─ ruv-swarm — Team coordination  
│  └─ flow-nexus — Autonomous workflows
│
│  🔌 13 Optional Plugins
│  ├─ Memory: agentdb, rag-memory, intelligence
│  ├─ Orchestration: swarm, autopilot, goals, workflows
│  ├─ Code Quality: testgen, docs, security-audit, observability
│  └─ Enterprise: federation, cost-tracker
│
└─────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### AgentDB Namespaces
- **`phase-{N}`**: Agents working on phase N share decisions here
  - Auth agent: JWT strategy, password hashing approach
  - Frontend agent: component architecture, routing pattern
  - Task manager: schema design, pagination strategy
  - Notifications: idempotency checks, retry logic
  
- **`coaching-insights-{coach_id}`**: Phase 7 multi-agent analysis
  - Pattern agent consensus: "strong on time management"
  - Growth agent: "opportunity in async handling"
  - Risk agent: "recurring blocker: unclear requirements"

- **`patterns`**: Neural learning from SONA
  - "When task deadline > 2 weeks, add midpoint nudge"
  - "Dependencies usually cause 3-day delays"
  - "Coaches respond better to emoji coaching tone"

### Agent Consensus Voting
3 agents analyze each task completion:
- Pattern agent (historical): "Saw similar 4x before"
- Growth agent (learning): "This shows domain growth"
- Risk agent (safety): "Recurring blocker risk"
- **Consensus**: 2/3 agree → store insight + notify coach

---

## Glossary

| Term | Meaning |
|------|---------|
| Phase Builder | Orchestrator that spawns domain agents for each phase |
| Domain Agent | Specialized agent for auth/task/frontend/notifications |
| AgentDB | Vector database for storing agent consensus decisions |
| Graphify | Knowledge graph with semantic search (42 nodes) |
| SONA | Neural trajectory learning from agent decision patterns |
| MCP | Model Context Protocol (server-based tool extension) |
| Swarm | Team of agents coordinating on a problem |
| Consensus | 2/3 agents agree on insight classification |
| Coaching Insights | Phase 7 feature: multi-agent analysis of coach behavior |

---

## Quick Commands Reference

```bash
# Trigger parallel agent team (Phase 1)
/phase-builder

# Search agent memory
/agentdb search "pattern or question"

# Spawn specialized agent
/swarm spawn agent-name "task description"

# Check team status
/swarm status

# View token spending
/cost-tracker status

# Save insights to memory
/memory save-result --question "Q" --answer "A"

# Update knowledge graph
graphify update .

# Query knowledge graph
graphify query "what is X?"
graphify path "A" "B"
graphify explain "concept"

# View diagnostic status
npx ruflo@latest init --doctor
```

---

**Status:** Ready for Phase 1! Plugins pending completion via PowerShell script.

Run: `.\install-ruflo-plugins.ps1` to complete plugin installation, then `/phase-builder` to start autonomous multi-agent development.
