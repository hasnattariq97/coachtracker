---
phase: "0"
status: "active"
owner: "human"
last_updated: "2026-06-04T16:30:00Z"
beads: []
---

# Troubleshooting Guide — Coach Task Tracker

## Quick Diagnostics

### App completely broken? Start here.
```bash
# 1. Are there stuck Node processes?
ps aux | grep node | grep -v grep | wc -l

# 2. Is port 3001 in use?
netstat -ano | findstr :3001

# 3. Kill everything and start fresh
taskkill /IM node.exe /F
sleep 3
# Then start servers in new terminals
```

---

## Common Issues & Fixes

### Issue 1: All API Calls Return 500 Error (But Code Works)

**Symptoms:**
- ❌ Login fails with 500
- ❌ GET /api/coaches returns 500
- ❌ Health check returns 500
- ✅ Database queries work in isolation
- ✅ Frontend UI loads fine

**Cause:** Multiple Node.js processes binding to port 3001 (from previous test runs)

**Fix:**
```bash
# Step 1: Force-kill all Node processes
taskkill /IM node.exe /F

# Step 2: Verify cleanup (should return 0)
ps aux | grep node | grep -v grep | wc -l

# Step 3: Start fresh
cd d:\Cursor_new\server
node index.js
# Open NEW terminal
cd d:\Cursor_new\client
npm run dev
```

**Prevention:**
- Always close terminal windows fully (don't leave them running)
- Don't use `&` to background processes; use separate terminals
- Run cleanup script before starting: `taskkill /IM node.exe /F`

**Why This Happens:**
- Each `node index.js` tries to bind to port 3001
- If 54 processes are running, they all compete
- Express doesn't fail gracefully; just returns 500 for any request
- The oldest/first process wins, even if it's broken

---

### Issue 2: "Failed to Load Coaches" Error in UI

**Symptoms:**
- Toast shows: "Failed to load coaches"
- Coaches page shows: "No coaches yet" (empty state)
- Notification errors: "Could not load notifications"

**Root Cause 1: Stuck processes (see Issue 1)**
```bash
taskkill /IM node.exe /F
```

**Root Cause 2: Backend not running**
```bash
# Check if backend is actually listening
netstat -ano | findstr :3001

# If nothing, start it:
cd d:\Cursor_new\server
node index.js
# Should print: ✓ Server running on http://localhost:3001
```

**Root Cause 3: CORS or Auth issue**
```bash
# Test API directly:
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}'

# Should return a token, not an error
```

**Root Cause 4: Database locked**
```bash
# Check for locked database file
ls -la server/tracker.db*

# Kill process holding it
taskkill /IM node.exe /F

# Remove lock files (safe after killing processes)
rm server/tracker.db-shm server/tracker.db-wal 2>/dev/null || true

# Start fresh
node server/index.js
```

---

### Issue 3: "JWT_SECRET not set" Error

**Symptoms:**
- Server won't start
- Error: "JWT_SECRET environment variable is required"

**Cause:** `.env` file not loading or JWT_SECRET not set

**Fix:**
```bash
# Check .env exists
cat server/.env

# Should show: JWT_SECRET=test-secret-key-minimum-32-characters-requirement

# If missing, create it:
echo "JWT_SECRET=test-secret-key-minimum-32-characters-requirement" > server/.env

# Restart server:
cd server && node index.js
```

**Why:** `require('dotenv').config()` loads `.env` at module startup. If JWT_SECRET is undefined, auth.js throws immediately.

---

### Issue 4: Database "Device or Resource Busy"

**Symptoms:**
```
rm: cannot remove 'tracker.db': Device or resource busy
```

**Cause:** A Node process is still holding the database file open

**Fix:**
```bash
# Force-kill the process holding it
taskkill /IM node.exe /F

# Wait 2 seconds
sleep 2

# Now you can delete/reset the database
rm server/tracker.db server/tracker.db-shm server/tracker.db-wal

# Start fresh server (recreates DB)
cd server && node index.js
```

**Prevention:**
- Always kill old processes before deleting database files
- Use the cleanup script (see below)

---

### Issue 5: Tests Fail With "Cannot Find Module"

**Symptoms:**
```
Error: Cannot find module './db'
Error: EBUSY: database locked
```

**Cause:** Port 3001 already taken, or database locked during test run

**Fix:**
```bash
# Kill all Node processes
taskkill /IM node.exe /F

# Remove database locks
rm server/tracker.db-shm server/tracker.db-wal 2>/dev/null || true

# Run tests
cd server && NODE_ENV=test npm test
```

**Why Tests Need Isolation:**
- Tests require fresh database (in-memory or fresh file)
- If a server is running, tests can't access/reset the database
- Always kill servers before running tests

---

### Issue 6: Frontend Won't Connect to Backend

**Symptoms:**
- Frontend loads but shows loading spinners forever
- Network tab shows: "Failed to fetch" or CORS errors
- Console shows: "GET http://localhost:3001/api/coaches 0 (error)"

**Cause 1: Backend not running**
```bash
# Check if 3001 is listening
netstat -ano | findstr :3001

# If not, start it:
cd server && node index.js
```

**Cause 2: Vite proxy misconfigured**
```bash
# Check vite.config.js has proxy setup:
cat client/vite.config.js | grep -A 5 "api"

# Should show: http://localhost:3001
```

**Cause 3: CORS blocked**
```bash
# Backend should allow localhost:5173
# Check server/index.js:
cat server/index.js | grep -A 3 "corsOptions"

# Should show: origin: 'http://localhost:5173'
```

---

## Cleanup & Reset Scripts

### Option 1: Minimal Cleanup
```bash
# Kill processes and start fresh
taskkill /IM node.exe /F
sleep 3

# Verify
ps aux | grep node | grep -v grep | wc -l  # Should be 0
```

### Option 2: Full System Reset
```bash
# Kill processes
taskkill /IM node.exe /F

# Remove database (will regenerate with admin seed)
rm server/tracker.db server/tracker.db-shm server/tracker.db-wal 2>/dev/null || true

# Clear npm cache (optional)
npm cache clean --force

# Reinstall dependencies (optional)
cd server && npm install
cd ../client && npm install

# Start fresh
cd server && node index.js  # Terminal 1
cd client && npm run dev    # Terminal 2
```

### Option 3: Development Alias (Save This!)
```bash
# Add to ~/.bashrc or ~/.zshrc:
alias coach-cleanup='taskkill /IM node.exe /F && sleep 2 && echo "✓ Cleaned"'
alias coach-start='coach-cleanup && cd d:\Cursor_new\server && node index.js'

# Usage:
coach-cleanup  # Kill all Node processes
coach-start    # Kill + restart backend
```

---

## Diagnostic Tools

### Check Server Health
```bash
curl -s http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"2026-06-04T..."}
```

### Check Database
```bash
node -e "const db = require('./server/db'); console.log(db.prepare('SELECT COUNT(*) as c FROM users').get())"
# Expected: { c: 1 }  (admin user)
```

### Check JWT Secret
```bash
node -e "console.log(process.env.JWT_SECRET?.length || 'NOT SET')"
# Expected: 32 or higher
```

### Check Port Usage
```bash
# Windows
netstat -ano | findstr :3001
netstat -ano | findstr :5173

# Linux/Mac
lsof -i :3001
lsof -i :5173
```

### List All Node Processes
```bash
ps aux | grep node
ps aux | grep node | grep -v grep | wc -l  # Count only
```

---

## When to Escalate

**Contact maintainer if:**
- Database corrupted after hard kill (try `rm tracker.db*` + fresh start first)
- Port 3001 or 5173 in use by non-Node process (use `netstat` to identify)
- Vite proxy not working despite correct config
- JWT token invalid even after `.env` reset

**Include in bug report:**
```bash
# Run and paste output:
echo "=== Node processes ===" && ps aux | grep node | grep -v grep | wc -l
echo "=== Port usage ===" && netstat -ano | findstr ":3001\|:5173"
echo "=== Server log ===" && tail -20 /tmp/server.log
echo "=== Client log ===" && tail -20 /tmp/client.log
```

---

## Reference

- **Port 3001:** Backend API (Express)
- **Port 5173:** Frontend UI (Vite dev server)
- **Database:** `server/tracker.db` (SQLite)
- **Config:** `server/.env` (JWT_SECRET)
- **Logs:** `/tmp/server.log`, `/tmp/client.log`

**Default Login:**
- Email: `admin@tracker.com`
- Password: `admin123`
