# Regional Scoping & Multi-Tenancy — Design Spec

**Date:** 2026-06-17  
**Status:** Approved  
**Goal:** Allow each of 6 regional managers to use the app independently, scoped to their own coaches and tasks, with a super_admin account for cross-region oversight.

---

## 1. Role Hierarchy

Three roles (extending existing `admin` | `coach`):

| Role | Description |
|---|---|
| `super_admin` | Cross-region oversight. Read-only view of all regions. Can create/edit/delete admin accounts. Cannot manage coaches or tasks. |
| `admin` | Regional manager. Scoped entirely to their region. Full coach + task management within region. |
| `coach` | Unchanged. Scoped to own tasks only. |

---

## 2. Accounts

All seeded at startup via migration (bcrypt-hashed passwords, ON CONFLICT DO NOTHING):

| Name | Email | Role | Region | Password |
|---|---|---|---|---|
| Super Admin | hasnattariq97@gmail.com | super_admin | — | superadmin123* |
| Hasnat Tariq | hasnat@niete.edu.pk | admin | Urban-I | Hasnat97 |
| Hashir Hussain | hashir.hussain@niete.edu.pk | admin | Sihala | hashir1234 |
| Anam Masood | anam.masood@niete.edu.pk | admin | Urban-II | anam1234 |
| Sara Fatima | sara.fatima@niete.edu.pk | admin | Nilore | sara1234 |
| Asma Zaheer | asma.zaheer@niete.edu.pk | admin | Barakahu | asma1234 |
| Abdul Waheed | abdul.waheed@niete.edu.pk | admin | Tarnol | waheed1234 |

---

## 3. Data Model

### New: `regions` table
```sql
CREATE TABLE IF NOT EXISTS regions (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);
-- Seeded: Urban-I, Urban-II, Barakahu, Tarnol, Nilore, Sihala
```

### Changed: `users` table
- Add `region_id INTEGER REFERENCES regions(id)` — nullable (NULL for super_admin)
- Extend role CHECK: `role IN ('super_admin', 'admin', 'coach')`

### Unchanged: `tasks`, `notifications`, all other tables
Tasks are already linked to coaches via `coach_id`. Filtering tasks by region = JOIN through coach → `coach.region_id`.

### Migration (runs at server startup)
1. Create `regions` table and seed 6 rows
2. `ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id`
3. Update existing coaches → `region_id = Urban-I`
4. Update `hasnat@niete.edu.pk` → `region_id = Urban-I`
5. Seed 6 new admin accounts + 1 super_admin (INSERT ON CONFLICT DO NOTHING)

---

## 4. Auth & Middleware

### JWT payload
```json
{ "id": 1, "role": "super_admin", "region_id": null }
{ "id": 2, "role": "admin", "region_id": 1 }
```

### New middleware (server/auth.js)
- `requireSuperAdmin` — blocks anyone who isn't `super_admin`
- `requireAdmin` — unchanged, blocks non-admins
- `regionFilter(user)` — helper:
  ```javascript
  function regionFilter(user) {
    if (user.role === 'super_admin') return null;
    return user.region_id;
  }
  ```

### Region filtering pattern (applied in every admin route)
```javascript
const regionId = regionFilter(req.user);
// Without filter (super_admin):
await query('SELECT * FROM users WHERE role = $1', ['coach']);
// With filter (admin):
await query('SELECT * FROM users WHERE role = $1 AND region_id = $2', ['coach', regionId]);
```

---

## 5. Backend Routes

### New routes — `server/routes/admins.js` (requireSuperAdmin)
```
GET    /api/admins              List all regional admins
POST   /api/admins              Create admin (name, email, password, region_id)
PUT    /api/admins/:id          Update admin (name, email, password)
DELETE /api/admins/:id          Delete admin account

GET    /api/regions/overview    6 region cards: coach count, active tasks, overdue tasks
GET    /api/regions/:id/coaches Read-only coach list for a region
GET    /api/regions/:id/tasks   Read-only task list for a region
```

### Changed routes — coaches.js, tasks.js
- Add `regionFilter` to every admin query
- No new routes — regional admins use exact same endpoints, just silently scoped

---

## 6. Frontend

### New pages (Super Admin only)

**`/super-admin/overview`** — Landing page after super_admin login:
- 6 region cards in a 3×2 grid
- Each card: region name, coach count, active task count, overdue count (orange)
- Click card → drill-in view

**`/super-admin/region/:id`** — Drill-in (read-only):
- Back button → overview
- Region name + "Managed by: [admin name]" badge
- Table: coach name | active tasks | completed | overdue

**`/super-admin/admins`** — Manage Admins:
- Table of all 6 regional admins (name, email, region badge)
- "+ Add Admin" button → modal (name, email, password, region dropdown)
- Edit / Delete actions per row

### Super Admin sidebar
Two items only:
- **Overview** → `/super-admin/overview`
- **Manage Admins** → `/super-admin/admins`

No coaches, tasks, or assign-task links — super_admin does not manage day-to-day work.

### Changed pages (Regional Admin)
- Sidebar: add region badge ("Urban-I Region") below logo
- All data already silently scoped via backend — no frontend filter logic needed

### Routing & access control
- `super_admin` login → redirect to `/super-admin/overview`
- `admin` login → redirect to `/admin` (unchanged)
- `coach` login → redirect to `/coach` (unchanged)
- `super_admin` attempting to access `/admin/*` → redirected to `/super-admin/overview`
- `admin` attempting to access `/super-admin/*` → redirected to `/admin`

---

## 7. Autonomous Agents (Phase 9)

All 3 agents loop per-region instead of running globally:

**Monitoring Agent** (every 30 min):
- Fetch tasks WHERE `coach.region_id = region.id` for each region
- Save snapshot tagged with `region_id`

**Support Agent** (every 30 min):
- Interventions scoped to region coaches only

**Reporting Agent** (daily 9am):
- Generates one digest per region
- Emails digest to that region's admin
- Super admin (`hasnattariq97@gmail.com`) receives one combined digest summarising all 6 regions

---

## 8. What Does NOT Change

- Coach experience — completely unchanged
- Task assignment, notifications, email queue, Phase 10 bug fix pipeline — all unchanged
- Existing cron jobs (midpoint nudge, overdue nudge) — work as-is (already scoped to coach_id)
- Agent Dashboard (Phase 9c) — visible to admins only (already protected by requireAdmin)

---

## Implementation Notes

- All passwords stored as bcrypt hashes (12 rounds), never plaintext
- Super admin cannot be deleted via the Manage Admins UI (protected by email check)
- Region assignment is permanent per admin — no UI to change it (must be done via direct DB update if ever needed)
- `.superpowers/` should be added to `.gitignore`
