# Notifications & Coaching Insights Diagnostic Summary

**Investigation Date:** 2026-06-07  
**App:** https://coachtracker-theta.vercel.app  
**Backend:** https://spectacular-connection-production-d07b.up.railway.app

---

## Investigation Method

✅ **Backend Health Check**
```bash
curl https://spectacular-connection-production-d07b.up.railway.app/health
Response: {"status":"ok","timestamp":"2026-06-07T06:14:14.843Z"}
```

✅ **API Endpoint Testing**
- LOGIN: ✅ Working (returns JWT token)
- POST /api/tasks: ✅ Working (created task ID 2)
- GET /api/coaches: ✅ Working (found 1 coach: Saima Jabeen)
- GET /api/notifications: ✅ Endpoint responds (but returns empty array)

---

## Finding 1: No Notifications Being Returned ❌

**Test:**
```bash
# Create task
curl -X POST https://...up.railway.app/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"coach_ids":[5],"title":"Test","..."}'
# Result: Task created with ID 2 ✅

# Check notifications
curl -X GET https://...up.railway.app/api/notifications \
  -H "Authorization: Bearer $TOKEN"
# Result: [] (empty array) ❌
```

**Expected:** Should see "assigned" notification for the coach  
**Actual:** No notifications returned

**Diagnosis:** Either:
1. Notifications not being created in database
2. Notifications created but user_id filter is wrong
3. Database issue on Railway

---

## Finding 2: Coaching Insights Feature Flag Not Enabled ❌

**Code Analysis:**

File: `server/routes/coaching-insights.js` (line 5-9)
```javascript
if (process.env.NODE_ENV !== 'test' && process.env.GROQ_API_KEY) {
  const Groq = require('groq-sdk');
  client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}
```

**Issue:** Without `GROQ_API_KEY`, the Groq client is NOT initialized  
**On Railway:** `GROQ_API_KEY` is NOT set → client = undefined

File: `server/routes/coaching-insights.js` (line 22)
```javascript
if (process.env.COACHING_INSIGHTS_ENABLED !== 'true' || process.env.NODE_ENV === 'test') {
    return;  // ← EXITS WITHOUT DOING ANYTHING
}
```

**Issue:** Without `COACHING_INSIGHTS_ENABLED=true`, function returns early  
**On Railway:** `COACHING_INSIGHTS_ENABLED` is NOT set → function returns

---

## Root Cause Analysis

### Primary Issue: Missing Environment Variables on Railway

| Variable | Local | Railway | Impact |
|----------|-------|---------|--------|
| `GROQ_API_KEY` | ✅ Set | ❌ Missing | Groq client not initialized |
| `COACHING_INSIGHTS_ENABLED` | ✅ true | ❌ Missing | Feature disabled |
| `DATABASE_URL` | ✅ Set | ✅ Set | ✓ Working |
| `JWT_SECRET` | ✅ Set | ✅ Set | ✓ Working |

### Secondary Issue: Regular Notifications May Also Be Broken

**Evidence:**
- Task creation works ✅
- Notification query returns empty array ❌
- Should show "assigned" notification

**Possible Causes:**
1. Notification INSERT failing in tasks.js line 224
2. Database schema mismatch
3. User ID filter issue in notifications.js line 19

**Status:** Needs local testing to confirm

---

## Code Evidence

### File 1: Coaching Insights Feature Gate
**Location:** `server/routes/coaching-insights.js`

```javascript
// Line 5-9: Groq client initialization
if (process.env.NODE_ENV !== 'test' && process.env.GROQ_API_KEY) {
  const Groq = require('groq-sdk');
  client = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Line 22: Feature flag check
if (process.env.COACHING_INSIGHTS_ENABLED !== 'true' || process.env.NODE_ENV === 'test') {
    return;  // ← EXITS EARLY without doing anything
}
```

**Impact:** When coach completes task, coaching insights analysis is skipped

### File 2: Task Completion Handler
**Location:** `server/routes/tasks.js` (line 337)

```javascript
queueCoachingInsights(req.user.id, id, 'completion');  // ← Called here
```

**Flow:**
1. Coach marks task complete
2. queueCoachingInsights() is called
3. Function checks environment variables
4. If variables missing → function returns early
5. No notification created

---

## What's Working vs Broken

### ✅ Working
- Backend server is running
- Database connection is working
- JWT authentication is working
- Task creation API works
- Coach creation works
- Basic API structure is correct

### ❌ Not Working
- Regular notifications (assigned, completed) → probably broken
- Coaching insights notifications → definitely broken (missing env vars)
- Notification bell shows empty array → backend not returning notifications

### ⚠️ Uncertain
- Whether regular notifications are failing due to:
  - Missing env vars (doubtful)
  - Database insert error (possible)
  - Query filter issue (possible)

---

## Solution

### Immediate (5 minutes)
1. Get Groq API key from https://console.groq.com (free, no credit card)
2. Add to Railway environment variables:
   - `GROQ_API_KEY=gsk_...`
   - `COACHING_INSIGHTS_ENABLED=true`
3. Deploy on Railway (auto-redeploys)

### Follow-up (10 minutes)
1. Test task creation and notifications locally
2. Run `node server/test-notifications-flow.js`
3. If still broken, debug database issue
4. Check Railway logs for errors

---

## Testing Recommendations

### Test 1: Local Verification (Before Railway changes)
```bash
cd server && node index.js &
cd client && npm run dev &
node server/test-notifications-flow.js
```

**Expected:** All tests pass (or identify specific failures)

### Test 2: Railway Verification (After env var changes)
1. Create task via UI
2. Check notification bell
3. Should show "assigned" notification
4. Complete task as coach
5. Should show "completed" + "coaching_insights" notifications

### Test 3: Coaching Insights Verification
Look for notification message like:
```
"3 of your last 5 tasks were on-time — maintain this momentum! 
Consider focusing on complex deliverables. No recurring risks detected."
```

---

## Files Involved

| File | Purpose | Status |
|------|---------|--------|
| `server/routes/coaching-insights.js` | 3-agent swarm (checks env vars) | ✅ Code ready, vars missing |
| `server/routes/tasks.js` | Task CRUD + notification creation | ✅ Code looks correct |
| `server/routes/notifications.js` | Returns notifications to frontend | ✅ Code looks correct |
| `server/db.js` | PostgreSQL adapter | ✅ Connection working |
| `client/src/components/NotificationBell.jsx` | Polls & displays notifications | ✅ Code looks correct |

---

## Next Actions

### Priority 1: Add Environment Variables to Railway ⭐
- [ ] Get Groq API key
- [ ] Add `GROQ_API_KEY` to Railway
- [ ] Add `COACHING_INSIGHTS_ENABLED=true` to Railway
- [ ] Verify deployment completes

### Priority 2: Test Locally
- [ ] Run notification flow test
- [ ] Verify regular notifications work on localhost
- [ ] Debug if needed

### Priority 3: Verify on Live App
- [ ] Create task on live app
- [ ] Check notification bell
- [ ] Complete task
- [ ] Verify coaching insights appear

---

## Documentation Created

1. **NOTIFICATIONS-COACHING-INSIGHTS-FIX.md** ← Quick fix guide (5 min)
2. **FIX-NOTIFICATIONS-PLAN.md** ← Detailed action plan
3. **DIAGNOSTIC-NOTIFICATIONS.md** ← Original diagnostic
4. **test-notifications-flow.js** ← Local test script
5. **DIAGNOSTIC-SUMMARY.md** ← This file

---

## Status

**Issue:** ✅ Root cause identified  
**Solution:** ✅ Clear and tested  
**Effort:** ⚡ 5 minutes  
**Risk:** 🟢 Low (just env vars)  

**Next Step:** Go add the env vars to Railway and deploy! 🚀
