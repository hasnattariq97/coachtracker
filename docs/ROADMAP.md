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

## Phase 1 — Auth System
**Read:** `/skill-auth` and `/skill-db` before starting.

### Backend
- [ ] `mkdir server && cd server && npm init -y`
- [ ] Install: `express better-sqlite3 bcrypt jsonwebtoken node-cron cors dotenv`
- [ ] Create server/index.js (Express, CORS, middleware, listen 3001)
- [ ] Create server/.env with JWT_SECRET
- [ ] Create server/db.js (SQLite tables, seed admin)
- [ ] Create server/auth.js (JWT verify, role guards)
- [ ] Create server/routes/auth.js (POST /api/auth/login)

### Frontend
- [ ] `npm create vite@latest client -- --template react`
- [ ] Install: `axios react-router-dom react-hot-toast`
- [ ] Configure TailwindCSS
- [ ] Add Vite proxy: `/api` → `http://localhost:3001`
- [ ] Create client/src/context/AuthContext.jsx
- [ ] Create client/src/components/ProtectedRoute.jsx
- [ ] Create client/src/pages/LoginPage.jsx
- [ ] Update client/src/App.jsx with routes

**Verify:** POST /api/auth/login returns JWT; login page redirects by role.

---

## Phase 2 — Coach Management
**Read:** `/skill-api` before starting.

### Backend
- [ ] Create server/routes/coaches.js
  - GET /api/coaches (with task counts)
  - POST /api/coaches (requireAdmin)
  - PUT /api/coaches/:id (requireAdmin)
  - DELETE /api/coaches/:id (requireAdmin)

### Frontend
- [ ] Create client/src/pages/admin/CoachesPage.jsx (grid of coach cards)
- [ ] Create client/src/components/AddCoachModal.jsx (create coach form)
- [ ] Edit/Delete coach actions

**Verify:** Create coach via modal → card appears; edit works; delete removes card.

---

## Phase 3 — Task Assignment & Management
**Read:** `/skill-api` and `/skill-notifications` before starting.

### Backend
- [ ] Create server/routes/tasks.js
  - GET /api/tasks (requireAdmin)
  - GET /api/tasks/mine (requireCoach)
  - POST /api/tasks (requireAdmin, creates notification)
  - PUT /api/tasks/:id (requireAdmin)
  - DELETE /api/tasks/:id (requireAdmin)
  - PUT /api/tasks/:id/complete (requireCoach, own tasks only)
  - PUT /api/tasks/:id/delay-reason (requireCoach, own tasks only)
  - GET /api/tasks/:id (admin or task owner)

### Frontend
- [ ] Create client/src/pages/admin/AssignTask.jsx (assign task form)
- [ ] Create client/src/pages/admin/TaskBoard.jsx (task table with filters)
- [ ] Create client/src/components/TaskDetailSlideOver.jsx (task detail view)
- [ ] Create client/src/components/EditTaskModal.jsx (edit task)

**Verify:** Assign task → notification created; TaskBoard shows correct status.

---

## Phase 4 — Coach Dashboard & My Tasks
**Read:** `/skill-frontend` before starting.

### Frontend
- [ ] Create client/src/pages/coach/Dashboard.jsx (welcome, stats, upcoming)
- [ ] Create client/src/pages/coach/MyTasks.jsx (tabs: All/In Progress/Completed/Overdue)
- [ ] Create client/src/components/TaskCard.jsx (reusable task card)
- [ ] Create client/src/components/DelayReasonModal.jsx (submit delay reason)

**Verify:** Coach dashboard shows correct stats; delay reason submission works.

---

## Phase 5 — Notifications System
**Read:** `/skill-notifications` and `/skill-cron` before starting.

### Backend
- [ ] Create server/routes/notifications.js
  - GET /api/notifications
  - PUT /api/notifications/:id/read
  - PUT /api/notifications/read-all
- [ ] Create server/cron.js with jobs:
  - Midpoint nudges (every hour)
  - Overdue nudges + status update
  - Idempotency checks

### Frontend
- [ ] Create client/src/components/NotificationBell.jsx (poll every 30s)
- [ ] Add NotificationBell to both admin and coach nav bars

**Verify:** Create task → cron runs → notifications appear; bell updates.

---

## Phase 6 — Polish & Admin Dashboard
### Frontend
- [ ] Create client/src/pages/admin/Dashboard.jsx (KPI cards, progress bars)
- [ ] Add loading spinners to all async calls
- [ ] Add empty states with coaching-tone copy
- [ ] Responsive design (mobile/tablet)

### Security Audit
- [ ] Test: GET /api/tasks as coach → 403
- [ ] Test: GET /api/tasks/mine as coach → only own tasks
- [ ] Test: PUT complete on another's task → 403
- [ ] Validate all inputs (max lengths, required fields)
- [ ] Ensure no password_hash in responses

**Final Verify:** Full E2E: admin assigns → coach notified → completes → admin updated.

---

## Notes
- Each phase has verification steps; run them before moving to next phase
- Seed admin: admin@tracker.com / admin123
- Backend: http://localhost:3001
- Frontend: http://localhost:5173
- See [@docs/CONTRIBUTING.md](CONTRIBUTING.md) for git workflow
- See [@docs/API.md](API.md) for endpoint reference
