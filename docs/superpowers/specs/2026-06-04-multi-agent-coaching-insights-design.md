---
phase: "7"
status: "active"
owner: "brainstorming"
last_updated: "2026-06-04T00:00:00Z"
beads: []
---

# Phase 7 Design: Multi-Agent Coaching Insights

## Overview

When coaches complete tasks or submit delay reasons, spawn a **3-agent consensus swarm** that analyzes coach behavior patterns and generates personalized coaching insights. Results appear as notifications without blocking the user experience.

**Key Principle:** Async, fire-and-forget. User completes task → immediately returns success → agents run in background → insights arrive via notifications within 1-2 minutes.

---

## Architecture

### Trigger Points

Two events spawn the agent swarm:

1. **Task Completion:** `PUT /api/tasks/:id/complete`
   - Coach marks task done
   - Endpoint returns immediately (201)
   - Background job queued: `analyzeCoachBehavior(coach_id, task_id, 'completion')`

2. **Delay Reason Submission:** `PUT /api/tasks/:id/delay-reason`
   - Coach submits reason for overdue task
   - Endpoint returns immediately (200)
   - Background job queued: `analyzeCoachBehavior(coach_id, task_id, 'delay')`

### Agent Swarm (3 Agents)

Each agent runs in parallel via `Promise.all()`. Input context:
- Coach's task history (last 10 completed/delayed tasks)
- Current task details (title, due date, status)
- Event type (completion or delay)

**Agent 1: Pattern Agent**
- Analyzes historical coach data (on-time vs delayed patterns)
- Compares current task to past behavior
- Outputs: "Coach is 70% on-time" | "Recurring delay pattern detected: Mondays"

**Agent 2: Growth Agent**
- Identifies learning opportunities from coach behavior
- Connects task completion to professional growth
- Outputs: "Great execution on deadline pressure" | "Consider breaking larger tasks into smaller steps"

**Agent 3: Risk Agent**
- Flags recurring delays or blockers
- Identifies risk factors (task complexity, time of week, coach workload)
- Outputs: "High-risk: Complex tasks + end-of-week" | "No risks detected"

### Claude API Integration

**Endpoint:** `https://api.anthropic.com/v1/messages` (Anthropic SDK)

**Model:** claude-opus-4-8 (latest, best reasoning for analysis)

**Parallelization:** `Promise.all([patternPromise, growthPromise, riskPromise])`

**Timeout:** 10 seconds per agent (30s total for swarm, then proceed without insights if timeout)

**Failure Handling:** 
- If all 3 agents fail → log error, do NOT notify coach
- If 1-2 agents fail → use partial results, note in metadata that some agents failed
- Never block task completion on agent failure

---

## Data Flow

```
Coach completes task
  ↓
PUT /api/tasks/:id/complete returns 200
  ↓
Queue background job: analyzeCoachBehavior()
  ↓
Fetch coach history + task context
  ↓
Call 3 agents in parallel via Claude API
  ↓
Wait up to 30 seconds (or timeout)
  ↓
Create notification: type='coaching_insights', metadata={insights from agents}
  ↓
Coach sees notification in bell (next 30s poll)
```

---

## Database Schema

### Extend `notifications` Table

Add two new columns (nullable for backward compatibility):

```sql
ALTER TABLE notifications ADD COLUMN metadata TEXT;  -- JSON, stores agent results
ALTER TABLE notifications ADD COLUMN insights_status TEXT DEFAULT 'pending'; -- 'pending', 'success', 'partial', 'timeout'
```

### Notification Record Structure

```json
{
  "id": 42,
  "user_id": 2,
  "task_id": 5,
  "task_title": "Q2 Strategy",
  "type": "coaching_insights",
  "message": "[Coaching summary from agents]",
  "metadata": {
    "pattern_agent": {
      "summary": "You're 85% on-time — strong execution",
      "pattern": "Excels with 3-5 day deadlines",
      "confidence": 0.92
    },
    "growth_agent": {
      "opportunity": "Great time pressure management",
      "recommendation": "Apply this approach to future complex tasks",
      "confidence": 0.88
    },
    "risk_agent": {
      "risk_level": "low",
      "factors": ["task completed on-time", "no recurring blockers"],
      "alert": null,
      "confidence": 0.95
    },
    "consensus": "Strong completion. Consider this approach for future tasks.",
    "generated_at": "2026-06-04T15:30:00Z"
  },
  "insights_status": "success",
  "read": 0,
  "created_at": "2026-06-04T15:30:00Z"
}
```

---

## Implementation Components

### Backend Changes

**1. New File: `server/routes/coaching-insights.js`**
- `analyzeCoachBehavior(coach_id, task_id, event_type)` — main entry point
- `fetchCoachHistory(coach_id, limit=10)` — get recent task history
- `callAgentSwarm(coach_history, task_context)` — invoke 3 agents in parallel
- `createCoachingInsightNotification(coach_id, task_id, agentResults)` — save to DB

**2. Integration Points:**
- `server/routes/tasks.js` — POST completion and delay-reason handlers queue the job
- `server/cron.js` — optionally add a cleanup job for stale pending insights (purge after 24h if not completed)

**3. Environment:**
- Add `.env`: `ANTHROPIC_API_KEY` (required for Claude API calls)
- Add `.env`: `COACHING_INSIGHTS_ENABLED=true` (feature flag, default false for Phase 7+)

### Frontend Changes

**1. Extend `NotificationBell.jsx`:**
- Detect `type === 'coaching_insights'` in notification list
- Render special card with expanded metadata display
- Show agent confidence scores (optional, collapsed by default)

**2. New Component: `CoachingInsightCard.jsx`**
- Displays coaching summary in friendly, coaching-tone language
- Shows growth opportunity (highlighted with teal background)
- Shows risk alert (if present, highlighted with orange background)
- "Dismiss" button marks as read

**3. Styling:**
- Use existing ui-ux-pro-max-skill (Teal #0D9488, orange #EA580C)
- Coaching-tone language (e.g., "Great work!" instead of "Task completed")

---

## API Changes

### Existing Routes (Modified)

**`PUT /api/tasks/:id/complete`**
- Return immediately with task data
- Queue background job (non-blocking): `analyzeCoachBehavior(req.user.id, id, 'completion')`
- No change to response format

**`PUT /api/tasks/:id/delay-reason`**
- Return immediately with task data
- Queue background job (non-blocking): `analyzeCoachBehavior(req.user.id, id, 'delay')`
- No change to response format

### New Routes (Optional, for testing/admin)

**`POST /api/coaching-insights/analyze` (admin only)**
- Manually trigger analysis for a coach/task (for testing)
- Request: `{ coach_id, task_id, event_type }`
- Response: agent results immediately (synchronous, for demo)

---

## Error Handling

### Claude API Failures
- Individual agent timeout (>10s) → mark that agent as failed
- All agents timeout (>30s total) → create notification with `insights_status='timeout'`, partial results
- Network error → log to `.claude/audit.log`, do NOT notify coach
- Rate limit (429) → queue for retry in 60 seconds

### Database Failures
- Cannot create notification → log error, do NOT block task completion
- Database locked → queue retry (node-cron runs hourly, picks up pending jobs)

### Graceful Degradation
- If Claude API unreachable → coaching insights disabled, coach sees no notification (feature disabled gracefully)
- If partial results (2/3 agents succeeded) → merge results, note in metadata that 1 agent failed

---

## Testing Strategy

### Unit Tests
- `analyzeCoachBehavior()` with mocked Claude API responses
- `fetchCoachHistory()` returns correct task data
- `createCoachingInsightNotification()` correctly stores metadata

### Integration Tests
- Full flow: coach completes task → notification created after ~1s (short timeout for tests)
- Partial failure: 2 agents succeed, 1 times out → notification created with partial results
- Timeout: all agents timeout → notification created with `insights_status='timeout'`

### E2E Tests (agent-browser)
- Coach logs in → completes task → waits for notification bell update → clicks notification → sees coaching insights card
- Verify card displays: pattern summary, growth opportunity, risk (if any)
- Verify "dismiss" button marks as read

---

## Phasing

### Phase 7 (MVP)
- ✅ 3-agent swarm analysis
- ✅ Async, fire-and-forget execution
- ✅ Notifications with metadata storage
- ✅ Basic UI card display
- ✅ Unit + integration tests
- ✅ E2E verification with agent-browser

### Phase 8+ (Future Enhancements)
- Email delivery of coaching insights (Phase 5 layer extends)
- Coaching dashboard: trends over time (coach sees own patterns)
- Historical insights search/replay
- Admin can craft custom agent prompts per team
- Bulk re-analysis of historical tasks

---

## Success Criteria

✅ **User Experience**
- Coach completes task → immediate success feedback (no waiting)
- Insights appear within 1-2 minutes
- Insights are coaching-tone, actionable, not generic

✅ **Reliability**
- 99% of completed tasks get coaching insights (allow 1% timeout/failure)
- No task completion failures due to agent swarm
- Failed insights logged, never cause user-facing errors

✅ **Quality**
- Agent outputs are specific (mention task/coach name, not generic)
- Consensus is clear (agree/disagree on growth/risk)
- Confidence scores included in metadata

✅ **Testing**
- 15+ unit tests (mocked Claude API)
- 5+ integration tests (full flow, failure scenarios)
- 3 E2E tests (agent-browser verification)
- All passing before merge

---

## Non-Goals

❌ Real-time coaching (Phase 7 is async-only)  
❌ Coaching dashboard (Phase 8+)  
❌ Email notifications (Phase 5 layer, separate)  
❌ Custom agent prompts per team (Phase 8+)  
❌ Fine-tuning agents on coach data (out of scope)  

---

## Questions Answered

| Question | Answer |
|----------|--------|
| Synchronous or async? | **Async.** Fire-and-forget, user gets immediate response. |
| Agent implementation? | **Claude API directly.** Call 3 times in parallel via Anthropic SDK. |
| Insights format? | **Structured data in JSON metadata.** Text summary + agent outputs with confidence scores. |
| Storage? | **Extend notifications table.** Add `metadata` and `insights_status` columns. |
| UI display? | **Special coaching_insights card.** Rendered in existing notification bell. |
| Scope? | **Async batch job in Phase 7.** No polling delays, agents fire immediately on task completion. |

---

## File Structure

```
server/
  ├── routes/
  │   ├── coaching-insights.js (NEW)
  │   ├── tasks.js (MODIFIED: queue job on completion/delay-reason)
  │   └── notifications.js (unchanged)
  ├── cron.js (MODIFIED: optional cleanup job)
  └── index.js (unchanged)

client/
  ├── src/
  │   └── components/
  │       ├── NotificationBell.jsx (MODIFIED: render CoachingInsightCard)
  │       └── CoachingInsightCard.jsx (NEW)
  └── src/pages/ (unchanged)

docs/
  └── API.md (MODIFIED: note coaching_insights endpoint)
```

---

**Status:** Ready for implementation plan  
**Complexity:** Medium (3-4 new files, 2-3 route modifications)  
**Estimated Effort:** 12-16 hours (implementation + testing + E2E)
