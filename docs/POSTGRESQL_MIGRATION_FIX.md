---
phase: "7+"
status: "active"
owner: "claude-haiku"
last_updated: "2026-06-06T00:00:00Z"
beads: []
---

# PostgreSQL Migration Fix — Complete Refactor (2026-06-06)

## 🚨 What Happened

The project attempted to migrate from SQLite to PostgreSQL but **left the migration incomplete**:
- ✅ `db.js` was rewritten for PostgreSQL async API
- ❌ **ALL 5 route files** still used SQLite sync syntax (`db.prepare()`, `.get()`, `.all()`, `.run()`)
- ❌ **cron.js** still used SQLite datetime functions
- ❌ **DATABASE_URL was missing** from `.env`

**Result:** Every database call would crash with `TypeError: db.prepare is not a function`

---

## ✅ What Was Fixed (2026-06-06)

### 1. **db.js** — PostgreSQL Async Wrapper
**File:** `server/db.js`

Added proper async helper methods:
```javascript
// Export async helpers (routes must use await)
module.exports = {
  query:    async (sql, params) → single row,    // was: .get()
  queryAll: async (sql, params) → array,         // was: .all()
  run:      async (sql, params) → { rows, changes }, // was: .run()
};
```

**Changes:**
- ✅ Added `require('dotenv').config()` at top (was missing!)
- ✅ Proper Pool error handling
- ✅ Non-blocking database initialization with try-catch

### 2. **routes/auth.js** — Login endpoint
**Changes:**
- SQLite `?` placeholders → PostgreSQL `$1, $2` (numbered)
- `db.prepare().get()` → `await db.query()`

### 3. **routes/coaches.js** — Coach CRUD
**Changes:**
- 15+ database calls converted
- `db.prepare().all()` → `await db.queryAll()`
- `db.prepare().get()` → `await db.query()`
- `db.prepare().run()` → `await db.run()`

### 4. **routes/tasks.js** — Task assignment & lifecycle (459 lines)
**Changes:**
- 60+ database calls converted
- Complex multi-parameter queries fixed
- Placeholder numbering: `?, ?, ?` → `$1, $2, $3`
- Added `await` to all async calls
- createNotification helper updated

### 5. **routes/notifications.js** — Notification API
**Changes:**
- 3 endpoints converted to async
- GET notifications: `await db.queryAll()`
- PUT read: `await db.query()` + `await db.run()`

### 6. **routes/coaching-insights.js** — AI coaching analysis
**Changes:**
- 6 database operations converted
- Multi-parameter inserts fixed with proper placeholder numbering

### 7. **cron.js** — Hourly nudge jobs
**Changes (CRITICAL):**
- ✅ Sync job functions → `async` functions
- ✅ SQLite datetime functions → PostgreSQL equivalents:
  - `datetime('now')` → `NOW()`
  - `julianday()` calculations → Simple interval arithmetic: `(due_date - assigned_at) / 2`
  - `datetime(x, '+N seconds')` → `x + INTERVAL '...'`
- ✅ All database calls now use `await db.queryAll()` and `await db.run()`
- ✅ createNotification helper uses `ON CONFLICT ... DO NOTHING` (PostgreSQL idempotency)

### 8. **.env** — Missing configuration
**Added:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/coach_tracker
```

---

## 🔧 Next Steps (User Action Required)

### Step 1: Get PostgreSQL Database URL

**Option A: Supabase (Recommended — Free tier included!)**
1. Go to https://supabase.com → Sign up (free)
2. Create new project → Copy connection string
3. Update `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@PROJECT_ID.supabase.co:5432/postgres
   ```
   **⚠️ CRITICAL:** Use `PROJECT_ID.supabase.co` NOT `db.PROJECT_ID.supabase.co`

**Option B: Local PostgreSQL**
1. Install: `brew install postgresql` (Mac) or `choco install postgresql` (Windows)
2. Start: `pg_ctl start -D /usr/local/var/postgres` (Mac)
3. Create DB: `createdb coach_tracker`
4. Update `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/coach_tracker
   ```

**Option C: Docker PostgreSQL**
```bash
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
# Then use: DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
```

### Step 2: Verify Database Connection
```bash
cd server
node -e "require('./db').pool.query('SELECT NOW()', (err, res) => { 
  if (err) console.error('❌ Connection failed:', err.message); 
  else console.log('✓ PostgreSQL connected:', res.rows[0]); 
  process.exit(0);
});"
```

### Step 3: Start the Server
```bash
# Terminal 1: Backend
cd server && npm install && node index.js
# Should print: ✓ Server running on http://localhost:3001

# Terminal 2: Frontend
cd client && npm run dev
# Should print: ✓ Local: http://localhost:5173
```

### Step 4: Test Login
```bash
# Browser: http://localhost:5173
# Login: admin@tracker.com / admin123
```

---

## 📋 Migration Checklist

- [x] db.js: PostgreSQL Pool + async helpers
- [x] auth.js: Async routes + parameter placeholders
- [x] coaches.js: Async CRUD + parameterization
- [x] tasks.js: Async endpoints + complex queries fixed
- [x] notifications.js: Async API endpoints
- [x] coaching-insights.js: Async multi-parameter ops
- [x] cron.js: Async jobs + PostgreSQL datetime functions
- [x] .env: DATABASE_URL added
- [ ] **USER:** Set actual DATABASE_URL to working PostgreSQL
- [ ] **USER:** Test server startup and routes

---

## 🔍 Verification Commands

```bash
# Check server loads without errors
timeout 5 node index.js 2>&1 | grep -E "✓|❌"

# Check routes load
node -e "require('./routes/auth'); require('./routes/coaches'); console.log('✓ Routes loaded')"

# Check cron jobs are async
grep -n "const.*Job = async" cron.js
```

---

## 🐛 Troubleshooting

### "ECONNREFUSED 127.0.0.1:5432"
→ PostgreSQL not running. Start it or use Supabase.

### "role 'postgres' does not exist"
→ Wrong DATABASE_URL format. Check username/password.

### "database 'coach_tracker' does not exist"
→ Create it: `createdb coach_tracker` (local) or use Supabase default `postgres` DB.

### "Cannot find module 'pg'"
→ Run: `cd server && npm install`

---

## 📊 Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `db.js` | 140 | Added async helpers, dotenv load |
| `routes/auth.js` | 84 | 1 query converted |
| `routes/coaches.js` | 155 | 15+ queries converted |
| `routes/tasks.js` | 459 | 60+ queries converted |
| `routes/notifications.js` | 57 | 3 endpoints converted |
| `routes/coaching-insights.js` | 338 | 6 operations converted |
| `cron.js` | 94 | Jobs async, datetime functions converted |
| `.env` | 4 | DATABASE_URL added |

**Total:** 90+ database calls migrated from SQLite sync to PostgreSQL async

---

## ✨ What's Next

Once PostgreSQL is running:
- [ ] All tests should pass (Phase 6 security audit)
- [ ] All E2E tests should pass (Phase 6+ agent-browser)
- [ ] Data persists across server restarts
- [ ] Ready for production deployment (Render + Vercel)

---

**Status:** ✅ Code migration complete. Waiting on user to configure PostgreSQL database.
