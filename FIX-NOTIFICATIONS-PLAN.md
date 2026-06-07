# Fix Notifications & Coaching Insights - Action Plan

**Status:** Diagnostic complete | Issues identified | Solutions ready  
**Date:** 2026-06-07

---

## Issues Identified

### 🔴 Issue 1: Coaching Insights Not Triggering
**Root Cause:** Missing environment variables on Railway

**Evidence:**
- File: `server/routes/coaching-insights.js` (line 5)
- Missing: `GROQ_API_KEY` → Groq client NOT initialized
- Missing: `COACHING_INSIGHTS_ENABLED=true` → Feature disabled
- When a coach completes a task, the function checks these and returns early

**Impact:** Phase 7 coaching insights swarm analysis never runs

### 🟡 Issue 2: Regular Notifications May Not Be Returning
**Current State:** Tested task creation → task WAS created (✅), but notifications query returns `[]`

**Possible Causes:**
1. ✅ **Notification creation failing silently** in tasks.js line 224
2. ⚠️ **user_id mismatch** in the WHERE clause
3. ⚠️ **PostgreSQL async/await issue** with db methods

**Evidence:**
- Created task with ID 2 ✅
- Queried notifications → `[]` (empty) ❌
- Should show "assigned" notification for coach

---

## Solutions (In Priority Order)

### SOLUTION A: Set Environment Variables on Railway ⭐ DO THIS FIRST

**Step 1: Get Groq API Key (Free, no credit card)**
```
1. Go to https://console.groq.com
2. Sign up (email only)
3. Copy API key (format: gsk_...)
```

**Step 2: Update Railway Environment Variables**
```
1. Go to https://railway.app
2. Select Coach Task Tracker project → Backend service
3. Variables tab
4. ADD THESE:
   GROQ_API_KEY=gsk_YOUR_KEY_HERE
   COACHING_INSIGHTS_ENABLED=true
5. Click Deploy (auto-redeploys)
```

**Step 3: Verify**
```bash
# Should see coaching insights after task completion
curl -H "Authorization: Bearer $TOKEN" \
  https://spectacular-connection-production-d07b.up.railway.app/api/notifications \
  | grep coaching_insights
```

**Time:** 5 minutes  
**Impact:** Coaching insights immediately start working ✅

---

### SOLUTION B: Test & Debug Notification Creation Locally

**Why:** Verify regular notifications work before deploying

**Steps:**

1. **Start local backend & frontend**
```bash
cd server && node index.js &
cd client && npm run dev &
```

2. **Run diagnostic test**
```bash
node d:\Cursor_new\test-notifications-local.js
```

3. **What it tests:**
   - ✅ Login as admin
   - ✅ Create task
   - ✅ Query notifications
   - ✅ Check if "assigned" notification exists
   - ✅ Complete task as coach
   - ✅ Check if "completed" notification created

4. **Expected output if working:**
```
✅ Login successful
✅ Task created (ID: X)
✅ "assigned" notification found
✅ Coach can login
✅ Coach marked task complete
✅ "completed" notification found
✅ Coaching insights queued (once env vars set)
```

5. **If anything fails:**
   - Check server console for errors
   - Check `.env` file has all vars set
   - Debug db.prepare().all() method

**Time:** 10-15 minutes  
**Impact:** Identifies if issue is local setup vs Railway config

---

### SOLUTION C: Fix Potential PostgreSQL Issues

If local tests pass but Railway still has issues:

**Check 1: Database Connection**
```bash
# Railway dashboard → Backend service → View logs
# Look for: "✓ PostgreSQL database ready"
# Or: "⚠️  Database initialization warning"
```

**Check 2: Environment Variables on Railway**
```bash
# Railway dashboard → Backend service → Variables
# Verify: DATABASE_URL, JWT_SECRET are set
# Add: GROQ_API_KEY, COACHING_INSIGHTS_ENABLED
```

**Check 3: Verify Async/Await**
- File: `server/db.js` (line 143-146)
- Method: `db.prepare().run()` must return result with `.rows` property
- Method: `db.prepare().all()` must return array

**Code Change (if needed):**
```javascript
// In db.js - ensure run() returns correct format
run: async (...params) => {
  const result = await query(sql, params);
  return result;  // Should have .rows property for RETURNING queries
}
```

---

## Recommended Action Sequence

### Immediate (Do Now) ⚡
1. ✅ **Add env vars to Railway** (5 min)
   - `GROQ_API_KEY`
   - `COACHING_INSIGHTS_ENABLED=true`

### Short-term (Next 10 min) 📋
2. ✅ **Test locally** with diagnostic script
3. ✅ **Verify notifications work** on localhost
4. ✅ **Test on deployed app** after Railway deploy

### If Still Broken (Fallback) 🔧
5. ⚠️ **Check Railway logs** for database/env var issues
6. ⚠️ **Verify PostgreSQL schema** (tables exist, columns correct)
7. ⚠️ **Debug async methods** in db.js if needed

---

## Files to Reference

| File | Issue | Action |
|------|-------|--------|
| `server/routes/coaching-insights.js` | Missing env vars | Set on Railway ← DO THIS |
| `server/routes/tasks.js` | Creates notifications | Should work once vars set |
| `server/routes/notifications.js` | Fetches notifications | Should work |
| `server/db.js` | PostgreSQL adapter | Verify if notifications missing |
| `server/.env` | Local config | Has all vars (check production) |

---

## Expected Results After Fix

### ✅ Regular Notifications (Should already work)
- When admin assigns task → coach sees "assigned" notification
- When coach completes task → admin sees "completed" notification
- Bell icon shows unread count
- Notifications disappear when marked read

### ✅ Coaching Insights (After adding env vars)
- When coach completes task → 2 second delay
- Coaching insights notification appears
- Message includes: pattern analysis, growth opportunity, risk assessment
- Expandable card shows agent metadata with confidence scores

### ✅ Notification Bell UI
- Polls every 30 seconds
- Shows unread badge with count
- Coaching insights cards have special styling
- Messages use coaching tone

---

## Testing Checklist

After applying fixes:

- [ ] Login to https://coachtracker-theta.vercel.app
- [ ] Create task (assign to existing coach)
- [ ] Login as coach
- [ ] Check notifications bell
- [ ] See "assigned" notification
- [ ] Mark task complete
- [ ] Check notifications bell
- [ ] See "completed" notification
- [ ] Wait 2-3 seconds
- [ ] See "coaching_insights" notification with agent analysis

---

## Quick Reference: Environment Variables Needed

```bash
# Backend (.env or Railway Variables)
JWT_SECRET=test-secret-key-minimum-32-characters-requirement
DATABASE_URL=postgresql://user:pass@host:port/db
GROQ_API_KEY=gsk_...  ← MISSING, ADD THIS
COACHING_INSIGHTS_ENABLED=true  ← MISSING, ADD THIS
NODE_ENV=production
```

---

## Support

If issues persist:
1. Check Railway backend logs for errors
2. Verify database has notifications table
3. Run local test script to isolate the problem
4. Check browser console (F12) for frontend errors

**Next Step:** Go to Railway and add the 2 missing env vars! ⭐
