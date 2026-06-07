# Build Roadmap — Coach Task Tracker

Phased implementation checklist. Find the first unchecked task and read the relevant skill file before implementing.

## Phase 0 — Agentic Scaffold ✅
- [x] CLAUDE.md (project brain)
- [x] docs/ARCHITECTURE.md (design decisions)
- [x] docs/ROADMAP.md (this file)
- [x] docs/CONTRIBUTING.md (workflow)
- [x] docs/API.md (endpoint reference)
- [x] .claude/skills/skill-auth/SKILL.md
- [x] .claude/skills/skill-db/SKILL.md
- [x] .claude/skills/skill-api/SKILL.md
- [x] .claude/skills/skill-frontend/SKILL.md
- [x] .claude/skills/skill-notifications/SKILL.md
- [x] .claude/skills/skill-cron/SKILL.md
- [x] .claude/agents/security-reviewer.md
- [x] .claude/hooks/* (pre-tool-use, post-tool-use, on-stop)
- [x] .claude/settings.json (permissions, hooks config)

---

## Phase 1 — Auth System ✅
**Backend**
- [x] server/index.js (Express, CORS, middleware, listen 3001)
- [x] server/.env with JWT_SECRET
- [x] server/db.js (SQLite tables: users + tasks + notifications, admin seed, name column migration)
- [x] server/auth.js (JWT verify, role guards: authenticateToken, requireAdmin, requireCoach)
- [x] server/routes/auth.js (POST /api/auth/login)

**Frontend**
- [x] client/ — Vite + React + TailwindCSS v4 + Axios + lucide-react + react-hot-toast
- [x] client/vite.config.js — proxy /api → localhost:3001
- [x] client/src/index.css — @theme tokens (teal/orange palette), Google Fonts (Plus Jakarta Sans + Inter), animations
- [x] client/src/context/AuthContext.jsx — JWT decode, login/logout, axios interceptors (auto-attach token, 401 redirect)
- [x] client/src/components/ProtectedRoute.jsx — role-based guard, nested Outlet support
- [x] client/src/pages/LoginPage.jsx — split panel, teal gradient, coaching welcome
- [x] client/src/App.jsx — lazy-loaded routes, role-based redirect

**Verified:** POST /api/auth/login returns JWT ✅ Login page redirects by role ✅

---

## Phase 2 — Coach Management ✅
**Backend**
- [x] server/routes/coaches.js
  - [x] GET /api/coaches (with task counts: assigned/completed/overdue)
  - [x] POST /api/coaches (requireAdmin, bcrypt hash, 409 on duplicate email)
  - [x] PUT /api/coaches/:id (requireAdmin, update name/email/password)
  - [x] DELETE /api/coaches/:id (requireAdmin, cascade deletes tasks)

**Frontend**
- [x] client/src/pages/admin/CoachesPage.jsx — coach grid with add/edit/delete modals
- [x] AddCoachModal built into CoachesPage (inline component)
- [x] Edit/Delete coach actions with confirmation modal

**Verified:** Create coach via modal → card appears ✅ Edit works ✅ Delete removes card ✅

---

## Phase 3 — Task Assignment & Management ✅
**Backend:** All 8 endpoints implemented, tested, and integrated with Phase 5 notifications ✅

### Backend ✅ (complete)
- [x] server/routes/tasks.js
  - [x] GET /api/tasks (requireAdmin, ?coach_id= and ?status= filters, include coach_name)
  - [x] GET /api/tasks/mine (requireCoach, scoped to req.user.id)
  - [x] POST /api/tasks (requireAdmin, creates task + 'assigned' notification for coach)
  - [x] PUT /api/tasks/:id (requireAdmin, update title/description/priority/due_date)
  - [x] DELETE /api/tasks/:id (requireAdmin)
  - [x] PUT /api/tasks/:id/complete (requireCoach, own tasks only, notifies admin)
  - [x] PUT /api/tasks/:id/delay-reason (requireCoach, own tasks only, notifies admin)
  - [x] GET /api/tasks/:id (admin OR task owner)

### Frontend ✅ (already built and working)
- [x] client/src/pages/admin/AssignTask.jsx
- [x] client/src/pages/admin/TaskBoard.jsx
- [x] client/src/components/TaskDetailSlideOver.jsx
- [x] client/src/components/EditTaskModal.jsx

**Verified:** Assign task → notification created ✅ TaskBoard shows correct status ✅

---

## Phase 3+ — Multi-Coach Task Assignment ✅
**Feature:** Assign a single task to multiple coaches simultaneously. Each coach receives their own task instance.

### Backend ✅
- [x] server/routes/tasks.js POST endpoint now accepts both:
  - Legacy: `coach_id` (single) — backward compatible
  - New: `coach_ids` (array) — supports multiple coaches
- [x] Validation loop validates all coach IDs atomically (no partial creation)
- [x] Creates one task per coach with individual notifications
- [x] Returns array of created task IDs

### Frontend ✅
- [x] client/src/pages/admin/AssignTask.jsx — multi-select dropdown instead of single select
- [x] Coach selection displays as removable teal tags
- [x] "Select all coaches" option + toggle for each coach
- [x] Dynamic success message: "assigned to X coach(es)"

**Verified:** Multi-select dropdown works ✅ Tasks created for both coaches ✅ Each coach notified ✅ Backward compatible ✅

---

## Phase 4 — Coach Dashboard & My Tasks ✅ (Frontend)
**Frontend**
- [x] client/src/pages/coach/Dashboard.jsx — personalized greeting, KPIs, upcoming tasks
- [x] client/src/pages/coach/MyTasks.jsx — tabs: All/Active/Completed/Overdue
- [x] client/src/components/TaskCard.jsx — priority border, completion animation, delay reason button
- [x] client/src/components/DelayReasonModal.jsx — coaching-tone prompt

**Note:** Pages render correctly but show empty/error until Phase 3 backend is done.

---

## Phase 5 — Notifications System ✅
**Backend:** 3 API endpoints + 2 cron jobs implemented, tested, and running ✅

### Backend ✅ (complete)
- [x] server/routes/notifications.js
  - [x] GET /api/notifications (user's own, newest first, includes task_title)
  - [x] PUT /api/notifications/:id/read (own only, 403 if not owner)
  - [x] PUT /api/notifications/read-all (mark all unread as read for current user)
- [x] server/cron.js
  - [x] Midpoint nudge: now >= assigned_at + (due_date - assigned_at)/2 → notify coach
  - [x] Overdue job: now > due_date AND status != 'completed' → status=overdue, notify coach + admin
  - [x] Idempotency: check (task_id, type, user_id) before inserting notifications
  - [x] Cron.js imported in server/index.js, scheduleJobs() called on startup

### Frontend ✅ (already built and working)
- [x] client/src/components/NotificationBell.jsx — 30s poll, unread badge, dropdown, mark-read
- [x] NotificationBell in Header (visible to both admin and coach)

**Verified:** Create task → coach notified ✅ Complete task → admin notified ✅ Bell updates ✅ Cron jobs scheduled ✅

---

## Phase 6 — Polish & Security Audit ✅ COMPLETE

**Backend Security Audit (11 findings resolved):**

### HIGH Priority Fixes ✅
- [x] H1: due_date validation (format + not-in-past) in tasks POST/PUT
- [x] H2: coach_id & status validation with Number.isInteger checks
- [x] H3: status query param whitelist (assigned|in_progress|completed|overdue)

### MEDIUM Priority Fixes ✅
- [x] M1: Email format validation (regex check in coaches.js POST/PUT)
- [x] M2: Field length bounds (name: 100, description: 2000 chars)
- [x] M3: Atomic idempotency (UNIQUE index + INSERT OR IGNORE for notifications)
- [x] M4: Status guards (prevent re-completion, delay on completed tasks)

### LOW Priority Fixes ✅
- [x] L1: try/catch for DELETE in coaches.js
- [x] L2: Number.parseInt(id, 10) with isInteger check on all ID params
- [x] L3: CORS restricted to CLIENT_ORIGIN env var (not open to all)

### Frontend ✅
- [x] client/src/pages/admin/Dashboard.jsx — KPI cards, coach progress bars, recent tasks table
- [x] Loading skeletons on all async calls
- [x] Empty states with coaching-tone copy
- [x] Responsive design with mobile sidebar hamburger

### Testing ✅
- [x] 33 comprehensive Phase 6 security tests (input validation, permissions, idempotency, edge cases)
- [x] 31 Phase 3+5 route tests (23 tasks, 8 notifications) — all passing
- [x] No SQL injection, auth bypass, or password_hash leaks found
- [x] E2E verified: Admin assigns → coach notified → coach completes → admin notified → cron runs idempotently

---

## Phase 6+ — E2E Testing with Agent-Browser ✅ VERIFIED & PASSING

**Feature:** Rust-based browser automation for deterministic, LLM-friendly E2E testing with element refs.

### Implementation ✅ (Complete)
- [x] Installed agent-browser v0.27.1 (`client/node_modules/agent-browser`)
- [x] Created helper class: `client/src/__tests__/e2e/agent-browser.helper.js`
- [x] Admin workflow tests: `client/src/__tests__/e2e/admin.workflow.test.js` (4/4 ✅)
- [x] Coach workflow tests: `client/src/__tests__/e2e/coach.workflow.test.js` (5/5 ✅)
- [x] Simple verification tests: `client/src/__tests__/e2e/simple.test.js` (2/2 ✅)
- [x] Configuration: `client/agent-browser.config.js`
- [x] npm script: `npm run test:e2e`
- [x] Documentation: `docs/E2E-AGENT-BROWSER.md`
- [x] Handoff guide: `docs/HANDOFF-AGENT-BROWSER.md`
- [x] Demo/verification: `client/test-agent-browser.js` ✓ Verified
- [x] Session summary: `docs/SESSION-SUMMARY-AGENT-BROWSER.md`

### Test Results ✅
**11/11 tests passing:**
- Admin page navigation: 4/4 ✅
- Coach page navigation: 5/5 ✅
- Basic functionality: 2/2 ✅

### Key Features ✅
- Element refs (`@e1`, `@e2`) — stable, deterministic
- Accessibility tree snapshots — structured text output
- Screenshot capture — PNG screenshots working
- Page navigation — all routes accessible
- Standalone CLI — works outside Claude Code
- CI/CD ready — perfect for GitHub Actions pipelines

**Status:** 11/11 tests passing, ready for Phase 7 integration

---

## Phase 7 — Multi-Agent Coaching Insights ✅
When coaches submit completed tasks or delay reasons, a 3-agent consensus swarm analyzes:
- [x] Pattern Agent: compares to historical coach data
- [x] Growth Agent: identifies learning opportunities  
- [x] Risk Agent: flags recurring delays or blockers
- [x] Results stored as coaching_insights notifications to coach
- [x] Can verify UI state with agent-browser in live app
- [x] Messages diversified by task context and specific metrics (not generic praise)

**Implementation:** Async fire-and-forget via **Groq API** (free tier, no credit card). Uses llama-3.3-70b-versatile model. Agents call in parallel (10s timeout each, 30s total). Results stored in notifications table with structured metadata. UI renders special card with expandable details. **Setup:** Get free Groq key at https://console.groq.com, add `GROQ_API_KEY=gsk_...` to `server/.env`.

---

## Phase 7+ — Data Persistence with PostgreSQL ✅
**Feature:** Migrate from SQLite to Railway PostgreSQL to solve data loss on Render redeploys.

### Implementation ✅ (Complete — 2026-06-06)
- [x] Created Railway free PostgreSQL database
- [x] Installed `pg` package, removed `better-sqlite3`
- [x] Rewrote `server/db.js` for async PostgreSQL operations
- [x] Auto-creates tables on startup, seeds admin user
- [x] Forced IPv4 DNS with `dns.setDefaultResultOrder('ipv4first')`
- [x] Increased connection timeout to 30s for SSL handshake
- [x] Added to Render environment: `DATABASE_URL=postgresql://...`
- [x] Verified data persists across Render redeploys ✅

**Result:** Data no longer lost on redeploy! Database survives service restarts with Railway PostgreSQL.

---

## Phase 7+ — Notifications & Coaching Insights Fix ✅
**Status:** Fixed & Deployed (2026-06-07)

### Issues Fixed ✅
- [x] **Regular "assigned" notifications** — Fixed missing `created_at` column in PostgreSQL INSERT
- [x] **Coaching insights** — Verified 3-agent swarm working with Groq API
- [x] **Database compatibility** — Removed problematic `ON CONFLICT` clause, improved idempotency

### Implementation ✅
- [x] Updated `createNotification()` in server/routes/tasks.js
- [x] Added explicit `created_at` column with `CURRENT_TIMESTAMP`
- [x] Verified environment variables set on Railway (GROQ_API_KEY, COACHING_INSIGHTS_ENABLED)
- [x] Tested end-to-end: task creation → assigned notification ✅, task completion → coaching insights ✅
- [x] Deployed via Railway CLI, verified in production

### Verification ✅
- [x] Assigned notifications appear immediately when admin creates task
- [x] Coaching insights appear 2-3 seconds after coach completes task
- [x] 3-agent swarm analyzing patterns, growth, and risks
- [x] All features working in production

---

## Phase 7+ — Task Resource Links ✅
**Feature:** Attach resource links (Google Sheets, Drive folders, Docs, etc.) to task assignments so coaches can access all context in one place.

### Backend ✅
- [x] server/db.js: `links` TEXT column on tasks table (stores JSON array)
- [x] server/routes/tasks.js POST: accepts `links` parameter (array of {label, url})
- [x] Validates URLs (must be http/https)
- [x] Stores as JSON, returns in task responses
- [x] Multi-coach assignment: each coach gets identical links

### Frontend ✅
- [x] client/src/pages/admin/AssignTask.jsx: "📎 Attach Resources" section
- [x] Add Link button: label + URL validation
- [x] Remove Link button: per-link deletion
- [x] Display shows teal link cards before form submission
- [x] client/src/components/TaskCard.jsx: "📎 Resources" section with clickable links
- [x] client/src/components/TaskDetailSlideOver.jsx: Admin modal shows links
- [x] Links open in new tab with external link icon

**Verified:** Links saved to database ✅ Display on coach dashboard ✅ Clickable and functional ✅

---

## Project Status Summary

| Phase | Feature | Status | Tests |
|-------|---------|--------|-------|
| 0 | Agentic Scaffold | ✅ Complete | — |
| 1 | Auth System | ✅ Complete | 3/3 |
| 2 | Coach Management | ✅ Complete | 4/4 |
| 3 | Task Assignment | ✅ Complete | 23/23 |
| 3+ | Multi-Coach Assignment | ✅ Complete | ✅ Verified |
| 4 | Coach Dashboard | ✅ Complete | — |
| 5 | Notifications | ✅ Complete | 8/8 |
| 6 | Security Audit | ✅ Complete | 33/33 |
| 6+ | Agent-Browser E2E Testing | ✅ Complete | 11/11 |
| 7 | Multi-Agent Insights | ✅ Complete | 15+ tests |
| 7+ | Notifications & Insights Fix | ✅ Complete | ✅ Verified (2026-06-07) |
| 7+ | Task Resource Links | ✅ Complete | ✅ E2E verified |
| 7+ | PostgreSQL (Railway) | ✅ Complete | ✅ Verified (2026-06-06) |

**Total Tests Passing:** 119+ (108 backend unit/integration + 11 E2E via agent-browser)  
**E2E Testing:** Agent-browser integration complete and verified  
**Security Findings:** 11/11 resolved (0 critical, 0 active bypasses)  
**Features Complete:** 13/13 (Phases 0-7 plus multi-coach, notifications fix, resource links, persistent database)  
**Database:** PostgreSQL (Railway) — data persists across Render redeploys ✅  
**Notifications:** ✅ Both assigned notifications and coaching insights working (verified 2026-06-07)

---

## Quick Start

### Run App
```bash
cd server && node index.js &          # Backend on :3001
cd client && npm run dev &            # Frontend on :5173
```

### Run Tests
```bash
cd server && NODE_ENV=test npm test   # 108+ unit/integration tests pass
cd client && npm run test:e2e         # 11 E2E tests pass via agent-browser
```

### Login Credentials
- **Admin:** admin@tracker.com / admin123
- **Coach:** create via UI or seed directly

---

## Handoff & Documentation
- **Comprehensive Handoff:** [@docs/HANDOFF.md](HANDOFF.md)
- **Agent-Browser E2E Testing:** [@docs/HANDOFF-AGENT-BROWSER.md](HANDOFF-AGENT-BROWSER.md)
- **E2E Testing Guide:** [@docs/E2E-AGENT-BROWSER.md](E2E-AGENT-BROWSER.md)
- **E2E Test Coverage & Roadmap:** [@docs/E2E-TEST-COVERAGE.md](E2E-TEST-COVERAGE.md) ← Current: 11/11 passing
- **Development Workflow:** [@docs/CONTRIBUTING.md](CONTRIBUTING.md)
- **API Endpoints:** [@docs/API.md](API.md)
- **Architecture Decisions:** [@docs/ARCHITECTURE.md](ARCHITECTURE.md)
