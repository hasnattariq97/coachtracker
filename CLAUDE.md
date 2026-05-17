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
