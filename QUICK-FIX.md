---
phase: "0"
status: "active"
owner: "human"
last_updated: "2026-06-04T16:30:00Z"
beads: []
---

# 🚨 Quick Fix Reference

**Copy-paste this if something breaks:**

## Problem 1: All API Calls Return 500 Errors

**Symptoms:**
- Login fails with 500
- All GET endpoints return 500
- UI loads but says "Failed to load"

**Fix (5 seconds):**

### Windows:
```cmd
scripts\cleanup.cmd
```

### Linux/Mac:
```bash
./scripts/cleanup.sh
```

Then open **two fresh terminal windows** and run:

**Terminal 1:**
```bash
cd d:\Cursor_new\server
node index.js
```
Should show: `✓ Server running on http://localhost:3001`

**Terminal 2:**
```bash
cd d:\Cursor_new\client
npm run dev
```
Should show: Something about vite/port 5173

**Then visit:** `http://localhost:5173`

---

## Problem 2: Port 3001 Already in Use

**Error:** `listen EADDRINUSE: address already in use :::3001`

**Fix:**
```cmd
scripts\cleanup.cmd
```

Wait for it to finish, then restart servers (see above).

---

## Problem 3: Database Locked / "Device or Resource Busy"

**Error:** `rm: cannot remove 'tracker.db': Device or resource busy`

**Fix:**
```cmd
scripts\cleanup.cmd
```

Then you can safely delete/reset database files.

---

## Problem 4: "All Node Processes Still Running"

**Still seeing errors after cleanup?**

Check how many processes:
```bash
ps aux | grep node | grep -v grep | wc -l
```

If you see `0` → Cleanup worked, problem is something else  
If you see `>0` → Try restarting your computer

---

## When to Use This

- ✅ API returns 500 errors
- ✅ Port already in use
- ✅ Database locked
- ✅ "Failed to load coaches" in UI
- ✅ You just restarted/switched terminals

## What NOT to Do

- ❌ Don't keep old terminal windows running
- ❌ Don't run `&` in background (use separate terminals)
- ❌ Don't assume a server is "off" just because terminal closed
- ❌ Don't restart server multiple times without cleaning up

---

## One-Liner (Linux/Mac)

```bash
killall -9 node && sleep 2 && cd server && node index.js
```

---

## Questions?

See full guide: [@docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

See incident details: [@docs/INCIDENT-2026-06-04.md](docs/INCIDENT-2026-06-04.md)

---

**Remember:** If it's a 500 error, it's almost always stuck processes. Run cleanup. That's it.
