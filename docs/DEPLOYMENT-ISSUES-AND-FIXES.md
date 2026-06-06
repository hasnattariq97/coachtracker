---
phase: "7+"
status: "active"
owner: "deployment-team"
last_updated: "2026-06-07T00:30:00Z"
beads: []
---

# Deployment Issues & Fixes - Lessons Learned

**Date:** 2026-06-07  
**Context:** Railway PostgreSQL deployment of Coach Task Tracker  
**Purpose:** Document all issues encountered and solutions so they don't happen again

---

## Issue 1: Missing Admin User in Database

### Problem Description

**Symptom:** 
- Frontend deployed and running ✅
- Backend deployed and running ✅
- Login endpoint exists ✅
- But login returns: `{"error":"Invalid email or password"}`

**Root Cause:**
The admin user (`admin@tracker.com`) didn't exist in the Railway PostgreSQL database, even though seeding code was written and deployed.

### Why It Happened

1. **Assumption Error:** Assumed auto-seeding would work without verification
2. **Silent Failures:** Database initialization seeding ran but didn't log actual success/failure
3. **No Verification:** Code logged "✓ Admin user seeded" unconditionally, even if insert failed
4. **Missing Error Details:** Catch-all error handler didn't show what went wrong

### Initial Attempts That Didn't Work

#### ❌ Attempt 1: Automatic Seeding via db.js
```javascript
// OLD CODE - LOGS SUCCESS UNCONDITIONALLY
await query(`INSERT INTO users...`);
console.log('✓ Admin user seeded'); // Logged even if insert failed!
```

**Why it failed:**
- No RETURNING clause to verify user was created
- Didn't check if user actually existed after insert
- Silent failure if database connection had issues

#### ❌ Attempt 2: /setup Endpoint (First Deploy)
Added endpoint to manually create admin user:
```javascript
router.post('/setup', async (req, res) => {
  // Code existed but returned 404 on Railway
});
```

**Why it failed:**
- Endpoint code was correct but deployment hadn't picked it up
- Mistake: Assumed Railway had auto-deployment from GitHub (IT DOESN'T!)
- Endpoint would have worked if properly deployed

### ✅ Solution That Worked

**Fixed db.js seeding:**
```javascript
// NEW CODE - VERIFIES ACTUAL CREATION
const adminResult = await query(
  `INSERT INTO users (name, email, password_hash, role)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
   RETURNING id, email, role`,
  ['Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin']
);

// NOW WE VERIFY IT ACTUALLY WORKED
if (adminResult.rows && adminResult.rows[0]) {
  console.log('✓ Admin user seeded:', adminResult.rows[0]); // Shows actual user
} else {
  console.log('✓ Admin user already exists');
}
```

**Key improvements:**
1. Added `RETURNING id, email, role` to capture created user
2. Actually logs the created user object (proves it worked)
3. Uses `ON CONFLICT DO UPDATE` for idempotency
4. Properly verifies user was created by checking result.rows

**Then deployed via Railway CLI:**
```bash
railway deployment up --service spectacular-connection -y --detach
```

### Prevention for Future

#### ✅ Rule 1: Always Verify Database Operations
```javascript
// ❌ BAD
await db.insert(data);
console.log('✓ Inserted');

// ✅ GOOD
const result = await db.insert(data);
if (result.rows && result.rows[0]) {
  console.log('✓ Inserted:', result.rows[0]);
} else {
  throw new Error('Insert returned no data');
}
```

#### ✅ Rule 2: Use RETURNING Clause in PostgreSQL
Always get back the created/updated row to verify it worked:
```sql
-- ❌ BAD
INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3);

-- ✅ GOOD
INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role;
```

#### ✅ Rule 3: Log Actual Data, Not Just Success Message
```javascript
// ❌ BAD
console.log('✓ User created');

// ✅ GOOD
console.log('✓ User created:', { id: user.id, email: user.email });
```

#### ✅ Rule 4: Add Manual Fix Endpoint
Have a `/setup` or `/admin/seed` endpoint for emergency situations:
```javascript
router.post('/api/auth/setup', async (req, res) => {
  const existing = await db.prepare('SELECT id FROM users WHERE email = $1').get('admin@tracker.com');
  if (existing) {
    return res.json({ message: 'Already exists', user: existing });
  }
  const result = await db.prepare('INSERT INTO users...').run(...);
  res.json({ message: 'Created', user: result.rows[0] });
});
```

---

## Issue 2: Cron Jobs Using SQLite Syntax in PostgreSQL

### Problem Description

**Symptom:**
```
error: function julianday(timestamp without time zone) does not exist
error: function datetime(unknown) does not exist
TypeError: candidates is not iterable
```

**Root Cause:**
Cron jobs (`server/cron.js`) were still using SQLite-specific functions and synchronous API, but the database was migrated to PostgreSQL.

### Why It Happened

1. **Incomplete Migration:** Database migrated from SQLite to PostgreSQL, but cron jobs weren't updated
2. **No Type System:** JavaScript doesn't catch these at compile time
3. **Different APIs:** SQLite uses sync `.all()`, PostgreSQL uses async `query()`

### ❌ What Was Wrong

**Old SQLite Code:**
```javascript
// ❌ SQLite functions don't exist in PostgreSQL
const candidates = db.prepare(`
  SELECT t.id, t.coach_id, t.title, t.assigned_at, t.due_date
  FROM tasks t
  WHERE t.status != 'completed'
    AND datetime(t.assigned_at, '+' ||
      CAST((julianday(t.due_date) - julianday(t.assigned_at)) / 2 AS INTEGER) || ' seconds'
    ) <= datetime('now')
    AND NOT EXISTS (...)
`).all();

for (const task of candidates) {  // ❌ ERROR: candidates is undefined
  // ...
}
```

**Problems:**
1. `julianday()` function doesn't exist in PostgreSQL
2. `datetime()` function doesn't exist in PostgreSQL
3. `.all()` is synchronous but should be async for PostgreSQL
4. `candidates` becomes undefined, causing "not iterable" error
5. Code doesn't await async operations

### ✅ Solution That Worked

**New PostgreSQL Code:**
```javascript
// ✅ PostgreSQL-compatible syntax
const candidates = await db.prepare(`
  SELECT t.id, t.coach_id, t.title, t.assigned_at, t.due_date
  FROM tasks t
  WHERE t.status != 'completed'
    AND t.assigned_at + ((t.due_date - t.assigned_at) / 2) <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.task_id = t.id AND n.type = 'midpoint_nudge'
    )
`).all();

if (!candidates || candidates.length === 0) {
  return;
}

for (const task of candidates) {  // ✅ Works now
  const message = `Halfway there! ⚡ ...`;
  await createNotification(task.coach_id, task.id, 'midpoint_nudge', message);
}
```

**Key changes:**
1. Replaced `datetime()` with PostgreSQL `NOW()` function
2. Replaced `julianday()` arithmetic with PostgreSQL interval math: `(due_date - assigned_at) / 2`
3. Added `await` since `.all()` is now async
4. Added null check and early return for empty results
5. Made `createNotification()` async and await it

### SQL Migration Reference

| Operation | SQLite | PostgreSQL |
|-----------|--------|------------|
| Current time | `datetime('now')` | `NOW()` | 
| Days between | `julianday(date2) - julianday(date1)` | `(date2 - date1)` returns interval |
| Half of interval | Need to calculate in seconds | `(due_date - assigned_at) / 2` |
| Insert or ignore | `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| Async queries | Synchronous `.all()` | Async `await .all()` |

### Prevention for Future

#### ✅ Rule 1: Always Migrate All Usage When Changing Database

When switching databases, search the codebase:
```bash
# Find all files that might have database-specific syntax
grep -r "julianday" .
grep -r "datetime(" .
grep -r "INSERT OR IGNORE" .
grep -r "\.all()" server/
```

#### ✅ Rule 2: Test Database Operations After Migration

Create a test script:
```javascript
// test-db-migration.js
const db = require('./server/db');

async function testMigration() {
  // Test date functions
  const now = await db.prepare("SELECT NOW() as now").get();
  console.log('✓ NOW() works:', now);

  // Test interval math
  const interval = await db.prepare(
    "SELECT ('2026-06-20'::timestamp - '2026-06-10'::timestamp) as diff"
  ).get();
  console.log('✓ Interval math works:', interval);

  // Test ON CONFLICT
  const result = await db.prepare(
    "INSERT INTO users (...) VALUES (...) ON CONFLICT DO NOTHING"
  ).run(...);
  console.log('✓ ON CONFLICT works:', result);
}

testMigration();
```

#### ✅ Rule 3: Use Type Hints / Comments
Add comments to remind developers which database is expected:
```javascript
// ✅ PostgreSQL-specific syntax
const midpointNudgeJob = async () => {
  try {
    // PostgreSQL: NOW() instead of datetime('now')
    // PostgreSQL: Interval arithmetic instead of julianday()
    const candidates = await db.prepare(`
      SELECT ...
      WHERE ... AND t.assigned_at + ((t.due_date - t.assigned_at) / 2) <= NOW()
    `).all();
    // ...
  }
}
```

#### ✅ Rule 4: Document Database-Specific Code

Create a migration guide:
```markdown
# Database Migration: SQLite → PostgreSQL

## Date/Time Functions
- `datetime('now')` → `NOW()`
- `julianday(date)` → Not needed (use intervals directly)
- `strftime()` → Use PostgreSQL text casting

## Query Syntax
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- `:named` params → `$1, $2, $3` positional params

## API Changes
- `.all()` is now async, use `await`
- `.get()` is now async, use `await`
- `.run()` is now async, use `await`
```

---

## Issue 3: GitHub NOT Auto-Deployed to Railway

### Problem Description

**Symptom:**
- Code committed and pushed to GitHub ✅
- Expected automatic deployment to Railway ❌
- Endpoint still returning 404 (old code running)
- Code changes weren't actually deployed

**Root Cause:**
I assumed Railway had auto-deployment set up like Vercel does. **IT DOESN'T BY DEFAULT.**

### Why It Happened

1. **Wrong Assumption:** Confused Railway with Vercel (Vercel auto-deploys from GitHub)
2. **No CI/CD Check:** Didn't verify Railway had GitHub integration enabled
3. **Took Too Long:** Wasted time waiting for auto-deployment that would never happen

### ❌ What I Did Wrong

```bash
# ❌ WRONG - I thought this would auto-deploy
git push origin main
# Then waited 5-10 minutes expecting Railway to deploy
# Nothing happened because Railway doesn't auto-deploy!
```

### ✅ Solution That Worked

Use Railway CLI to manually deploy:

```bash
# ✅ CORRECT - Manual deployment via CLI
railway login  # Authenticate with Railway

railway link -p surprising-expression  # Link to project

railway deployment up --service spectacular-connection -y --detach
# Or for quick redeploy of existing code:
railway deployment redeploy -s spectacular-connection -y
```

### Why Railway CLI Deployment Works

Railway CLI:
1. Takes current local code
2. Uploads it to Railway
3. Builds and deploys immediately
4. Doesn't depend on GitHub integration
5. Gives instant feedback

### Prevention for Future

#### ✅ Rule 1: Know Your Deployment Platform

| Platform | Auto-Deploy? | How to Deploy |
|----------|-------------|---------------|
| **Vercel** | ✅ Yes (from GitHub) | Push to GitHub, automatic |
| **Netlify** | ✅ Yes (from GitHub) | Push to GitHub, automatic |
| **Heroku** | ⚠️ Conditional (if configured) | Push to GitHub OR use CLI |
| **Railway** | ❌ No (not by default) | **Use Railway CLI** |
| **AWS** | ❌ No (not by default) | Use AWS CLI or CodePipeline |

#### ✅ Rule 2: Always Use CLI for Railway Deployments

```bash
# Step 1: Make code changes
git add .
git commit -m "fix: ..."
git push origin main  # For backup only!

# Step 2: Deploy to Railway via CLI (THIS IS REQUIRED)
railway deployment up --service spectacular-connection -y

# Step 3: Verify deployment
railway logs -s spectacular-connection --tail 20
```

#### ✅ Rule 3: Create a Deployment Checklist

```markdown
# Pre-Deployment Checklist

- [ ] Code changes tested locally
- [ ] All tests passing
- [ ] No TypeScript/syntax errors: `node -c file.js`
- [ ] Changes committed to git
- [ ] Changes pushed to GitHub (optional, for backup)
- [ ] Correct service name: `spectacular-connection`
- [ ] Linked to correct project: `surprising-expression`

# Deployment Process

- [ ] Run: `railway deployment up --service spectacular-connection -y --detach`
- [ ] Check status: `railway deployment list -s spectacular-connection`
- [ ] Wait for: Status = SUCCESS
- [ ] Verify live: `curl https://[url]/health`
- [ ] Test functionality
- [ ] Check logs for errors: `railway logs -s spectacular-connection --tail 50`
```

#### ✅ Rule 4: Setup Railway CLI Helper Script

Create `scripts/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting Railway deployment..."

# Step 1: Verify linked project
PROJECT=$(railway link --json | jq -r '.projectId')
echo "✓ Project: $PROJECT"

# Step 2: Deploy
echo "Deploying to Railway..."
railway deployment up --service spectacular-connection -y --detach

# Step 3: Wait for deployment
echo "Waiting for deployment to complete (max 5 min)..."
for i in {1..150}; do
  STATUS=$(railway deployment list -s spectacular-connection --json | jq -r '.[0].status')
  echo "[$i] Status: $STATUS"
  if [ "$STATUS" = "SUCCESS" ]; then
    echo "✅ Deployment successful!"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "❌ Deployment failed!"
    exit 1
  fi
  sleep 2
done

# Step 4: Test
echo "Testing deployment..."
curl -s https://spectacular-connection-production-d07b.up.railway.app/health | jq .

echo "✅ Deployment complete!"
```

Usage:
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

---

## Issue 4: Initial Redeploy Command Didn't Work

### Problem Description

**Symptom:**
```bash
railway deployment redeploy -s spectacular-connection --from-source -y
# Error: --workspace required in non-interactive mode
```

**Root Cause:**
Project wasn't linked in the current directory. Railway CLI didn't know which workspace/project to target.

### ✅ Solution

```bash
# Step 1: Link project (interactive - you select options)
railway link -p surprising-expression

# Step 2: Now redeploy works
railway deployment redeploy -s spectacular-connection -y

# Or do fresh upload
railway deployment up --service spectacular-connection -y --detach
```

### Prevention

Always link project before deploying:
```bash
# Add this to deployment checklist
railway link -p surprising-expression
```

---

## Issue 5: /setup Endpoint Returns 404 (First Deploy)

### Problem Description

**Symptom:**
- Endpoint code exists in `auth.js` ✅
- Server is running ✅
- But `curl /api/auth/setup` returns 404

**Root Cause:**
Initial deployment didn't fully pick up the code changes. Needed a fresh upload of server code.

### ❌ What Happened

1. First redeploy used `--from-source` (pulls from GitHub)
2. GitHub had the code, but deployment wasn't complete
3. Second deployment uploaded server code directly via CLI
4. After second deployment, endpoint worked ✅

### ✅ Solution

If endpoint still returns 404 after git push + redeploy:

```bash
# Option 1: Fresh upload from local directory
cd server/
railway deployment up --service spectacular-connection -y --detach

# Option 2: Check if route is actually in code
grep -n "router.post('/setup'" routes/auth.js

# Option 3: Check Railway logs for route registration
railway logs -s spectacular-connection --tail 100 | grep -i "setup\|error"
```

---

## Summary Table: Issues & Fixes

| Issue | Root Cause | First Attempt | Final Solution |
|-------|-----------|-----------------|-----------------|
| **Admin user missing** | Silent DB failure | Manual /setup endpoint | Fixed db.js seeding with RETURNING clause |
| **Cron SQLite syntax** | Incomplete migration | None (found during code review) | Converted all queries to PostgreSQL |
| **GitHub auto-deploy** | Wrong assumption | Waited for automatic deployment | Used `railway deployment up` CLI |
| **Project not linked** | New terminal session | Manual linking | Add to pre-deployment checklist |
| **/setup returns 404** | Incomplete first deploy | Redeploy from GitHub | Fresh upload via CLI |

---

## Lessons Learned

### 1. Always Verify Database Operations
Don't assume success - check the actual result and log it.

### 2. Test After Database Migrations
When switching databases, test all affected queries.

### 3. Know Your Deployment Platform
Don't assume all platforms work the same way. Verify before implementing.

### 4. Use CLI Tools for Manual Tasks
Don't wait for automation if you can control it yourself.

### 5. Create Checklists
Deployment is procedural - document every step so it's repeatable and can't be skipped.

### 6. Check Logs First
When something's wrong, logs are usually the fastest way to find out why.

### 7. Verify in Staging
Always test deployments before relying on them in production.

---

## Going Forward

Use these documents to prevent these issues:
- [RAILWAY-CLI-DEPLOYMENT-GUIDE.md](RAILWAY-CLI-DEPLOYMENT-GUIDE.md) - Step-by-step Railway CLI guide
- [Database Migration Checklist](#) - When switching databases
- [Pre-Deployment Checklist](#) - Before every deployment

