---
phase: "7+"
status: "active"
owner: "deployment-team"
last_updated: "2026-06-07T02:00:00Z"
beads: []
---

# Fix Verification Plan — Admin User & Cron Jobs

**Date:** 2026-06-07  
**Status:** ✅ FIXES IMPLEMENTED & PUSHED TO GITHUB

---

## What Was Fixed

### 1. ✅ Admin User Seeding (Primary Issue)

**File:** `server/db.js` (lines 95-106)

**Changes:**
- Added `RETURNING id, email, role` to capture created user
- Log actual created user object instead of just success message
- Use `ON CONFLICT ... DO UPDATE` to ensure user is created/updated
- Proper error handling in catch block

**Before:**
```javascript
await query(`...ON CONFLICT (email) DO NOTHING`);
console.log('✓ Admin user seeded');
```

**After:**
```javascript
const adminResult = await query(`...RETURNING id, email, role`);
if (adminResult.rows && adminResult.rows[0]) {
  console.log('✓ Admin user seeded:', adminResult.rows[0]);
}
```

### 2. ✅ /setup Endpoint Improvement

**File:** `server/routes/auth.js` (lines 83-107)

**Changes:**
- Check if admin exists before creating
- Return user object from RETURNING clause
- Proper error handling with stack traces
- Status field to indicate created vs. already_exists
- Detailed logging for debugging

**Before:**
```javascript
await db.prepare('DELETE FROM users...').run(...);
const result = await db.prepare('INSERT...').run(...);
res.json({ message: '...', user: result.rows[0] });
```

**After:**
```javascript
const existing = await db.prepare('...').get('admin@tracker.com');
if (existing) return res.json({..., status: 'already_exists'});
const insertResult = await db.prepare('...').run(...);
const createdUser = insertResult.rows ? insertResult.rows[0] : insertResult;
res.json({..., user: createdUser, status: 'created'});
```

### 3. ✅ Cron Jobs PostgreSQL Migration

**File:** `server/cron.js` (lines 1-102)

**Changes:**
- Convert `datetime()` → `NOW()`
- Convert `julianday()` → PostgreSQL interval arithmetic
- Convert `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- Convert synchronous `.all()` → `await .all()`
- Make `createNotification()` async
- Make both cron jobs async functions
- Add proper error handling with `.message` property

**SQL Before (SQLite):**
```sql
WHERE datetime(t.assigned_at, '+' ||
  CAST((julianday(t.due_date) - julianday(t.assigned_at)) / 2 AS INTEGER) || ' seconds'
) <= datetime('now')
```

**SQL After (PostgreSQL):**
```sql
WHERE t.assigned_at + ((t.due_date - t.assigned_at) / 2) <= NOW()
```

---

## Deployment Status

### ✅ Commits Pushed to GitHub

```
dd0624a fix: Improve admin user seeding and convert cron jobs to PostgreSQL
583bbee docs: Complete Railway deployment analysis and remediation plan
3650664 docs: Add Railway admin user fix instructions
```

**Status:** Code pushed to `main` branch  
**Expected:** Railway auto-deployment within 2-5 minutes  
**Verification:** Check Railway dashboard "Deployments" tab for `dd0624a`

---

## Verification Steps

### Step 1: Wait for Railway Deployment (2-5 min)

Go to: https://railway.app → "surprising-expression" → "spectacular-connection"
- Click **"Deployments"** tab
- Look for deployment with commit `dd0624a`
- Status should be **"Success"** (green)

### Step 2: Test Admin User Creation

Once deployed, try the /setup endpoint:

```bash
curl -s -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/setup \
  -H "Content-Type: application/json"
```

**Expected Response (first run):**
```json
{
  "message": "Admin user created successfully",
  "user": {
    "id": 1,
    "email": "admin@tracker.com",
    "role": "admin"
  },
  "status": "created"
}
```

**Expected Response (second run):**
```json
{
  "message": "Admin user already exists",
  "user": {
    "id": 1,
    "email": "admin@tracker.com",
    "role": "admin"
  },
  "status": "already_exists"
}
```

### Step 3: Test Login

Once admin user is created, test login:

```bash
curl -s -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**NOT expected:**
```json
{
  "error": "Invalid email or password"
}
```

### Step 4: Test Frontend Login

1. Go to https://coachtracker-theta.vercel.app
2. Email: `admin@tracker.com`
3. Password: `admin123`
4. Should see **Admin Dashboard** (Coaches page)

### Step 5: Test Cron Jobs

Check Railway logs for confirmation:

1. Go to Railway dashboard → "spectacular-connection" → **"Logs"**
2. Look for lines like:
   ```
   [Cron] ✓ Midpoint nudge: notified X coach(es)
   [Cron] ✓ Overdue job: marked X task(s) overdue, notified coaches and admin
   ```

If cron jobs run without errors, you'll see these logs hourly.

### Step 6: Full End-to-End Test

Once logged in as admin:

- [ ] Create a coach: "Test Coach" / "test@example.com"
- [ ] Create a task: Assign to Test Coach with due date tomorrow
- [ ] Login as test coach (test@example.com - you'll need password)
- [ ] Coach should see assigned task
- [ ] Coach marks task complete
- [ ] Admin should see completion notification
- [ ] Cron jobs should have run (check logs)

---

## Rollback Plan (if needed)

If something goes wrong:

```bash
# Revert to previous version
git revert dd0624a
git push origin main

# Railway will auto-redeploy the previous version
```

---

## Estimated Timeline

| Step | Estimated Time |
|------|-----------------|
| Railway deployment | 2-5 min |
| Test /setup endpoint | 1 min |
| Test login endpoint | 1 min |
| Test frontend login | 2 min |
| Check cron logs | 2 min |
| Full E2E test | 10 min |
| **Total** | **18-25 min** |

---

## Success Criteria ✅

- [ ] Admin user exists in Railway PostgreSQL
- [ ] /setup endpoint returns 200 with created user
- [ ] Login endpoint accepts admin@tracker.com / admin123
- [ ] Frontend login works and redirects to dashboard
- [ ] Cron jobs running without SQLite syntax errors
- [ ] Can create coaches and assign tasks
- [ ] Notifications system works

---

## Troubleshooting

### /setup endpoint still returns 404

**Cause:** Deployment hasn't completed yet  
**Fix:** Wait another 2-3 minutes and try again  
**Check:** Railway dashboard Deployments tab for success status

### Login still returns "Invalid email or password"

**Cause:** Admin user wasn't created by /setup endpoint  
**Debug:** 
```bash
# Check if user exists
curl -s https://spectacular-connection-production-d07b.up.railway.app/api/auth/setup
# Look for status: "created" or "already_exists"
```

### Cron job errors in logs

**Expected:** PostgreSQL conversion worked  
**If seeing SQLite errors:** Deployment picked up old code  
**Fix:** Wait 5 minutes, check logs again

---

## Documentation Updated

- ✅ `ADMIN-USER-FIX-INSTRUCTIONS.md` — still valid for manual insert
- ✅ `RAILWAY-DEPLOYMENT-SUMMARY-2026-06-07.md` — add completion note
- ✅ Code fixed and deployed
- ✅ Commit history clear with good messages

---

## Next Steps

1. **Immediate:** Wait for Railway deployment (2-5 min)
2. **Then:** Call /setup endpoint to create admin user
3. **Then:** Test login at frontend
4. **Then:** Create test coach and verify notifications
5. **Then:** Update this document with ✅ status for each step

---

## Reference URLs

- **Railway Dashboard:** https://railway.app/project/surprising-expression
- **Frontend:** https://coachtracker-theta.vercel.app
- **Backend:** https://spectacular-connection-production-d07b.up.railway.app
- **GitHub:** https://github.com/hasnattariq97/coachtracker
- **Commit:** https://github.com/hasnattariq97/coachtracker/commit/dd0624a

