---
phase: "9b"
status: "planning"
owner: "phase-builder"
last_updated: "2026-06-09T00:00:00Z"
beads: []
---

# Phase 9b: Groq AI Coaching Insights — Handoff Document

**Session Date:** 2026-06-09  
**Status:** Phase 9 complete, Phase 9b ready to begin  
**Deployment:** Live on Railway (commit `7fa208f`)

---

## Executive Summary

Phase 9 (autonomous agent orchestration) is **complete and deployed**. Phase 9b adds **AI-powered coaching insights** using Groq API to make the agents actually useful.

**Current Problem:** Phase 9 agents are "dumb orchestrators" — they detect overdue tasks and send emails, but don't understand WHY coaches struggle or HOW to help.

**Solution:** Groq API + 3-agent consensus swarm analyzes coach behavior and generates personalized, actionable coaching recommendations.

---

## Phase 9 Status ✅

**What's Live:**
- ✅ Monitoring Agent (detects at-risk/overdue tasks, reads from database)
- ✅ Support Agent (makes intervention decisions with fatigue prevention)
- ✅ Reporting Agent (generates daily analytics digest)
- ✅ Agent Orchestrator (coordinates all three on schedule: 30-min + 9am daily)
- ✅ Database (5 Phase 9 tables: monitoring_snapshots, support_actions, daily_reports, sheet_comments, agent_errors)
- ✅ Cron scheduling (agents run automatically on schedule)

**Deployment:**
- Backend: https://spectacular-connection-production-d07b.up.railway.app
- Database: Railway PostgreSQL (persistent across redeploys)
- Last commit: `7fa208f` [Phase 9] Clean Up: Make Google Sheets Optional

**Test Results:**
- 192+ total tests passing (100% pass rate)
- 27 integration tests (swarm orchestration verified)
- 24 orchestrator unit tests
- All critical paths tested

---

## What Phase 9 Actually Does

**30-Minute Cycle (Monitoring + Support):**
```
Every 30 minutes:
  1. Monitoring Agent reads tasks table
  2. Detects overdue/at-risk tasks
  3. Saves snapshots to database
  4. Support Agent reads snapshots
  5. Decides: email? tag? escalate?
  6. Prevents fatigue (30-min tag window, 4-hour email window)
  7. Queues emails via email_queue (Phase 8)
```

**Daily Cycle (9am UTC - Reporting):**
```
Every day at 9am:
  1. Reporting Agent reads support_actions from last 24 hours
  2. Analyzes coach patterns (procrastinator, fast-track, steady, etc.)
  3. Generates daily digest with statistics
  4. Archives to daily_reports table
```

**Current Value:**
- ✅ Automation (admins don't manually check dashboard)
- ✅ Real-time support (coaches nudged within 30 min)
- ✅ Analytics (daily digest with patterns)
- ⚠️ Intelligence (agents follow rules, not AI)

---

## Phase 9b Scope: Add AI Coaching Intelligence

### Why Phase 9b?

**Current:** Agents are rule-based ("if overdue, email coach")  
**Goal:** Agents are intelligent ("coach is procrastinating, try a different intervention approach")

### Three Components

#### 1. **Groq API Integration** (Free tier, 30 RPM)

```bash
# Environment setup (already partially done from Phase 7)
GROQ_API_KEY=gsk_YOUR_KEY_HERE
COACHING_INSIGHTS_ENABLED=true
```

**Model:** `llama-3.3-70b-versatile`  
**Cost:** Free (30 requests/min, 6,000 tokens/min)  
**Setup:** https://console.groq.com (already done in Phase 7)

#### 2. **Intelligent Support Agent Decision-Making**

**Current logic:**
```javascript
if (recentlyTagged) {
  // Don't tag again
} else if (hasSheet) {
  // Tag in sheet
} else {
  // Send email
}
```

**Phase 9b logic:**
```javascript
const context = await analyzeCoachPattern(coachId);  // Historical data
const recommendation = await groq.generateDecision({
  taskStatus: 'overdue',
  coachPattern: 'procrastinator',
  recentInterventions: [...],
  historicalSuccess: [...]
});
// recommendation might be: "This coach responds better to deadline pressure, try escalate vs email"
```

#### 3. **Adaptive Coaching Insights**

**New notification type:** `coaching_insights` (sent after task completion or delay submission)

```javascript
// When coach completes task or submits delay reason
const insights = await analyzeCoachBehavior({
  completedTasks: [...],
  delayPatterns: [...],
  responseToInterventions: [...]
});

// Send personalized insight:
// "You completed 4 tasks in a row despite deadline pressure. 
//  Try breaking complex tasks into smaller chunks next time."
```

---

## Architecture: How Phase 9b Fits

```
┌─────────────────────────────────────────────────────────┐
│                  Phase 9b Architecture                   │
└─────────────────────────────────────────────────────────┘

Phase 9 (Rule-Based Agents)
  ├─ Monitoring Agent → detects at-risk tasks
  ├─ Support Agent → follows decision rules
  └─ Reporting Agent → summarizes stats

Phase 9b (AI Enhancement Layer)
  ├─ Groq API Integration
  │  ├─ Analyze coach behavior patterns
  │  ├─ Recommend intervention strategies
  │  └─ Generate personalized insights
  │
  ├─ Enhanced Support Agent
  │  ├─ AI-informed decision making
  │  ├─ Adaptive intervention selection
  │  └─ Context-aware fatigue prevention
  │
  └─ Insights Generation
     ├─ Post-task-completion analysis
     ├─ Delay-reason deep-dive
     └─ Pattern-based coaching recommendations

┌─────────────────────────────────────────────────────────┐
│              Groq API (Free Tier, 30 RPM)               │
│  llama-3.3-70b-versatile                                │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan: Phase 9b (3-4 days)

### Task 1: Groq Service Wrapper (4 hours)
**File:** `server/services/groq-service.js`

```javascript
class GroqService {
  async analyzeCoachPattern(coachId) {
    // Query historical task data
    // Call Groq to analyze patterns
    // Return: { pattern, reasoning, recommendation }
  }

  async generateCoachingInsight(coachId, taskData) {
    // Call Groq with task context
    // Return personalized insight message
  }

  async recommendIntervention(issue) {
    // Input: at-risk task, coach pattern, recent interventions
    // Output: Groq recommendation (email, tag, escalate, other)
  }
}
```

**Tests:** 15+ unit tests covering:
- API timeout handling (15s)
- Token rate limiting (30 RPM)
- Graceful degradation (if Groq unavailable)
- Response parsing and validation

### Task 2: Enhanced Support Agent (6 hours)
**File:** `server/agents/support-agent.js` (modify existing)

**Changes:**
- Use `groqService.recommendIntervention()` instead of hardcoded rules
- Keep fatigue prevention (30-min tag window, 4-hour email window)
- Add decision logging (why was this intervention chosen?)

**Tests:** 20+ tests covering:
- AI-informed decisions vs rule-based
- Fallback to rules if Groq unavailable
- Decision consistency across similar situations

### Task 3: Coaching Insights Feature (6 hours)
**File:** `server/services/coaching-insights.js` (NEW)

**Trigger:** After task completion OR delay reason submission

```javascript
class CoachingInsightsService {
  async generateOnTaskCompletion(taskId, coachId) {
    // Analyze: on-time completion, intervention response, pattern
    // Generate insight: "Great execution under deadline pressure"
  }

  async generateOnDelaySubmission(taskId, coachId, delayReason) {
    // Analyze: delay reason, historical delays, blocker patterns
    // Generate insight: "You're blocked on approvals — escalate faster next time"
  }
}
```

**Tests:** 15+ tests covering:
- Insight generation quality
- Personalization (different for each coach)
- Graceful degradation if Groq down

### Task 4: Integration + E2E Testing (4 hours)
**Files:** `server/__tests__/integration/phase9b-integration.test.js`

**Tests:**
- Full pipeline: task overdue → AI recommendation → email sent
- Multiple coaches with different patterns → different interventions
- Coaching insights post-completion
- Rate limiting and timeout handling
- Fallback behavior (if Groq unavailable)

---

## Current Blockers & Solutions

### ✅ Already Resolved

| Issue | Solution |
|-------|----------|
| Google Sheets complexity | Removed — agents read from database only |
| Phase 9 agents useless | Phase 9b adds AI layer to make them useful |
| Groq API key not set | Use existing from Phase 7 (already in Railway) |

### ⚠️ Minor Risks

| Risk | Mitigation |
|------|-----------|
| Groq API quota (30 RPM) | Queue requests, batch processing, fallback to rules |
| Groq timeout (15s) | Set timeout, return rule-based decision if Groq times out |
| Cost (free tier limit) | Monitor usage, alert if approaching limit |
| API key rotation | Use Railway secrets, never hardcode |

---

## Key Files & Config

### Environment Variables (Already Set on Railway)

```bash
GROQ_API_KEY=gsk_...  # From Phase 7, already live
COACHING_INSIGHTS_ENABLED=true
DATABASE_URL=postgresql://...  # Railway PostgreSQL
GMAIL_EMAIL=...  # From Phase 8
GMAIL_APP_PASSWORD=...  # From Phase 8
```

### New Files to Create

| File | Purpose | Size |
|------|---------|------|
| `server/services/groq-service.js` | Groq API wrapper | 200-250 lines |
| `server/services/coaching-insights.js` | Insight generation | 150-200 lines |
| `server/agents/support-agent.js` (modify) | AI-informed decisions | +100 lines |
| `server/__tests__/groq-service.test.js` | Unit tests | 200+ lines |
| `server/__tests__/integration/phase9b-integration.test.js` | Integration tests | 300+ lines |

### Modified Files

| File | Change | Impact |
|------|--------|--------|
| `server/agents/support-agent.js` | Add Groq calls | Support Agent becomes intelligent |
| `server/cron.js` | Add insights job | Trigger after task events |
| `server/routes/tasks.js` | Call insights on complete | Generate insight after task completion |

---

## Testing Strategy

### RED-GREEN-REFACTOR

**RED:** Write tests for AI-informed decisions
```javascript
test('Support Agent uses Groq to decide intervention', async () => {
  // Coach pattern: procrastinator
  // Groq recommends: escalate (not email)
  // Assert: escalation triggered
});
```

**GREEN:** Implement Groq service + update Support Agent
```javascript
const recommendation = await groqService.recommendIntervention({
  taskStatus: 'overdue',
  coachPattern: 'procrastinator',
  ...
});
// Support Agent follows recommendation
```

**REFACTOR:** Extract helpers, add error handling, optimize

### Test Coverage Target
- 40+ unit tests (Groq service)
- 30+ integration tests (Support Agent + Insights)
- 20+ E2E tests (full coach journey)
- **Total: 90+ tests, 100% pass rate**

---

## Success Criteria

- [ ] Groq service wrapper complete (15+ tests passing)
- [ ] Support Agent uses AI for decisions (20+ tests passing)
- [ ] Coaching insights generated on task events (15+ tests passing)
- [ ] Integration tests verify full pipeline (20+ tests passing)
- [ ] Graceful degradation if Groq unavailable
- [ ] Rate limiting handled properly
- [ ] All 90+ tests passing on Railway
- [ ] Live on production, agents making smart decisions

---

## Next Session Checklist

**Before starting Phase 9b:**

1. [ ] Verify Phase 9 deployment is live
   ```bash
   curl https://spectacular-connection-production-d07b.up.railway.app/health
   ```

2. [ ] Confirm Groq API key is set on Railway
   ```bash
   railway var list | grep GROQ
   ```

3. [ ] Read this handoff document (you're doing it!)

4. [ ] Review existing Phase 7 coaching insights implementation (for reference)
   ```bash
   grep -r "coaching" server/routes/tasks.js
   ```

5. [ ] Start with Task 1: Groq Service Wrapper

---

## Quick Commands

```bash
# Verify Phase 9 is running
railway status

# Check logs
railway logs --service spectacular-connection

# Update a variable
railway var set COACHING_INSIGHTS_ENABLED=true

# Deploy after changes
railway deployment up

# Run tests locally
cd server && npm test -- phase9b-integration.test.js
```

---

## Known Good State

- **Last working commit:** `7fa208f`
- **Deployed:** Yes, live on Railway
- **Tests:** 192+ passing
- **Database:** 5 Phase 9 tables + 4 Phase 8 tables
- **API:** All Phase 1-8 endpoints + Phase 9 agents running

---

## Questions for Next Agent

1. Should Phase 9b insights go in a new table or use existing `notifications` table?
   - **Current plan:** Reuse `notifications` table with type='coaching_insights'
   - **Alternative:** New table `coaching_insights` with richer metadata

2. Should Groq recommendations be logged for analysis?
   - **Current plan:** Yes, log to `agent_decisions` table (new)
   - **Benefit:** Understand which interventions work best

3. How aggressive should AI be in overriding rules?
   - **Current plan:** AI suggests, fatigue prevention still enforced
   - **Alternative:** AI can override fatigue prevention for high-risk cases

---

## Phase 9b Timeline Estimate

- Task 1 (Groq wrapper): 4 hours
- Task 2 (Enhanced Support Agent): 6 hours
- Task 3 (Coaching Insights): 6 hours
- Task 4 (Integration + E2E tests): 4 hours
- **Total: 20 hours (~3-4 days with testing & review)**

---

**Status: Ready to start Phase 9b. Code is clean, tests pass, deployment is live. Next step: implement Groq service wrapper.**

🚀 Phase 9b incoming!
