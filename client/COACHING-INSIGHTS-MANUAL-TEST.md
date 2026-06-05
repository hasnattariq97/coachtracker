# Phase 7 Coaching Insights — Manual Chrome DevTools Test

## Overview
This guide walks through testing the Phase 7 multi-agent coaching insights feature using Chrome DevTools in the browser.

## Prerequisites
- Backend running on `http://localhost:3001`
- Frontend running on `http://localhost:5173`
- Groq API key set in `server/.env` as `GROQ_API_KEY=gsk_...`
- Coach account available (e.g., `coach@test.com / password123`)

## Test Flow

### Phase 1: Admin Setup (5 minutes)

**Step 1: Admin Login**
1. Open http://localhost:5173/login
2. Enter credentials:
   - Email: `admin@tracker.com`
   - Password: `admin123`
3. Click "Sign in"
4. **Expected:** Redirect to `/admin` dashboard

**Step 2: Create/Verify Coach**
1. Navigate to "Coaches" page
2. If no test coach exists, click "Add Coach"
3. Fill in:
   - Name: `Test Coach`
   - Email: `testcoach@example.com`
   - Password: `password123`
4. Click "Create Coach"
5. **Expected:** Coach appears in the coaches list

**Step 3: Assign Task**
1. Click "Assign Task" or navigate to Tasks
2. Fill in task details:
   - **Title:** "Coaching Insights Test: Phase 7 Demo"
   - **Description:** "This task demonstrates the multi-agent coaching insights feature."
   - **Priority:** "High"
   - **Due Date:** Tomorrow (24 hours from now)
   - **Select Coach:** Your test coach (Coach A or Test Coach)
3. Click "Assign Task"
4. **Expected:** Task appears in TaskBoard with "assigned" status
5. **Note the Task ID** for reference (e.g., ID: 123)

---

### Phase 2: Coach Workflow (5 minutes)

**Step 1: Coach Login**
1. Open a **new incognito/private window** (or new browser)
2. Go to http://localhost:5173/login
3. Enter coach credentials:
   - Email: `testcoach@example.com` (or your test coach email)
   - Password: `password123`
4. Click "Sign in"
5. **Expected:** Redirect to `/coach` dashboard with "My Tasks"

**Step 2: View Assigned Task**
1. On "My Tasks" page, you should see the task assigned in Phase 1
2. Click on the task to view details
3. **Expected:** Task details show:
   - Title: "Coaching Insights Test: Phase 7 Demo"
   - Status: "assigned"
   - Due date: Tomorrow
   - Priority: High
   - Full description visible

**Step 3: Complete Task**
1. Click "Mark as Complete" button
2. **Expected:** 
   - Task status changes to "completed"
   - Confirmation toast appears: "Task marked as complete"
   - Page updates showing completed state
3. **IMPORTANT:** Wait 5-10 seconds for the async coaching insights job to process

---

### Phase 3: Coaching Insights Verification (3 minutes)

**Step 1: Check Notifications (Coach View)**
1. Look for the notification bell icon (top right)
2. Click the bell to open notifications dropdown
3. **Expected:** 
   - New notification appears with type "coaching_insights"
   - Message contains coaching-tone language (e.g., "Great work!", "Strong execution", etc.)
   - Notification shows recently at the top

**Step 2: View Coaching Insights Details**
1. Click on the coaching insights notification
2. **Expected:** Notification expands showing:
   - **Pattern Agent Analysis:** Historical completion patterns
     - Example: "85% on-time completion rate — strong execution"
   - **Growth Agent Analysis:** Learning opportunities
     - Example: "Great work on deadline pressure handling"
   - **Risk Agent Analysis:** Recurring blockers
     - Example: "No recurring delays detected"
   - **Consensus:** Combined coaching recommendation
   - **Confidence Scores:** Each agent shows 50-95% confidence

**Step 3: Admin Notification Verification**
1. Switch back to the **admin browser** (or window)
2. Open notification bell
3. **Expected:** 
   - Admin sees "Task completed" notification (from coach)
   - May also see coaching_insights notification (coach receives it, admin creates it)
   - Notifications are timestamped

---

## Chrome DevTools Testing Details

### Opening DevTools
1. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
2. Go to **Network** tab to monitor API calls

### API Calls to Monitor

**When task is assigned:**
- `POST /api/tasks` → Creates task for coach
- Response includes task ID and "assigned" status

**When coach completes task:**
- `PUT /api/tasks/{id}/complete` → Marks task complete
- Response: `{ id, status: "completed", completed_at: "..." }`
- **Backend logs:** `[Coaching Insights] Analysis complete for coach X, task Y (165ms)`

**When coaching insights are created:**
- Check **Console** tab for logs:
  - `[Coaching Insights] queueing analysis`
  - `[Pattern Agent] Analysis complete`
  - `[Growth Agent] Analysis complete`
  - `[Risk Agent] Analysis complete`
  - `[Coaching Insights] Analysis complete`

**Get notifications:**
- `GET /api/notifications` → Fetches all notifications
- Look for `type: "coaching_insights"` in response
- Verify `metadata` contains: `pattern_agent`, `growth_agent`, `risk_agent`, `consensus`

### Console Logging
1. Open **Console** tab in DevTools
2. Filter for `[Coaching Insights]` or `[Pattern Agent]`
3. Look for messages like:
   ```
   [Pattern Agent] Analysis complete
   [Growth Agent] Analysis complete
   [Risk Agent] Analysis complete
   [Coaching Insights] Analysis complete for coach 2008, task 120 (165ms)
   ```

---

## Expected Test Results

### ✅ Success Indicators
- [ ] Admin successfully assigns task to coach
- [ ] Coach receives and views assigned task
- [ ] Coach can mark task as complete
- [ ] Coaching insights notification appears within 10 seconds
- [ ] Notification shows all 3 agents' analysis
- [ ] Message uses coaching tone (encouraging, growth-focused)
- [ ] Each agent shows confidence score (50-95%)
- [ ] Consensus message is actionable and specific
- [ ] No errors in browser console
- [ ] No 500 errors in Network tab

### ⚠️ Potential Issues & Fixes

**Issue: Coaching insights not appearing**
- **Cause 1:** `GROQ_API_KEY` not set in `server/.env`
  - **Fix:** Add `GROQ_API_KEY=gsk_YOUR_KEY` to `.env`, restart backend
- **Cause 2:** `COACHING_INSIGHTS_ENABLED` is not set to "true"
  - **Fix:** Add `COACHING_INSIGHTS_ENABLED=true` to `.env`
- **Cause 3:** Groq API timeout (>30 seconds)
  - **Fix:** Verify Groq API is accessible, check `insights_status: "timeout"` in metadata

**Issue: Coach account doesn't exist**
- **Fix:** Create test coach from admin dashboard first

**Issue: Task status doesn't update**
- **Fix:** Reload page with `F5`, check browser console for errors

**Issue: Notification bell doesn't update**
- **Fix:** Bell polls every 30 seconds; wait up to 30s or reload page

---

## Test Checklist

### Admin Side
- [ ] Can log in with admin credentials
- [ ] Can access Coaches page
- [ ] Can create coach account
- [ ] Can assign task to coach
- [ ] Can see completed task notification
- [ ] Can see coaching insights in notifications (optional)

### Coach Side
- [ ] Can log in with coach credentials
- [ ] Can see assigned tasks in "My Tasks"
- [ ] Can click task to view details
- [ ] Can click "Mark as Complete" button
- [ ] Page updates to show "completed" status
- [ ] Notification bell shows new notification
- [ ] Can view coaching insights details
- [ ] Coaching insights contain pattern/growth/risk analysis
- [ ] Message uses coaching tone

### Technical
- [ ] No console errors
- [ ] No 500 API errors
- [ ] Network tab shows successful API calls
- [ ] Backend logs show coaching insights processing
- [ ] Groq API calls complete successfully
- [ ] Database stores coaching_insights notification

---

## Timing Expectations

| Step | Time |
|------|------|
| Admin login | 2 seconds |
| Create coach | 2 seconds |
| Assign task | 2 seconds |
| Coach login | 2 seconds |
| Complete task | 2 seconds |
| **Coaching insights processing** | **3-5 seconds** |
| Notification appears | 1-30 seconds (30s poll) |
| **Total** | **~15-45 seconds** |

---

## Next Steps

1. **Run this manual test** in your browser following the steps above
2. **Check Chrome DevTools** for logs and API calls
3. **Verify all success indicators** pass
4. **Document any issues** with console screenshots
5. **Consider Phase 8:** Batch coaching summaries or team insights

---

## Files Reference

- **Backend:** `server/routes/coaching-insights.js` — Core 3-agent swarm implementation
- **Frontend:** `client/src/components/CoachingInsightCard.jsx` — Display component
- **Integration:** `client/src/components/NotificationBell.jsx` — Notification polling
- **Config:** `server/.env` — Groq API key (GROQ_API_KEY=...)
- **Database:** Notifications table with `type='coaching_insights'` and `metadata` JSON

---

## Tips for Success

1. **Use separate browsers/windows** for admin and coach to avoid logout confusion
2. **Wait 5-10 seconds** after task completion for Groq API to respond
3. **Check DevTools Network tab** if notification doesn't appear
4. **Reload the page** if stuck (browser cache can interfere)
5. **Verify .env variables** before testing: `GROQ_API_KEY` and `COACHING_INSIGHTS_ENABLED`
