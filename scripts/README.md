---
phase: "0"
status: "active"
owner: "human"
last_updated: "2026-06-04T16:30:00Z"
beads: []
---

# Scripts Directory

Utility scripts for development and deployment.

## cleanup.cmd (Windows)
Kills all stuck Node.js processes and displays next steps.

**Usage:**
```bash
scripts\cleanup.cmd
```

**What it does:**
1. Counts running Node processes
2. Force-kills all node.exe processes
3. Waits 3 seconds for cleanup
4. Verifies cleanup succeeded
5. Displays restart instructions

**Output example:**
```
======================================
 Coach Task Tracker - System Cleanup
======================================

[1/4] Checking for Node processes...
      ⚠  Found 54 Node process(es)
      Killing all Node processes...
      ✓ Node processes terminated

[2/4] Waiting for cleanup (3 seconds)...

[3/4] Verifying cleanup...
      ✓ All Node processes cleaned

[4/4] Summary
      • Port 3001: Backend (must be restarted manually)
      • Port 5173: Frontend (must be restarted manually)
      • Database: server/tracker.db (untouched)
```

## cleanup.sh (Linux/Mac)
Bash version of cleanup script.

**Usage:**
```bash
chmod +x scripts/cleanup.sh
./scripts/cleanup.sh
```

**What it does:**
Same as cleanup.cmd, but for Unix systems.

## When to Use Cleanup

**Run cleanup if:**
- ❌ API returns 500 error for all endpoints
- ❌ "Failed to load coaches" appears in UI
- ❌ `ps aux | grep node` shows 10+ processes
- ❌ Port 3001 is "already in use"
- ✅ You switched terminals or restarted partially

**Process:**
1. Run cleanup script
2. Verify it says "✓ All Node processes cleaned"
3. Open **two fresh terminal windows** (not tabs)
4. Terminal 1: `cd server && node index.js`
5. Terminal 2: `cd client && npm run dev`
6. Visit http://localhost:5173

## Why This Matters

Each time you run `node index.js` or `npm run dev`, a new process starts. If you don't properly kill the old ones, they accumulate:

- Process 1: ✓ Works
- Process 2-5: ⚠ Started but crashed/abandoned
- Process 6-54: ❌ Stuck, all trying to use port 3001

All 54 processes respond to requests, but most are broken. This causes random 500 errors.

The cleanup script nukes all of them at once. You then start fresh.

## Prevention

- **Always use fresh terminal windows** — don't run in background with `&`
- **Close terminals completely** — don't minimize them
- **Kill before restarting** — run `cleanup.cmd` before `node index.js`
- **Monitor processes** — occasionally check `ps aux | grep node`

## Troubleshooting

**"Still showing Node processes after cleanup"**
- System restart required (rare)
- Some processes may be owned by other systems

**"Permission denied" error**
- Windows: Run command prompt as Administrator
- Linux: May need `sudo` but avoid if possible

**"Port 3001 still in use after cleanup"**
- Another app (not Node) is using it
- Use `netstat -ano | findstr :3001` to identify
- Either kill that process or change `PORT` in `server/index.js`

## See Also

- [@docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) — Full troubleshooting guide
- [@README.md](../README.md) — Project overview
