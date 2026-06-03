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

## Phase 6 — Polish & Security Audit ⬅️ NEXT
**Read:** `/security-reviewer` before starting.

### Frontend ✅ (already done)
- [x] client/src/pages/admin/Dashboard.jsx — KPI cards, coach progress bars, recent tasks table
- [x] Loading skeletons on all async calls
- [x] Empty states with coaching-tone copy
- [x] Responsive design with mobile sidebar hamburger

### Security Audit & Input Validation ❌ (next priority)
- [ ] Run `/security-reviewer` on Phase 3+5 routes (tasks.js, notifications.js)
- [ ] Input validation tests:
  - [ ] Empty title → 400
  - [ ] Title > 255 chars → 400
  - [ ] Missing coach_id → 400
  - [ ] Invalid dates (past, too far future) → validation
  - [ ] Delay reason > 1000 chars → 400
- [ ] Permission tests:
  - [ ] GET /api/tasks as coach → 403 ✅ (tested)
  - [ ] GET /api/tasks/mine as coach → only own tasks ✅ (tested)
  - [ ] PUT .../complete on other's task → 403 ✅ (tested)
- [ ] Response security:
  - [ ] Ensure no password_hash in any response ✅ (tested)
  - [ ] Ensure no internal errors leak (wrapped in try-catch) ✅
- [ ] Cron idempotency:
  - [ ] Run jobs twice, verify no duplicate notifications
  - [ ] Verify status changes only on first run

**Final E2E Verify:** Admin assigns → coach notified → coach completes → admin notified → cron runs and is idempotent.

---

## Phase 7 — Multi-Agent Coaching Insights (Option B)
- [ ] server/agents/coaching-swarm.js
- [ ] server/routes/insights.js
- [ ] coaching_insights table in db.js
- [ ] client/src/components/CoachInsights.jsx

---

## Notes
- Seed admin: admin@tracker.com / admin123
- Backend: http://localhost:3001
- Frontend: http://localhost:5173
- Handoff doc: [@docs/HANDOFF.md](HANDOFF.md)
- See [@docs/CONTRIBUTING.md](CONTRIBUTING.md) for git workflow
- See [@docs/API.md](API.md) for endpoint reference
