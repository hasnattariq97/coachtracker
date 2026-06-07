# 🔴 Why Notifications & Coaching Insights Aren't Working — And How to Fix It

**TL;DR:** Missing environment variables on Railway. Takes 5 minutes to fix.

---

## What's Broken ❌

### 1. Coaching Insights Not Appearing (Phase 7)
When coaches complete tasks, they should see "coaching insights" notifications with AI analysis. **Currently: Nothing happens.**

### 2. Regular Notifications Possibly Not Working
When admins assign tasks, coaches should get "assigned" notification. **Status: Needs verification but likely broken for same reason.**

---

## Root Cause 🎯

Two environment variables **are NOT set on Railway** (your production backend):

| Variable | What It Does | Current Status |
|----------|--------------|-----------------|
| `GROQ_API_KEY` | Enables Groq AI API calls for coaching insights | ❌ **MISSING** |
| `COACHING_INSIGHTS_ENABLED` | Feature flag to enable/disable coaching insights | ❌ **MISSING** |

**Without these:**
- The coaching-insights code checks these variables
- If missing, it returns early without doing anything
- Notifications are never created

---

## How to Fix (5 Minutes) ⚡

### Step 1: Get Your Free Groq API Key (2 min)

1. Go to https://console.groq.com
2. Click **"Sign Up"**
3. Enter your email (that's it! No credit card needed)
4. Check your email, verify
5. Go to **"API Keys"** section
6. Copy your API key (looks like: `gsk_xxxxxxxxxxxxxxx`)

### Step 2: Add Variables to Railway (3 min)

1. Go to https://railway.app
2. Log in
3. Click **"Coach Task Tracker"** project
4. Click **"Backend"** service
5. Click **"Variables"** tab
6. Add these two environment variables:
   ```
   GROQ_API_KEY=gsk_PASTE_YOUR_KEY_HERE
   COACHING_INSIGHTS_ENABLED=true
   ```
7. Click **"Deploy"** (Railway automatically redeploys)
8. Wait 30 seconds for redeploy to finish

**That's it! Done.** ✅

---

## Verify It Works

### Test 1: Create a Task
1. Go to https://coachtracker-theta.vercel.app
2. Login as admin@tracker.com / admin123
3. Go to "Assign Task"
4. Assign a task to the coach with a due date 3-5 days from now
5. Save

### Test 2: Check Notifications
1. Login as coach (saima.jabeen@niete.edu.pk)
2. Click the **bell icon** (top right)
3. Should see: "assigned" notification for the task
4. Click "Mark Complete" on the task
5. Wait 2-3 seconds
6. Check bell again
7. Should see: "coaching_insights" notification with AI analysis

### What Coaching Insights Look Like
Example notification:
```
"3 of your last 5 tasks were completed on-time — keep that momentum! 
Consider focusing more on high-priority tasks. No recurring blockers detected."
```

---

## If It Still Doesn't Work

### Check 1: Railway Deployment Completed
- Go to Railway dashboard
- Backend service → "Deployments"
- Should show a NEW deployment in the last few minutes
- Status should be "Success" (green) not "Building" or "Failed"

### Check 2: Environment Variables Were Saved
- Go to Railway dashboard
- Backend service → "Variables"
- Confirm both variables appear:
  - `GROQ_API_KEY=gsk_...`
  - `COACHING_INSIGHTS_ENABLED=true`

### Check 3: Check Browser Console Errors
- Open https://coachtracker-theta.vercel.app
- Press F12 (Developer Tools)
- Click "Console" tab
- Create a task or complete a task
- Look for any red error messages about API calls
- Screenshot and share if there are errors

### Check 4: Check Backend Logs (Railway)
1. Go to https://railway.app
2. Backend service → "Logs"
3. Scroll down to see recent activity
4. Look for error messages like:
   - "GROQ_API_KEY not found"
   - "Database error"
   - "coaching_insights"

---

## Understanding the Architecture

### How Notifications Work (High-Level)

```
Admin Creates Task
    ↓
Backend: INSERT into notifications table
    ↓
Coach Logs In
    ↓
Frontend: POLL /api/notifications every 30 seconds
    ↓
Bell Icon Shows Unread Count
```

### How Coaching Insights Work (Phase 7)

```
Coach Completes Task
    ↓
Backend: Call queueCoachingInsights()
    ↓
Check: Is COACHING_INSIGHTS_ENABLED=true?
    ↓
Check: Is GROQ_API_KEY set?
    ↓
If YES: Start 3-agent swarm via Groq API
    - Pattern Agent: Analyzes completion patterns
    - Growth Agent: Identifies learning opportunities
    - Risk Agent: Flags blockers/risks
    ↓
Create coaching_insights NOTIFICATION
    ↓
Coach Sees Smart Feedback in Bell
```

**The key:** All three steps must pass. If either flag/key is missing → nothing happens.

---

## What Environment Variables Should Look Like

After adding them to Railway, your **Variables** section should show:

```
DATABASE_URL = postgresql://user:password@host:5432/db
GROQ_API_KEY = gsk_xxxxxxxxxxxxxxxxxxx           ← NEW
JWT_SECRET = test-secret-key-minimum-32-chars
COACHING_INSIGHTS_ENABLED = true                 ← NEW
NODE_ENV = production
CLIENT_ORIGIN = https://coachtracker-theta.vercel.app
```

---

## Helpful Links

- **Groq Console:** https://console.groq.com
- **Railway Dashboard:** https://railway.app
- **Your App:** https://coachtracker-theta.vercel.app
- **Backend API:** https://spectacular-connection-production-d07b.up.railway.app

---

## Files That Implement This Feature

| File | What It Does |
|------|--------------|
| `server/routes/coaching-insights.js` | 3-agent swarm implementation (checks env vars here) |
| `server/routes/tasks.js` | Calls queueCoachingInsights on task completion |
| `server/routes/notifications.js` | Returns notifications to frontend |
| `client/src/components/NotificationBell.jsx` | Polls every 30s, displays coaching insights |

---

## Summary Checklist

- [ ] Go to https://console.groq.com → Get free API key
- [ ] Go to https://railway.app → Variables tab
- [ ] Add `GROQ_API_KEY=gsk_...`
- [ ] Add `COACHING_INSIGHTS_ENABLED=true`
- [ ] Click Deploy
- [ ] Wait 30 seconds
- [ ] Test: Create task → Coach completes → See coaching insights
- [ ] ✅ Done!

---

**Status:** Ready for 5-minute fix | **Next Step:** Get Groq API key and add to Railway ⭐
