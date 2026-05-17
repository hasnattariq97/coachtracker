# PLANNING.md — Coach Task Tracker Build Roadmap

> Claude: Start each session by reading this file. Find the first unchecked box.
> Read the relevant skill/*.md file before implementing. Check boxes as you complete them.
> Append a SESSION_LOG.md entry when stopping.

---

## Phase 0 — Agentic Scaffold
Create all project meta-files and hooks before writing any app code.

### 0.1 Root Files
- [x] Create CLAUDE.md (drawing room, links all files)
- [x] Create PLANNING.md (this file)
- [x] Create MEMORY.md (seed creds, ports, env vars)
- [x] Create DECISION.md (architectural rationale)
- [x] Create SESSION_LOG.md (empty template)

### 0.2 Claude Settings & Hooks
- [x] Create .claude/settings.json (permissions, env, hooks config)
- [x] Create .claude/hooks/pre-tool-use.sh (block rm -rf non-temp paths)
- [x] Create .claude/hooks/post-tool-use.sh (append to .claude/audit.log)
- [x] Create .claude/hooks/on-stop.sh (echo prompt to append SESSION_LOG)
- [x] Make all hooks executable (chmod +x on Linux; note: Windows PowerShell scripts)

### 0.3 Skill Files
- [x] Create skills/skill-orchestrator.md
- [x] Create skills/skill-auth.md (JWT, bcrypt, middleware pattern)
- [x] Create skills/skill-db.md (schema DDL, better-sqlite3 usage)
- [x] Create skills/skill-api.md (Express router, error handler, validation)
- [x] Create skills/skill-frontend.md (Vite config, Tailwind, AuthContext, axios wrapper)
- [x] Create skills/skill-notifications.md (table schema, coaching messages, polling)
- [x] Create skills/skill-cron.md (node-cron setup, idempotency pattern)

**Verify Phase 0:** All files exist; `cat CLAUDE.md` is readable and under 100 lines.

---

## Phase 1 — Auth System
Read [skill-auth.md](skills/skill-auth.md) and [skill-db.md](skills/skill-db.md) first.

### 1.1 Backend: Project Init
- [ ] `mkdir server && cd server && npm init -y`
- [ ] Install deps: `express better-sqlite3 bcrypt jsonwebtoken node-cron cors dotenv`
- [ ] Create server/index.js (Express app, CORS, JSON middleware, routes mount, listen 3001)
- [ ] Create server/.env with JWT_SECRET=your-secret-here
- [ ] Add server/.env and server/tracker.db to .gitignore

### 1.2 Backend: Database
- [ ] Create server/db.js — open tracker.db, run CREATE TABLE IF NOT EXISTS for all 3 tables
  - users: id, name, email, password_hash, role, created_at
  - tasks: id, coach_id, title, description, status, priority, assigned_at, due_date, completed_at, delay_reason
  - notifications: id, user_id, task_id, type, message, read, created_at
- [ ] Seed script in db.js: insert admin@tracker.com / admin123 (hashed) on first run
- [ ] Update MEMORY.md with seed credentials

### 1.3 Backend: Auth Route
- [ ] Create server/routes/auth.js
  - POST /api/auth/login: validate email+password, bcrypt.compare, return signed JWT {id, name, role, email}
  - Return 401 on invalid credentials (no leak of which field was wrong)
- [ ] Create server/auth.js — JWT verify middleware, attach req.user
- [ ] Create requireAdmin and requireCoach helper guards
- [ ] Mount /api/auth in server/index.js

### 1.4 Frontend: Project Init
- [ ] `npm create vite@latest client -- --template react` in d:\Cursor_new
- [ ] Install client deps: `axios react-router-dom react-hot-toast`
- [ ] Install + configure TailwindCSS (tailwind.config.js, index.css)
- [ ] Add `server: { proxy: { '/api': 'http://localhost:3001' } }` to vite.config.js

### 1.5 Frontend: Auth Shell
- [ ] Create client/src/context/AuthContext.jsx
  - login(token): decode JWT, store in localStorage, set state
  - logout(): clear localStorage + state
  - Expose: user, login, logout, isAdmin, isCoach
- [ ] Create client/src/components/ProtectedRoute.jsx (redirect if no user or wrong role)
- [ ] Create client/src/pages/LoginPage.jsx (email + password form, POST /api/auth/login, redirect by role)
- [ ] Update client/src/App.jsx — routes: /login, /admin/*, /coach/*

**Verify Phase 1:**
- POST /api/auth/login with seed creds → 200 + JWT
- POST with wrong password → 401
- Login in browser → lands on /admin or /coach based on role
- Refresh page → stays logged in (token in localStorage)

---

## Phase 2 — Coach Management
Read [skill-api.md](skills/skill-api.md) first.

### 2.1 Backend: Coaches Routes
- [ ] Create server/routes/coaches.js
  - GET /api/coaches: all coaches with task counts (assigned, completed, overdue) via SQL aggregation
  - POST /api/coaches: name, email, password (hash it), role='coach' — requireAdmin
  - PUT /api/coaches/:id: update name/email — requireAdmin
  - DELETE /api/coaches/:id: delete coach + cascade delete their tasks — requireAdmin
- [ ] Mount /api/coaches in server/index.js

### 2.2 Frontend: CoachesPage (Admin)
- [ ] Create client/src/pages/admin/CoachesPage.jsx
  - Grid of coach cards: initials avatar, name, email, task counts (assigned/completed/overdue)
  - Overdue count shown in red badge
  - "Add Coach" button → AddCoachModal
- [ ] Create client/src/components/AddCoachModal.jsx
  - Fields: name, email, temporary password
  - POST /api/coaches on submit → refresh list → success toast
- [ ] Edit coach: inline modal (PUT /api/coaches/:id)
- [ ] Delete coach: confirm dialog → DELETE /api/coaches/:id → success toast

**Verify Phase 2:**
- Create coach via modal → card appears in grid
- Edit name → card updates
- Delete coach → card removed
- GET /api/coaches returns task counts correctly

---

## Phase 3 — Task Assignment & Management
Read [skill-api.md](skills/skill-api.md) and [skill-notifications.md](skills/skill-notifications.md) first.

### 3.1 Backend: Task Routes
- [ ] Create server/routes/tasks.js
  - GET /api/tasks: all tasks with coach name, days remaining — requireAdmin
  - GET /api/tasks/mine: tasks for req.user.id — requireCoach
  - POST /api/tasks: assign task (coach_id, title, description, priority, due_date), set assigned_at=now, status=assigned, create 'assigned' notification for coach — requireAdmin
  - PUT /api/tasks/:id: edit title/description/priority/due_date — requireAdmin
  - DELETE /api/tasks/:id — requireAdmin
  - PUT /api/tasks/:id/complete: set status=completed, completed_at=now, create 'completed' notification for admin — requireCoach (own tasks only)
  - PUT /api/tasks/:id/delay-reason: save delay_reason text, create 'delay_submitted' notification for admin — requireCoach (own tasks only)
  - GET /api/tasks/:id: single task detail — admin or task owner
- [ ] Mount /api/tasks in server/index.js

### 3.2 Frontend: AssignTask (Admin)
- [ ] Create client/src/pages/admin/AssignTask.jsx
  - Select coach (populated from GET /api/coaches)
  - Title, description textarea, priority radio (low/medium/high), due date picker
  - POST /api/tasks on submit → success toast "Task assigned! Coach has been notified."

### 3.3 Frontend: TaskBoard (Admin)
- [ ] Create client/src/pages/admin/TaskBoard.jsx
  - Table: Coach | Task | Priority | Status | Due Date | Days Left | Actions
  - Filter bar: by coach (dropdown), by status (tabs), by priority
  - Status badges: assigned=blue, in_progress=yellow, completed=green, overdue=red
  - Overdue rows: red background tint
  - Row click → TaskDetailSlideOver
- [ ] Create client/src/components/TaskDetailSlideOver.jsx
  - Shows: title, description, coach name, priority, due date, status, delay reason (if submitted)
  - Edit button (admin): opens edit modal
- [ ] Create client/src/components/EditTaskModal.jsx (PUT /api/tasks/:id)

**Verify Phase 3:**
- Assign task → coach notification created in DB
- TaskBoard shows task with correct status badge
- Click overdue task → slide-over shows delay reason field

---

## Phase 4 — Coach Dashboard & My Tasks
Read [skill-frontend.md](skills/skill-frontend.md) first.

### 4.1 Frontend: Coach Dashboard
- [ ] Create client/src/pages/coach/Dashboard.jsx
  - Header: "Welcome back, [Name]! Let's make today count."
  - Stats row: Total Assigned / Completed / Overdue (computed from GET /api/tasks/mine)
  - "Upcoming" section: next 3 tasks by due date (card format: title, priority badge, days left)
  - Notification bell in top nav

### 4.2 Frontend: My Tasks
- [ ] Create client/src/pages/coach/MyTasks.jsx
  - Tabs: All / In Progress / Completed / Overdue
  - Task cards: title, priority badge, due date, days left / days overdue (red if past)
  - "Start Task" button → PUT /api/tasks/:id with {status: 'in_progress'}
  - "Mark Complete" button → PUT /api/tasks/:id/complete
  - Overdue cards: red banner + delay reason textarea + Submit button
- [ ] Create client/src/components/TaskCard.jsx (reusable card with all button states)
- [ ] Create client/src/components/DelayReasonModal.jsx
  - Coaching prompt: "Every setback is a setup for a comeback. Help us understand:"
  - Textarea (required) + Submit → PUT /api/tasks/:id/delay-reason
  - On success: card shows "Reason submitted — your admin has been notified."

**Verify Phase 4:**
- Coach dashboard shows correct stats
- Start Task changes card to In Progress
- Mark Complete removes from active list
- Submit delay reason on overdue card → card updates, admin notification created

---

## Phase 5 — Notifications System
Read [skill-notifications.md](skills/skill-notifications.md) and [skill-cron.md](skills/skill-cron.md) first.

### 5.1 Backend: Notifications Routes
- [ ] Create server/routes/notifications.js
  - GET /api/notifications: logged-in user's notifications, newest first
  - PUT /api/notifications/:id/read: mark single read
  - PUT /api/notifications/read-all: mark all read for logged-in user
- [ ] Mount /api/notifications in server/index.js

### 5.2 Frontend: NotificationBell
- [ ] Create client/src/components/NotificationBell.jsx
  - Poll GET /api/notifications every 30 seconds
  - Red badge shows unread count (hide if 0)
  - Click → dropdown panel listing notifications
  - Each item: icon by type, coaching-tone message, time-ago, task name
  - "Mark all read" button at top
- [ ] Add NotificationBell to both admin and coach nav bars

### 5.3 Backend: Cron Jobs
- [ ] Create server/cron.js — imported and started in server/index.js
  - Schedule: `'0 * * * *'` (every hour; use `'*/2 * * * *'` for testing)
  - Midpoint job:
    - Query: tasks where now >= midpoint AND no 'midpoint_nudge' notification exists
    - Insert coaching-tone midpoint notification for each coach
    - Log count to console
  - Overdue job:
    - Query: tasks where due_date < now AND status != 'completed' AND status != 'overdue'
    - Update status = 'overdue'
    - Insert coaching-tone overdue notification for each coach
    - Insert admin summary notification
  - Idempotency: check notification exists before inserting (no double-nudge)

**Verify Phase 5:**
- Create task with due_date = 2 minutes from now; assigned_at = 4 minutes ago
- Trigger cron manually (or set `*/1 * * * *`) → verify midpoint + overdue notifications created
- Bell badge updates within 30s
- Mark all read → badge disappears

---

## Phase 6 — Polish & Admin Dashboard
### 6.1 Admin Dashboard
- [ ] Create client/src/pages/admin/Dashboard.jsx
  - KPI cards: Total Coaches / Tasks Assigned / Completed / Overdue
  - Per-coach progress bars (assigned vs completed) from GET /api/coaches
  - Recent activity feed: last 10 notifications across all users
  - Quick-action buttons: "Add Coach", "Assign Task"

### 6.2 UI Polish
- [ ] Loading spinners on all async calls (useState isLoading)
- [ ] Empty states with coaching-tone copy: "No tasks yet — time to assign your first challenge!"
- [ ] Responsive layout (works on tablet/large phone)
- [ ] Consistent TailwindCSS color tokens (primary, success, warning, danger)

### 6.3 Security Audit
- [ ] Test: call GET /api/tasks (admin route) with coach JWT → expect 403
- [ ] Test: call GET /api/tasks/mine as coach → only see own tasks
- [ ] Test: PUT /api/tasks/:id/complete on another coach's task → expect 403
- [ ] Input validation: max lengths, required fields on all POST/PUT
- [ ] Ensure password_hash never appears in any API response

**Final Verification:**
- Full E2E: admin assigns task → coach notified → marks complete → admin notified
- Overdue flow: past due → cron sets overdue → coach submits delay reason → admin reads it
- Role guards: all cross-role access attempts return 403
