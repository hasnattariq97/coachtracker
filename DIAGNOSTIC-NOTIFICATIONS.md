# 🔍 Notifications & Coaching Insights Diagnostic Report

**Generated:** 2026-06-07  
**App:** https://coachtracker-theta.vercel.app  
**Backend:** https://spectacular-connection-production-d07b.up.railway.app

---

## Root Cause Analysis

### ❌ Problem: Coaching Insights Not Triggering
**Why:** Feature flag and Groq API key not set on Railway deployment

### Code Evidence

**File:** `server/routes/coaching-insights.js` (line 5-9)
```javascript
if (process.env.NODE_ENV !== 'test' && process.env.GROQ_API_KEY) {
  const Groq = require('groq-sdk');
  client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}
```

**Issue:** Without `GROQ_API_KEY`, the Groq client is NOT initialized (stays `null`)

**File:** `server/routes/coaching-insights.js` (line 22)
```javascript
if (process.env.COACHING_INSIGHTS_ENABLED !== 'true' || process.env.NODE_ENV === 'test') {
    return;  // ← EXITS EARLY if flag not set
}
```

**Issue:** Without `COACHING_INSIGHTS_ENABLED=true`, the function returns immediately

---

## What's Missing on Railway

| Env Var | Local | Railway | Required |
|---------|-------|---------|----------|
| `GROQ_API_KEY` | ✅ Set | ❌ MISSING | 🔴 YES |
| `COACHING_INSIGHTS_ENABLED` | ✅ true | ❌ MISSING | 🔴 YES |
| `JWT_SECRET` | ✅ Set | ✅ Set | ✓ |
| `DATABASE_URL` | ✅ Set | ✅ Set | ✓ |

---

## Impact on Features

| Feature | Status | Why |
|---------|--------|-----|
| **Regular Notifications** | ✅ Working | No feature flag needed |
| **Assigned Task Notification** | ✅ Working | Simple INSERT in tasks.js |
| **Completion Notification** | ✅ Working | Simple INSERT in tasks.js |
| **Coaching Insights (Phase 7)** | ❌ BROKEN | Missing `GROQ_API_KEY` + `COACHING_INSIGHTS_ENABLED` |

---

## How to Fix

### Step 1: Get Groq API Key
1. Go to https://console.groq.com
2. Sign up (email only, no credit card)
3. Copy API key (format: `gsk_...`)

### Step 2: Set Railway Environment Variables
1. Go to Railway dashboard: https://railway.app
2. Select the **Coach Task Tracker** project → Backend service
3. Go to **Variables** tab
4. Add:
   ```
   GROQ_API_KEY=gsk_YOUR_KEY_HERE
   COACHING_INSIGHTS_ENABLED=true
   ```
5. Deploy (Railway auto-redeploys)

### Step 3: Verify
```bash
# Test login
TOKEN=$(curl -s -X POST "https://spectacular-connection-production-d07b.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Create task
curl -X POST "https://spectacular-connection-production-d07b.up.railway.app/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "coach_ids": [5],
    "title": "Test Task for Notifications",
    "description": "This will trigger notifications",
    "priority": "high",
    "due_date": "2026-06-10T18:00:00Z"
  }'

# Check notifications
curl -s -X GET "https://spectacular-connection-production-d07b.up.railway.app/api/notifications" \
  -H "Authorization: Bearer $TOKEN" | grep -c "coaching_insights"
# Should return: 0 or more (coaching_insights should appear after task completion)
```

---

## Testing Plan (After Fix)

### 1. Admin Login & Create Task
```
Login → assign task to coach with near-future due date
Expected: Task appears, coach gets "assigned" notification
```

### 2. Coach Login & Complete Task
```
Login as coach → view task → click "Mark Complete"
Expected: 
  - Task status → "completed"
  - Coaching insights notification appears after 1-2 seconds
  - Message includes pattern analysis, growth opportunity, risk assessment
```

### 3. Verify Coaching Insights Content
Expected notification message format:
```
On "Task Title": [Growth] [Pattern] [Risk recommendation]
```

With metadata (visible in browser dev tools):
```json
{
  "pattern_agent": {
    "summary": "3 of last 5 tasks on-time...",
    "confidence": 0.92
  },
  "growth_agent": {
    "summary": "Good deadline execution...",
    "confidence": 0.88
  },
  "risk_agent": {
    "summary": "No recurring delays...",
    "confidence": 0.95
  },
  "consensus": "Keep this momentum going",
  "insights_status": "success"
}
```

---

## Notification Bell Behavior (After Fix)

When coaching insights are triggered:

1. **After task completion:** 1-2 second delay (async processing)
2. **Bell shows:** New unread badge with count
3. **Dropdown shows:** Coaching insights cards with expandable details
4. **Coaching tone:** Messages like:
   - "3 of last 5 tasks on-time — keep the momentum!"
   - "Consider focusing on high-priority deadlines where you often slip"
   - "No risks detected — you're on track!"

---

## Files Involved

| File | Purpose | Status |
|------|---------|--------|
| `server/routes/coaching-insights.js` | 3-agent swarm implementation | ✅ Ready (needs env vars) |
| `server/routes/tasks.js` | Calls queueCoachingInsights on completion | ✅ Working |
| `server/db.js` | Creates notifications table with `insights_status` column | ✅ Working |
| `client/src/components/NotificationBell.jsx` | Polls API, displays coaching insights cards | ✅ Working |
| `server/.env.example` | Documents required env vars | ✅ Updated |

---

## Next Steps

1. ✅ **Add env vars to Railway** (GROQ_API_KEY + COACHING_INSIGHTS_ENABLED)
2. ✅ **Deploy** (Railway auto-redeploys on env change)
3. ✅ **Test** Create task → complete task → check notification
4. ✅ **Verify** Coaching insights appear with agent analysis

Once env vars are set, **coaching insights will automatically start working** — no code changes needed!

---

**Status:** Ready for deployment | **Urgency:** High | **Effort:** 5 minutes
