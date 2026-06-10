---
phase: "9c"
status: "approved"
owner: "brainstorming"
last_updated: "2026-06-10T00:00:00Z"
beads: []
---

# Phase 9c Design Spec: AI-Powered Reporting Agent & Admin Dashboard

**Date:** 2026-06-10  
**Status:** Design Approved  
**Scope:** 16 hours (~2-3 days)  
**Dependencies:** Phases 0-9b complete, Groq API operational, PostgreSQL (Railway)

---

## Executive Summary

Phase 9c delivers two complementary features:

1. **Reporting Agent Enhancement** — Daily Groq-powered digest with AI-generated insights, recommendations, and coach analysis (replaces rule-based digest)
2. **Admin Dashboard** — Real-time operational visibility with agent status, decision analytics, coach patterns, and full drill-down capability

Together, these give admins both *what happened today* (async daily digest) and *what's happening now* (real-time dashboard with decision context).

**Success Metrics:**
- ✅ Reporting Agent generates meaningful AI insights (not generic)
- ✅ Admin Dashboard displays real-time agent status + decision quality
- ✅ Coach patterns visible and actionable (drill-down shows coaches in pattern + intervention effectiveness)
- ✅ 48+ tests passing (100%)
- ✅ Zero breaking changes to existing features

---

## 1. Reporting Agent Enhancement

### Current Behavior (Phase 9)

The Reporting Agent runs daily at 9am UTC:
1. Reads `support_actions` from last 24 hours
2. Analyzes coach patterns (procrastinator, fast-track, steady, inconsistent)
3. Counts interventions (emails, tags, escalations)
4. Generates static HTML digest based on rules
5. Emails to admin + archives to `daily_reports` table

### Phase 9c Changes

Replace steps 2-4 with Groq-powered analysis:

**New Method:** `generateAIInsights(actionData, coachPatterns, metrics)`

```javascript
const aiInsights = await groqService.generateReportingInsights({
  actions_24h: 47,
  emails_sent: 12,
  tags_created: 5,
  escalations: 2,
  coaches_affected: 7,
  on_time_rate: 0.82,
  coach_patterns: ['procrastinator', 'fast-track', 'steady']
});

// Returns:
{
  key_insights: [
    "2 coaches trending toward procrastination (Sarah, Mike)",
    "Escalation interventions had 85% success rate",
    "Email fatigue detected: 3 coaches marked as spam"
  ],
  recommendations: [
    "Switch Sarah to escalation strategy next week",
    "Trial direct calls for consistent late-comers",
    "Pause email for 24h, resume with different angle"
  ],
  coach_analysis: [
    {
      coach_id: 1,
      name: "Sarah",
      pattern: "procrastinator",
      recent_performance: "2 late tasks in 7 days",
      suggested_approach: "Escalation"
    }
  ],
  team_insights: {
    on_time_trend: "Improving (78% → 82%)",
    most_effective_intervention: "Escalation for procrastinators",
    emerging_patterns: "Email fatigue in high-volume segments"
  },
  confidence: 0.88
}
```

**HTML Digest Template Updates:**
- **Key Insights** section (3-5 bulleted insights, max 100 chars each)
- **Recommendations** section (3-5 actionable items)
- **Per-Coach Analysis** table (name, pattern, 7-day performance, suggested approach)
- **Team Observations** (on-time trend, effectiveness by intervention, emerging patterns)
- **Confidence Badge** (0.88 = 88%, indicates Groq vs fallback)

**Database Schema Changes:**

```sql
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS insights JSONB;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS generated_by VARCHAR DEFAULT 'rules-based';
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);
```

**Error Handling & Fallback:**

If Groq times out (>15s) or returns error:
- Use rule-based insights (existing Phase 9 logic)
- Log `generated_by: 'rules-based'` and `ai_confidence: 0.0`
- Continue sending digest (no admin impact)

---

## 2. Admin Dashboard (Real-Time)

### Page: `/admin/agent-dashboard`

**Refresh:** 30-second poll (not WebSocket, keeps implementation simple)  
**Auth:** Requires `requireAdmin` middleware

### 2.1 Agent Status Cards (Section A)

**Layout:** 3 cards side-by-side (Monitoring | Support | Reporting)

**Per Card:**
- **Icon** (clock icon) + **Title** (agent name)
- **Last run** (human-readable timestamp, e.g., "2 min ago")
- **Status** (✓ Complete, ⏳ Running, ⚠ Failed)
- **Key metrics:**
  - Monitoring: "8 snapshots, 3 coaches at-risk"
  - Support: "12 actions (12 emails, 3 tags, 1 escalation)"
  - Reporting: "Report generated, 5 insights"

If no data (first run), show "—" gracefully.

---

### 2.2 Groq Queue Status (Section B)

**Single card below status cards:**
- **Title:** "Groq Queue" + lightning bolt icon
- **Large number display:** Pending request count
- **Color coding:**
  - Green: ≤10 (healthy)
  - Amber: 11-30 (monitor)
  - Red: >30 (rate limit risk)

---

### 2.3 Decision Analytics (Section C)

**2-column layout:**

**Left: Decision Quality**
- "Total Decisions (24h)" → number
- "Avg. Groq Confidence" → 0.84 (two decimals)
- "Fallback Decisions" → count (amber badge if >5)

**Right: Coach Patterns (7-day aggregate)**
- Procrastinator: 8 detections
- Fast-track: 4 detections
- Steady: 12 detections
- Inconsistent: 2 detections

**Each pattern is clickable** → opens drill-down modal (Section 2.5)

---

### 2.4 Recent Decisions Table (Section D)

**20 rows, sortable by timestamp (DESC):**

| Time | Agent | Coach | Groq Rec. | Actual | Confidence |
|------|-------|-------|-----------|--------|------------|
| 14:32 | Support | Coach 1 | Email | Email | 92% |
| 14:28 | Insights | Coach 5 | Escalate | Tag | 71% |
| 14:15 | Support | Coach 3 | Tag | Email | Fallback |

**Details:**
- **Time:** HH:MM (24h format, latest first)
- **Agent:** `support_agent` | `coaching_insights` (other future agents)
- **Coach:** Coach number (linked to coach detail, future)
- **Groq Rec.:** Groq recommendation (email, tag, escalate, or "—" if no rec)
- **Actual:** Action taken (final_action from agent_decisions)
- **Confidence:** Badge color-coded
  - Green: >80%
  - Blue: 50-80%
  - Gray: <50% or fallback

Rows where `overridden = true` highlighted in light yellow (visual signal of manual intervention).

---

### 2.5 Drill-Down Modal

**Trigger:** Click any pattern in Section 2.3 (Coach Patterns)

**Implementation:** Modal overlay (not separate page), allows quick exploration without navigation friction.

**Header:**
- Pattern name (e.g., "Procrastinator")
- Count: "8 coaches detected (7-day)"
- Close button (X)

---

#### 2.5a Coaches in Pattern

**List view of all coaches matching pattern:**

```
Sarah (Coach ID: 1)
  Detections: 3x (latest 2 days ago)
  Recent tasks: 2 overdue, 1 on-time
  Last intervention: Email (72h ago) — not effective
  
Mike (Coach ID: 2)
  Detections: 2x (latest 4 days ago)
  Recent tasks: 1 overdue, 3 on-time
  Last intervention: Escalation (36h ago) — effective
```

**Per-coach row clickable** → future: drill-down to individual coach history (Phase 9c+)

---

#### 2.5b Decisions for This Pattern

**Table of all decisions for coaches in pattern (7-day window):**

| Coach | Time | Groq Rec. | Action | Status | Confidence |
|-------|------|-----------|--------|--------|------------|
| Sarah | 14:32 | Escalate | Email | Task completed | 78% |
| Mike | 13:45 | Email | Escalation | Task overdue | 82% |
| John | 12:20 | Tag | Tag | Pending | Fallback |

**Sortable by:** Time (DESC), Effectiveness (success first)

---

#### 2.5c Intervention Effectiveness

**Summary for this pattern:**

```
Total interventions: 12 across 8 coaches

Email (4 attempts):      50% success (2 completed on-time)
Tag (5 attempts):        60% success (3 completed on-time)
Escalation (3 attempts): 100% success (all 3 completed on-time)

Recommended next action: Prioritize escalation for "Procrastinator" pattern
```

**Visualization:** Simple bar chart or table showing success rate (%).

---

## 3. API Endpoints

### New Endpoints (6 total)

All require `requireAdmin` middleware. All return JSON. Cache-friendly (5min TTL acceptable).

---

**Endpoint 1: GET /api/admin/agent-status**

Returns latest run for each agent (Monitoring, Support, Reporting).

```javascript
// Response
{
  monitoring: {
    id: "uuid",
    timestamp: "2026-06-10T14:32:00Z",
    snapshots_created: 8,
    coaches_at_risk: 3,
    status: "success"
  },
  support: {
    id: "uuid",
    timestamp: "2026-06-10T14:30:00Z",
    actions_taken: 12,
    emails_sent: 10,
    tags_created: 2,
    escalations: 0,
    status: "success"
  },
  reporting: {
    id: "uuid",
    timestamp: "2026-06-09T09:15:00Z",
    report_generated: true,
    insights_count: 5,
    status: "success"
  },
  groq_queue_pending: 3,
  timestamp: "2026-06-10T14:35:00Z"
}
```

---

**Endpoint 2: GET /api/admin/decisions?hours=24&coach_id=X**

Returns decision history with summaries.

```javascript
// Query Params
hours: 24 (default), coach_id: optional

// Response
{
  summary: {
    total_decisions: 47,
    by_agent: {
      support_agent: 30,
      coaching_insights: 17
    },
    groq_vs_fallback: {
      groq_confidence_avg: 0.84,
      fallback_count: 3
    },
    overrides: {
      total: 2,
      by_reason: { "manual_override": 2 }
    }
  },
  decisions: [
    {
      id: "uuid",
      timestamp: "2026-06-10T14:32:00Z",
      agent_type: "support_agent",
      coach_id: 1,
      groq_recommendation: "email",
      groq_confidence: 0.78,
      final_action: "email",
      override_reason: null,
      overridden: false,
      coach_pattern: "procrastinator",
      metadata: { ... }
    },
    // ... more
  ]
}
```

---

**Endpoint 3: GET /api/admin/coach-patterns**

Returns aggregate patterns with 7-day detection counts and intervention effectiveness.

```javascript
// Response
{
  patterns: {
    procrastinator: {
      coaches: [1, 2, 5],
      detections: 8
    },
    fast_track: {
      coaches: [3, 7],
      detections: 4
    },
    steady: {
      coaches: [4, 6, 8, 9],
      detections: 12
    },
    inconsistent: {
      coaches: [10],
      detections: 2
    }
  },
  intervention_effectiveness: [
    {
      coach_id: 1,
      final_action: "email",
      total: 3,
      executed: 2
    },
    // ... more
  ]
}
```

---

**Endpoint 4: GET /api/admin/coach-patterns/{pattern}/coaches**

Returns list of coaches in pattern + summary metrics.

```javascript
// URL: /api/admin/coach-patterns/procrastinator/coaches

// Response
{
  pattern: "procrastinator",
  coaches: [
    {
      coach_id: 1,
      name: "Sarah",
      detections_7d: 3,
      recent_tasks: { overdue: 2, on_time: 1 },
      last_intervention: {
        action: "email",
        timestamp: "2026-06-08T10:00:00Z",
        was_effective: false
      }
    },
    // ... more
  ],
  total_coaches: 8
}
```

---

**Endpoint 5: GET /api/admin/coach-patterns/{pattern}/decisions?days=7**

Returns all decisions for coaches in pattern.

```javascript
// URL: /api/admin/coach-patterns/procrastinator/decisions?days=7

// Response
{
  pattern: "procrastinator",
  coaches_in_pattern: [1, 2, 5],
  decisions: [
    {
      id: "uuid",
      timestamp: "2026-06-10T14:32:00Z",
      coach_id: 1,
      coach_name: "Sarah",
      groq_recommendation: "escalate",
      groq_confidence: 0.78,
      final_action: "email",
      task_status: "completed_on_time",
      overridden: false
    },
    // ... more
  ],
  total: 47
}
```

---

**Endpoint 6: GET /api/admin/coach-patterns/{pattern}/effectiveness**

Returns intervention success rates for pattern.

```javascript
// URL: /api/admin/coach-patterns/procrastinator/effectiveness

// Response
{
  pattern: "procrastinator",
  interventions: [
    {
      action: "email",
      total_attempts: 4,
      successful: 2,
      success_rate: 0.50
    },
    {
      action: "tag",
      total_attempts: 5,
      successful: 3,
      success_rate: 0.60
    },
    {
      action: "escalation",
      total_attempts: 3,
      successful: 3,
      success_rate: 1.00
    }
  ],
  recommended_action: "escalation"
}
```

---

## 4. Database Schema

### New Table: agent_runs

Tracks when each agent executes and its results.

```sql
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type VARCHAR NOT NULL,
    -- 'monitoring', 'support', 'reporting'
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR DEFAULT 'pending',
    -- 'pending', 'running', 'success', 'failed'
  
  -- Monitoring Agent metrics
  snapshots_created INT,
  coaches_at_risk INT,
  
  -- Support Agent metrics
  actions_taken INT,
  emails_sent INT,
  tags_created INT,
  escalations INT,
  
  -- Reporting Agent metrics
  report_generated BOOLEAN,
  insights_count INT,
  
  metadata JSONB
);

CREATE INDEX idx_agent_runs_type ON agent_runs(agent_type);
CREATE INDEX idx_agent_runs_timestamp ON agent_runs(timestamp DESC);
```

### Modified Table: daily_reports

Add columns to track AI insights.

```sql
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS insights JSONB;
  -- Stores full AI insights object
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS generated_by VARCHAR DEFAULT 'rules-based';
  -- 'groq-ai' or 'rules-based'
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);
  -- 0.00 to 1.00
```

---

## 5. Testing Strategy

**Total: 48 tests**

### Backend Tests (28)

**GroqService Enhancements (10 tests):**
- Reporting insights generation with valid context
- Groq timeout (15s) returns fallback
- Invalid JSON response handled gracefully
- Fallback insights structure correct
- Confidence score 0.0 for fallback
- Multiple coach patterns in context
- Empty actions_24h handled
- Team insights extraction
- Edge cases (missing metadata)
- Rate limiting (queue depth tracking)

**Reporting Agent Enhancements (8 tests):**
- AI insights integrated into daily digest
- HTML template includes all insight sections
- Confidence badge displays correctly (groq vs fallback)
- Log to daily_reports with metadata
- Timestamp and generated_by set correctly
- Coach analysis table formatted correctly
- Recommendations section renders
- Full workflow: input → insights → HTML → email → archive

**Admin API Endpoints (10 tests):**
- GET /api/admin/agent-status returns latest runs
- GET /api/admin/decisions filters by hours and coach_id
- GET /api/admin/decisions pagination (limit 100)
- GET /api/admin/coach-patterns groups by pattern
- GET /api/admin/coach-patterns/{pattern}/coaches returns list
- GET /api/admin/coach-patterns/{pattern}/decisions filters by days
- GET /api/admin/coach-patterns/{pattern}/effectiveness calculates success rates
- All endpoints require requireAdmin (403 for coach role)
- All endpoints return correct JSON structure
- Error handling (invalid pattern, no data)

### Frontend Tests (20)

**AgentDashboard Component (10 tests):**
- Renders 3 status cards (Monitoring, Support, Reporting)
- Renders Groq queue status with color coding
- Renders decision analytics (quality stats)
- Renders coach patterns aggregate (clickable)
- Renders recent decisions table (20 rows)
- 30-second poll interval working
- Loading state while fetching
- Error state displays gracefully
- Timestamp formatting (human-readable)
- Empty data handles gracefully

**Drill-Down Modal (10 tests):**
- Opens on coach pattern click
- Displays pattern name and coach count in header
- Lists all coaches in pattern with metrics
- Shows decisions table for pattern
- Shows intervention effectiveness summary
- Close button works (dismisses modal)
- Coaches list formatted correctly (name, detections, recent tasks)
- Decisions sortable (or display in correct order)
- Effectiveness bar chart renders
- Recommended action displays

---

## 6. Implementation Tasks

| Task | Hours | Description |
|------|-------|-------------|
| 1. GroqService enhancements | 2 | New `generateReportingInsights()` + fallback + error handling |
| 2. Reporting Agent integration | 2 | Wire AI insights into digest, update schema, 8 tests |
| 3. Admin API endpoints | 3 | 6 endpoints + 10 tests + permission checks |
| 4. Dashboard aggregate view | 2.5 | AgentDashboard component + sub-components + styling |
| 5. Drill-down modal (full) | 2.5 | Modal + coaches list + decisions + effectiveness + 10 tests |
| 6. Testing (RED-GREEN-REFACTOR) | 3 | 48 tests across all components |
| 7. Integration + deploy | 1 | E2E workflow, Railway deployment, health check |
| **Total** | **16** | **~2-3 days** |

---

## 7. Deployment Checklist

- [ ] All 48 tests passing locally
- [ ] No security vulnerabilities (admin-only APIs verified)
- [ ] Database migrations applied (agent_runs + daily_reports columns)
- [ ] No environment variables needed (Groq API already set)
- [ ] Frontend builds without errors (`npm run build`)
- [ ] Railway deployment successful (`railway up`)
- [ ] Health check responds (200 OK)
- [ ] Agent Dashboard accessible at `/admin/agent-dashboard`
- [ ] Drill-down modal opens on pattern click
- [ ] 30-second poll working (network tab shows requests)

---

## 8. Success Criteria

✅ Reporting Agent generates AI-powered insights (not rules-based generic messages)  
✅ Admin Dashboard displays real-time agent status + decision analytics  
✅ Coach patterns visible with full drill-down (coaches, decisions, effectiveness)  
✅ Groq queue status monitored (color-coded alerts)  
✅ Decision table shows Groq recommendations vs actual actions  
✅ 48+ tests passing (100% success rate)  
✅ Zero breaking changes to existing features (Phases 0-9b unaffected)  
✅ Deployed to Railway production  

---

## 9. Future Enhancements (Phase 9c+)

- Individual coach drill-down (click coach name → full decision history)
- Groq confidence trend chart (over time)
- Automated alerts (queue depth >50, confidence <0.7)
- Export decisions to CSV for analysis
- Webhooks on high-override situations

---

**Status:** Design approved, ready for implementation planning.  
**Next Step:** Invoke `writing-plans` skill to create detailed implementation plan.

