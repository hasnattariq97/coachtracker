# Contributing — Coach Task Tracker

Workflow, conventions, and how Claude Code orchestrates this project using **Superpowers**.

## Superpowers: Brainstorm → Design → Plan → Execute → Review

Each task follows this cycle. See [@docs/SUPERPOWERS.md](SUPERPOWERS.md) for full details.

### How Claude Works on This Project

Each session:
1. Read [@CLAUDE.md](../CLAUDE.md) for project overview
2. Read [@docs/SUPERPOWERS.md](SUPERPOWERS.md) for workflow methodology
3. Read [@docs/ROADMAP.md](ROADMAP.md) to find next unchecked task
4. **BRAINSTORM:** Ask clarifying questions, propose designs
5. **DESIGN:** Discuss tradeoffs, get approval
6. **PLAN:** Use `/plan` for architecture (non-trivial tasks only)
7. **EXECUTE:** Read relevant skill, write tests first (RED-GREEN-REFACTOR)
8. **REVIEW:** Use `/security-reviewer` before marking complete
9. Append summary to `.claude/session-log.md` when done

## Knowledge Graph (Graphify)

This project uses **Graphify** to maintain a queryable knowledge graph of the codebase.

### Initial Setup (One-Time)
```bash
# Generate the knowledge graph (requires API key)
# You can use ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or MOONSHOT_API_KEY
export ANTHROPIC_API_KEY="sk-ant-..."
graphify extract . --out .graphify
```

### Using the Knowledge Graph

In Claude Code sessions, query the graph before manually browsing code:

```bash
# Question-based search
graphify query "How do coaches get notified of overdue tasks?"

# Find relationships between concepts
graphify path "coach_id" "notification"

# Get focused explanation of a concept
graphify explain "midpoint_nudge"
```

These queries return scoped subgraphs (usually 30-50 tokens) instead of full files, reducing token waste.

### Keeping the Graph Updated

After making code changes, refresh the graph (AST-only, no API cost):
```bash
graphify update .
```

**Git hooks auto-run this** on commit/checkout, so usually you don't need to run it manually.

### Graph Outputs

- **graphify-out/graph.json** — raw graph data (queryable)
- **graphify-out/GRAPH_REPORT.md** — broad architecture overview
- **graphify-out/graph.html** — interactive visualization
- **graphify-out/wiki/index.md** — navigation-friendly summary

For broad architecture review, read GRAPH_REPORT.md or graph.html instead of browsing raw files.

## Git Workflow

### Branch Naming
- `feature/X` — new feature
- `bugfix/X` — bug fix
- `refactor/X` — refactoring
- `docs/X` — documentation

### Commit Messages
Format: `[Phase #] Brief description`

Include RED-GREEN-REFACTOR cycle in message body:

Examples:
```
[Phase 1] Add JWT auth middleware and login route

RED-GREEN-REFACTOR:
- RED: Test POST /api/auth/login returns JWT
- GREEN: Implement minimal auth route
- REFACTOR: Extract jwt.verify to middleware
```

Better example:
```
[Phase 3] Implement task assignment with notifications

RED: Test POST /api/tasks creates notification
GREEN: Create endpoint, add notification
REFACTOR: Extract createNotification helper, add idempotency check
```

### Pushing Changes
1. Create branch from `main`: `git checkout -b feature/my-task`
2. Make changes, commit with descriptive message
3. Push: `git push -u origin feature/my-task`
4. Create pull request with phase context

## Code Conventions

### Authentication & Authorization
- All admin routes: wrap with `requireAdmin` middleware
- All coach routes: verify `req.user.id` matches task owner
- Never return `password_hash` in API responses
- Always hash passwords with bcrypt before storing

### Database
- Use prepared statements (better-sqlite3) for all queries
- Always check idempotency before inserting notifications (no double-nudge)
- Transactions for multi-step operations

### API Routes
- Validate input at route level (required fields, max lengths)
- Return 400 for bad input, 403 for auth failures, 500 for server errors
- Create notifications on state-changing actions (task assign, complete, delay reason)

### Frontend (MUST USE ui-ux-pro-max-skill)
**REQUIRED:** All frontend UI must follow the **ui-ux-pro-max-skill design system:**
- **Colors:** Teal `#0D9488` (primary), Orange `#EA580C` (accent)
- **Typography:** Plus Jakarta Sans (headings), Inter (body)
- **Framework:** Tailwind v4 with `@theme` custom properties
- **Animations:** shimmer (loading), slide (panels), celebrate (success)
- **Accessibility:** Respect `prefers-reduced-motion`

Additional frontend conventions:
- Use AuthContext for login state (localStorage + JWT)
- Poll notifications every 30s (not WebSocket)
- Show loading spinners on all async calls
- Empty states with coaching-tone copy

### Testing (Superpowers: RED-GREEN-REFACTOR)
- **RED:** Write failing test first (specify what should happen)
- **GREEN:** Write minimal code to pass test
- **REFACTOR:** Improve code without breaking tests
- Run tests before committing
- Write tests for edge cases, not just happy path
- Use real SQLite in-memory DB (not mocks)
- Target 80%+ coverage for critical paths (auth, notifications, tasks)
- See [@.claude/skills/skill-testing/SKILL.md](../.claude/skills/skill-testing/SKILL.md) for patterns

## Coaching Tone

Use these templates for notifications and error messages:

**Assigned:** "You've got a new challenge! 🎯 '[Task]' — make it happen by [date]."

**Midpoint:** "Halfway there! ⚡ Don't let momentum slip — '[Task]' is due [date]. How's it going?"

**Overdue:** "This one slipped by — and that's okay. 💪 Please share what got in the way for '[Task]' so we can move forward together."

**Empty state:** "No tasks yet — time to assign your first challenge!"

## Skills & Subagents (Superpowers)

When Claude needs to implement a feature:
- Use `/skill-auth` before auth work (JWT, bcrypt patterns)
- Use `/skill-db` before database work (SQLite patterns)
- Use `/skill-api` before API routes (Express conventions)
- Use `/skill-frontend` before React work (Vite + TailwindCSS)
- Use `/skill-notifications` before notification work (coaching tone)
- Use `/skill-cron` before cron jobs (idempotency patterns)
- **Use `/skill-testing` before writing tests** (RED-GREEN-REFACTOR)
- Use `/security-reviewer` to audit code before merging (Stage 2 review)

For complex tasks, use Agent tool:
- `Agent(Plan)` — architecture review before implementation
- `Agent(Explore)` — find code by pattern
- `Agent(general-purpose)` — multi-step implementation

## Agent-Powered Development (Ruflo)

This project uses **Ruflo** to orchestrate 90+ specialized agents for development acceleration.

### Phase Builder Agent
Spawns a team of domain agents that work in parallel on phases:
```bash
/phase-builder        # Triggers parallel agent swarm
Build Phase 1         # Natural language trigger
```

**Domain agents (in `.claude/agents/coach-task-tracker/`):**
- `auth-agent.md` — JWT, bcrypt, authentication
- `task-manager-agent.md` — database schema, CRUD, lifecycle
- `frontend-agent.md` — React components, routing, UI
- `notification-agent.md` — cron jobs, nudge logic, messaging

All agents coordinate via **AgentDB** namespace `phase-{N}` for shared progress.

### Multi-Agent Coaching Insights (Option B, Phase 7)
When coaches submit completed tasks or delay reasons, a 3-agent consensus swarm analyzes:
1. **Pattern Agent** — compares to historical coach data
2. **Growth Agent** — identifies learning opportunities
3. **Risk Agent** — flags recurring delays or blockers

Consensus → stored as `coaching_insights` notification to coach.

### Agent Commands

```bash
# Search shared agent memory
/agentdb search "How do we handle overdue tasks?"

# Spawn specialized agent for a task
/swarm spawn task-manager-agent "Implement task CRUD routes"

# Check agent team status
/swarm status

# View cost tracking
/cost-tracker status

# Save agent insights to project memory
/memory save-result --question "Q" --answer "A" --nodes node1 node2
```

### AgentDB Namespaces
- `phase-{N}` — agents working on phase N store shared progress
- `claude-memories` — auto-synced from `~/.claude/projects/*/memory/`
- `patterns` — neural learning trajectories (SONA)
- Reserved: do NOT shadow `pattern`, `default`

## Common Commands

```bash
# Run dev servers
cd server && node index.js &
cd client && npm run dev

# Stop servers
# Ctrl+C in both terminals

# Lint & format
cd client && npm run lint

# Tests (when added)
cd server && npm test
cd client && npm test

# View database
sqlite3 server/tracker.db

# Check audit log
cat .claude/audit.log
```

## Debugging

### Backend Won't Start
- Check `.env` has `JWT_SECRET`
- Check `npm install` ran and `node_modules/` exists
- Check port 3001 not in use: `lsof -i :3001`

### Frontend Won't Connect
- Check backend is running on 3001
- Check Vite proxy config in `vite.config.js`
- Check browser console for CORS errors

### Notifications Not Showing
- Check notifications table has rows: `SELECT COUNT(*) FROM notifications;`
- Check NotificationBell is polling every 30s
- Check user_id matches logged-in user

### Cron Jobs Not Running
- Check cron.js is imported in server/index.js
- Check schedule in .env or cron.js (default: '0 * * * *')
- For testing, use '*/1 * * * *' (every minute)

## References

- [@docs/ARCHITECTURE.md](ARCHITECTURE.md) — why we chose SQLite, JWT, node-cron
- [@docs/ROADMAP.md](ROADMAP.md) — phase checklist
- [@docs/API.md](API.md) — endpoint reference
- [@CLAUDE.md](../CLAUDE.md) — project brain
