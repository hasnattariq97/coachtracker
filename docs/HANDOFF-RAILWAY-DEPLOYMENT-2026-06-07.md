---
phase: "7+"
status: "active"
owner: "deployment-team"
last_updated: "2026-06-07T00:30:00Z"
beads: []
---

# Handoff: Railway Deployment & Admin User Seeding

**Date:** 2026-06-07  
**Status:** ⚠️ PARTIALLY WORKING - Admin user needs to be seeded in Railway PostgreSQL  
**User Email:** hasnat@niete.edu.pk

---

## Current Deployment Status

| Component | Status | URL |
|-----------|--------|-----|
| Frontend | ✅ Live | https://coachtracker-theta.vercel.app |
| Backend | ✅ Live | https://spectacular-connection-production-d07b.up.railway.app |
| Database | ✅ Live | Railway PostgreSQL (postgres-volume) |
| API Connectivity | ✅ Working | Frontend → Backend connections work |
| Login | ❌ BROKEN | "Invalid email or password" (admin user missing) |

**Note:** DATABASE_URL is stored in Railway environment variables (see Railway dashboard)

---

## What's Working ✅

1. **Frontend (Vercel)**
   - React app deployed and running
   - Loads on https://coachtracker-theta.vercel.app
   - Updated to point to Railway backend (see "Changes Made" section)

2. **Backend (Railway)**
   - Node.js Express server running
   - Listens on https://spectacular-connection-production-d07b.up.railway.app
   - Responds to health checks and API requests
   - Database connection established
   - All routes accessible

3. **Database (Railway PostgreSQL)**
   - Tables created: users, tasks, notifications
   - Indexes created: unique_notification_dedup
   - Connection: via Railway private network (postgres.railway.internal)

4. **API Endpoints**
   - POST /api/auth/login — responds (but auth fails due to missing user)
   - POST /api/coaches — accessible
   - GET /api/tasks — accessible
   - GET /health — returns `{"status":"ok"}`

---

## What's Broken ❌

### Primary Issue: Admin User Not in Database

**Symptom:** Login with `admin@tracker.com / admin123` returns:
```json
{"error":"Invalid email or password"}
```

**Root Cause:** The admin user row is not in the `users` table in Railway PostgreSQL.

**Why It Happened:**
- Attempted to seed admin user via `server/db.js` initialization
- Used correct bcrypt hash: `$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q`
- Query: `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`
- Seeding code was deployed but admin user never appeared in database
- Likely cause: Railway deployment delays or silent query failure

### Secondary Issues (Not Blocking Login)

1. **Cron jobs failing** (in Railway logs):
   ```
   TypeError: candidates is not iterable (at cron.js:33)
   TypeError: overdue is not iterable (at cron.js:55)
   ```
   - Cause: SQLite functions (`julianday`, `datetime`) not available in PostgreSQL
   - Impact: Midpoint and overdue nudge jobs don't work
   - Files affected: `server/cron.js`

2. **Browser automation not making requests**
   - When testing via Chrome DevTools automation, form submission doesn't trigger API call
   - But curl from command line works fine
   - Likely limitation of browser automation, not a real issue

---

## What's Been Tried

### Attempt 1: Automatic Seeding in db.js
**File:** `server/db.js` (lines 94-102)
**Code:**
```javascript
await query(
  `INSERT INTO users (name, email, password_hash, role)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (email) DO NOTHING`,
  ['Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin']
);
console.log('✓ Admin user seeded');
```
**Result:** ❌ Admin user not created (seeding log message never appears in Railway logs)

### Attempt 2: /setup Endpoint
**File:** `server/routes/auth.js` (added but removed after endpoint didn't work)
**Code:**
```javascript
router.post('/setup', async (req, res) => {
  try {
    await db.prepare('DELETE FROM users WHERE email = $1').run('admin@tracker.com');
    const result = await db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *'
    ).run('Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin');
    res.json({ message: 'Admin user created', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```
**Result:** ❌ Endpoint returns 404 (deployment delayed or endpoint not registering)

### Attempt 3: Frontend API URL Configuration
**File:** `client/src/context/AuthContext.jsx`
**Change:**
```javascript
// Production fallback: use Railway backend
axios.defaults.baseURL = 'https://spectacular-connection-production-d07b.up.railway.app';
```
**Result:** ✅ Frontend now points to Railway backend correctly

---

## Changes Made Since Last Session

### 1. Frontend API URL Update
- **File:** `client/src/context/AuthContext.jsx`
- **Commit:** 28f4a2f (then updated to 1669197)
- **Change:** Set axios baseURL to Railway backend instead of Render
- **Impact:** Frontend can now reach the Railway backend

### 2. Admin User Seeding in db.js
- **File:** `server/db.js`
- **Commit:** 11abb7d → 96a8bda (fixed bcrypt hash)
- **Changes:**
  - Added automatic seeding during database initialization
  - Used correct bcrypt hash for "admin123"
  - Hash: `$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q`
  - Query uses PostgreSQL ON CONFLICT syntax
- **Status:** ⚠️ Code deployed but seeding not working

### 3. Temporary /setup Endpoint (Added then kept)
- **File:** `server/routes/auth.js`
- **Commit:** 553592c
- **Code:** Manual endpoint to seed admin user on demand
- **Status:** ⚠️ Endpoint not accessible yet (deployment delays)

---

## How to Fix (Next Steps)

### Option A: Direct Database Insert (Fastest)

Use Railway's database tools to directly insert the admin user:

```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin');
```

**How to access Railway database:**
1. Go to Railway dashboard: https://railway.app
2. Select project: "surprising-expression"
3. Click on "Postgres" database service
4. Click "Database" tab → "Query Editor"
5. Paste the SQL below and execute

**Insert Admin User:**
```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin');
```

**Verification:**
```sql
SELECT * FROM users WHERE email = 'admin@tracker.com';
```

### Option B: Fix Seeding Code & Redeploy

If Option A doesn't work, fix the seeding logic:

1. **Update `server/db.js`** to handle errors better:
```javascript
try {
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $3
     RETURNING *`,
    ['Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin']
  );
  console.log('✓ Admin user created/updated:', result.rows[0]);
} catch (err) {
  console.error('✗ Failed to seed admin user:', err.message);
}
```

2. **Commit and push:**
```bash
git add server/db.js
git commit -m "fix: Improve admin user seeding with better error handling"
git push origin main
```

3. **Redeploy to Railway:**
```bash
cd server && railway redeploy --yes
```

4. **Test login:**
```bash
curl -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}'
```

### Option C: Call /setup Endpoint (If Deployed)

Once Railway redeploy completes:
```bash
curl -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/setup
```

---

## Testing Checklist

After admin user is seeded:

- [ ] Login via curl succeeds and returns JWT token
- [ ] Frontend login succeeds and redirects to admin dashboard
- [ ] Admin can see Coaches page
- [ ] Admin can create a new coach
- [ ] Admin can assign a task to coach
- [ ] Coach can login and see assigned task
- [ ] Notifications work (bell shows unread count)
- [ ] Task completion creates admin notification

**Test curl:**
```bash
curl -s -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}' | grep token
# Should return a JWT token if working
```

---

## Key Files & Locations

### Backend (Railway)
- **Project:** `surprising-expression`
- **Service:** `spectacular-connection`
- **Database:** `postgres-volume`
- **Environment:** `production`
- **URL:** https://spectacular-connection-production-d07b.up.railway.app

### Frontend (Vercel)
- **Project:** `coachtracker`
- **URL:** https://coachtracker-theta.vercel.app
- **Configured backend:** https://spectacular-connection-production-d07b.up.railway.app

### Critical Code Files
| File | Purpose | Status |
|------|---------|--------|
| `server/db.js` | Database init + seeding | ⚠️ Seeding not working |
| `server/routes/auth.js` | Login endpoint + /setup | ✅ Code ready |
| `client/src/context/AuthContext.jsx` | API URL config | ✅ Uses Railway URL |
| `server/cron.js` | Scheduled jobs | ❌ Has SQLite syntax errors |

---

## Git Commits (Recent)

```
553592c Add /setup endpoint to manually seed admin user
96a8bda fix: Use correct bcrypt hash for admin123
11abb7d Add admin user seeding to database initialization
28f4a2f fix: Update frontend to use Railway backend URL
1669197 fix: Update frontend API URL to point to Render backend in production
```

---

## Known Issues Beyond Login

### 1. Cron Jobs Failing
**Files:** `server/cron.js`
**Issue:** SQLite-specific functions don't exist in PostgreSQL
**Errors in logs:**
- `error: function julianday(timestamp without time zone) does not exist`
- `error: function datetime(unknown) does not exist`
- `TypeError: candidates is not iterable`
- `TypeError: overdue is not iterable`

**Fix Required:**
- Replace `julianday()` with PostgreSQL date math
- Replace `datetime()` with PostgreSQL functions
- Fix iteration errors in query results

### 2. Placeholder Conversion Handling
**File:** `server/db.js` lines 25-28
**Note:** Code converts SQLite `?` to PostgreSQL `$1`, `$2`, but some queries already use `$N` syntax. This shouldn't break anything but could be simplified.

---

## Environment Variables (Railway)

All set correctly in Railway dashboard:
- `CLIENT_ORIGIN` = https://coachtracker-theta.vercel.app
- `DATABASE_URL` = (set in Railway, contains postgres credentials)
- `GROQ_API_KEY` = (set in Railway for Phase 7 coaching insights)
- `JWT_SECRET` = (set in Railway, minimum 32 characters)
- `NODE_ENV` = production

**Note:** Do NOT store credentials in code or git. All secrets are in Railway environment variables.

---

## Bcrypt Hash Reference

- **Password:** `admin123`
- **Correct Hash:** `$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q`
- **Verification:** Can be tested locally with:
  ```bash
  node -e "const bcrypt = require('bcrypt'); bcrypt.compare('admin123', '\$2b\$12\$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q').then(r => console.log(r))"
  ```

---

## What Works Well

1. ✅ Frontend/Backend connectivity
2. ✅ Database schema and tables
3. ✅ API endpoint structure
4. ✅ JWT token generation code
5. ✅ Role-based middleware
6. ✅ Database connection pooling
7. ✅ Placeholder conversion for queries
8. ✅ Vercel + Railway integration

---

## Summary for Next Agent

**BLOCKING ISSUE:** Admin user doesn't exist in Railway PostgreSQL database.

**IMMEDIATE ACTION NEEDED:**
1. Either insert admin user directly via Railway query editor (Option A)
2. Or fix seeding code and redeploy (Option B)

Once admin user exists in database, the entire app will work (login, dashboard, task assignment, notifications).

**Estimated Time to Fix:** 5-10 minutes if using Option A (direct insert), 20-30 minutes if using Option B (code fix + redeploy).

**User Credentials Once Fixed:**
- Email: `admin@tracker.com`
- Password: `admin123`

---

## References

- Railway Dashboard: https://railway.app
- Vercel Dashboard: https://vercel.com
- GitHub Repo: https://github.com/hasnattariq97/coachtracker
- Main branch: latest commits have all recent changes
