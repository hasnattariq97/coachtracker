---
phase: "9b"
status: "design"
owner: "brainstorming-session"
last_updated: "2026-06-09T00:00:00Z"
beads: []
---

# Phase 9b Design: Groq-Powered Coaching Intelligence

**Date:** 2026-06-09  
**Status:** Design Complete, Ready for Implementation  
**Scope:** 20-22 hours / 3-4 days  
**Deferral:** Reporting Agent enhancements → Phase 9c

---

## Executive Summary

Phase 9b transforms the autonomous coaching system from **rule-based → AI-intelligent**. It adds Groq API integration to Support Agent decision-making and enhances coaching insights with richer context, adaptive tone, and predictive advice. This enables the system to make **context-aware, personalized coaching decisions** instead of following fixed rules.

**Key additions:**
- Central `GroqService` for rate-limited Groq calls (respects 30 RPM)
- Support Agent uses Groq to intelligently choose interventions (email/tag/escalate)
- Coaching Insights enhanced with 3 layers: richer context, adaptive tone, predictive insights
- Decision logging tracks Groq recommendations vs actual outcomes for learning
- 90+ tests (95% mocked, 2-3 real integration tests)

---

## Problem Statement

**Phase 9 (current):** Autonomous agents detect at-risk/overdue tasks and intervene, but follow deterministic rules.

```javascript
// Current logic (too simple):
if (status === 'overdue' && coach_pattern === 'procrastinator') {
  action = 'escalate';  // Always escalate, regardless of context
}
```

**Problems:**
1. **One-size-fits-all:** Same intervention for all procrastinators, ignoring individual response styles
2. **No learning:** Decisions don't improve over time; no data on what actually works
3. **Generic coaching:** Coaching insights are meaningful but could be more predictive
4. **No context:** Doesn't consider recent blocker patterns, intervention history, or trend direction

**Phase 9b solution:** Use Groq API to analyze coach behavior and recommend context-aware interventions.

```javascript
// Phase 9b logic (intelligent):
const groqAdvice = await groqService.analyzeCoachForIntervention(snapshot, history);
// Returns: { recommendation: 'email', reasoning: "This coach responds well to support..." }
```

---

## Design Decisions

### Decision 1: Groq Integration Approach

**Chosen:** Separate `GroqService` wrapper (clean isolation)

**Rationale:**
- Both Support Agent and Coaching Insights need Groq calls
- Single service manages queue and rate limiting globally
- Easy to mock for testing
- Easy to swap Groq provider later if needed

**Alternative rejected:** Integrated Groq calls in each agent (would duplicate queue logic)

---

### Decision 2: Rate Limiting Strategy

**Chosen:** Queue + process at ~25 requests/minute (safely under 30 RPM)

**Rationale:**
- Free Groq tier: 30 RPM limit
- Queue prevents rate-limit errors
- Async processing (doesn't block coaches/tasks)
- Current scale (5-20 coaches/cycle) never hits limits

**Trade-off:** Slight async delay (queued decisions processed in background), but acceptable since cycles run every 30 min

---

### Decision 3: Groq + Fatigue Rules

**Chosen:** Groq suggests, fatigue rules enforce (can override Groq)

**Rationale:**
- Groq might recommend emailing the same coach twice in 1 hour
- Fatigue rules prevent message spam (30-min tag window, 4-hour email window)
- Fatigue rules are hard limits: coaches get support without being overwhelmed

**Example:**
```
Groq recommends: "email"
Fatigue rule says: "Already emailed 2 hours ago (need 4 hours)"
Result: Action = null (skip), logged as override
```

---

### Decision 4: Decision Logging

**Chosen:** Log all Groq recommendations + overrides to `agent_decisions` table

**Rationale:**
- Build learning data: which interventions work best for which patterns
- Audit trail for coaching decisions
- Detect if fatigue rules are too aggressive
- Foundation for Phase 9c improvements

**Captured data:**
- What Groq recommended
- What actually happened
- Why we changed it (fatigue, timeout, etc.)
- Coach pattern + task status for context

---

### Decision 5: Testing Strategy

**Chosen:** 95% mocked unit tests + 2-3 real integration tests

**Rationale:**
- Mocked tests are fast (no API calls, no quota pressure)
- Real integration tests on staging verify end-to-end flow
- Never burn Groq quota during normal testing
- 90+ tests total, 100% pass rate

**Test distribution:**
- 70+ unit tests (all mocked)
- 15+ integration tests (mocked)
- 2-3 real Groq integration tests (staging only)

---

### Decision 6: Scope: Include Coaching Insights Enhancements?

**Chosen:** Yes, enhance Phase 7 coaching insights

**Rationale:**
- Natural extension of GroqService
- Makes coaching messages more valuable
- Same framework (Groq-powered enhancements)
- Deferred Reporting Agent → Phase 9c (cleaner scope)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Phase 9b Architecture                    │
└─────────────────────────────────────────────────────────────┘

                    GroqService (NEW)
                    ├── queueRequest()
                    ├── analyzeCoachForIntervention()
                    ├── enhanceCoachingInsight()
                    ├── _processQueue()            (async)
                    └── _callGroqAPI()             (with timeout)
                           ↑              ↑
                           │              │
                    ┌──────┴──────┬───────┴──────┐
                    │             │              │
            Support Agent      Coaching      agent_decisions
            (ENHANCED)         Insights      (NEW TABLE)
                              (ENHANCED)


FLOWS:

1. Support Agent Decision Flow:
   - Monitoring Agent creates snapshot
   - Support Agent reads snapshot
   - Calls: GroqService.analyzeCoachForIntervention()
   - GroqService queues request
   - Queue processor calls Groq API (~25 req/min)
   - Support Agent receives response
   - Applies fatigue rules (can override Groq)
   - Executes final action (email/tag/escalate)
   - Logs decision to agent_decisions table

2. Coaching Insights Enhancement Flow:
   - Coach completes task or submits delay reason
   - Calls: queueCoachingInsights() (existing Phase 7)
   - Now ALSO calls: GroqService.enhanceCoachingInsight()
   - GroqService queues request
   - Groq generates enhanced message (context + tone + prediction)
   - Creates notification with enhanced metadata
   - Logs to agent_decisions table
```

---

## Component Specifications

### 1. GroqService (`server/services/groq-service.js`)

**Responsibility:** Centralized Groq API wrapper with queue management

**Public API:**

```javascript
class GroqService {
  // Queue a Groq request (returns immediately)
  async queueRequest(requestType, payload)
    // Returns: { requestId, status: 'queued' }
  
  // Get Groq recommendation for intervention
  async analyzeCoachForIntervention(snapshot, coachHistory)
    // Input:
    //   - snapshot: { task_id, coach_id, status, coach_pattern, ... }
    //   - coachHistory: last 10 tasks for this coach
    // Returns: {
    //   recommendation: 'email' | 'tag' | 'escalate',
    //   confidence: 0.0-1.0,
    //   reasoning: "string explaining why",
    //   fallbackRule: 'email' (Phase 9 rule-based decision if Groq fails)
    // }
    // 
    // Fallback logic: If Groq times out or rate-limited, use Phase 9 rules:
    //   - if status='overdue' && coach_pattern='procrastinator': 'escalate'
    //   - if status='overdue': 'email'
    //   - if status='at_risk' && blockers detected: 'tag'
    //   - otherwise: null (no action)
  
  // Enhance coaching insight with context + tone + predictions
  async enhanceCoachingInsight(coachHistory, task, eventType)
    // Input:
    //   - coachHistory: last 20 tasks for this coach
    //   - task: current task details
    //   - eventType: 'completion' | 'delay'
    // Returns: {
    //   message: "personalized coaching message with specifics",
    //   tone: 'encouraging' | 'neutral' | 'urgent',
    //   metrics: ['on_time_rate: 80%', 'streak: 4 tasks'],
    //   prediction: "You're trending toward delays on complex tasks",
    //   confidence: 0.88
    // }
}
```

**Implementation details:**
- Queue stored in PostgreSQL `groq_queue` table (no Redis dependency)
- `_processQueue()` runs as cron job every 2 minutes, dequeues ~5 items per run (~25/min)
- Timeout: 10s per Groq call (return fallback if exceeded)
- Handles rate-limit errors gracefully (log and retry next cycle)
- Uses `status` field to track: pending → processing → completed/failed

---

### 2. Support Agent Modifications

**Current behavior:** Fixed decision tree based on status + pattern

**Phase 9b behavior:**

```javascript
async _decideIntervention(snapshot) {
  // 1. Get Groq recommendation
  const groqAdvice = await groqService.analyzeCoachForIntervention(
    snapshot,
    await fetchCoachHistory(snapshot.coach_id, 10)
  );
  
  let action = groqAdvice.recommendation;
  let reasoning = groqAdvice.reasoning;
  
  // 2. Apply fatigue rules (can override Groq)
  if (action === 'tag') {
    if (await hasRecentTag(snapshot.task_id, 30)) {
      action = null;
      reasoning += ' [Fatigue: skip tag]';
    }
  }
  
  if (action === 'email') {
    if (await hasRecentEmail(snapshot.coach_id, 240)) {
      action = null;
      reasoning += ' [Fatigue: skip email]';
    }
  }
  
  // 3. Log decision
  await logDecision({
    agentType: 'support_agent',
    coachId: snapshot.coach_id,
    taskId: snapshot.task_id,
    groqRecommendation: groqAdvice.recommendation,
    groqConfidence: groqAdvice.confidence,
    finalAction: action,
    fatigueOverridden: action !== groqAdvice.recommendation
  });
  
  return { taskId: snapshot.task_id, action, reasoning };
}
```

**Key change:** Replace hardcoded if/else tree with Groq call

---

### 3. Coaching Insights Enhancement

**Current (Phase 7):** 3-agent swarm generates message like:
```
"You crushed this deadline. That execution matters."
```

**Phase 9b:** Same entry point, but enhanced behind the scenes:

```javascript
async function analyzeCoachBehavior(coachId, taskId, eventType, coachHistory, task) {
  // Step 1: Phase 7 logic (still runs)
  const swarmResults = await callAgentSwarm(coachHistory, task, eventType);
  
  // Step 2: NEW - Call Groq for enhancement
  const enhanced = await groqService.enhanceCoachingInsight(
    coachHistory,
    task,
    eventType
  );
  
  // Step 3: Use enhanced message
  const metadata = {
    swarmAnalysis: swarmResults,
    enhancedInsight: enhanced,
    tone: enhanced.tone,
    metrics: enhanced.metrics,
    prediction: enhanced.prediction
  };
  
  createCoachingInsightNotification(coachId, taskId, enhanced.message, metadata);
  
  // Step 4: Log
  await logDecision({
    agentType: 'coaching_insights',
    coachId,
    taskId,
    groqRecommendation: 'message',
    finalAction: 'notification_created'
  });
}
```

**Result:** Coach sees richer messages with specific context and predictions:
```
"You've hit 4 of 5 recent deadlines. When you focus, you deliver.
You're trending toward delays on high-priority tasks—consider breaking
them into smaller chunks next time."
```

---

### 4. Decision Logging

**New table: `agent_decisions`**

```sql
CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  agent_type VARCHAR NOT NULL,        -- 'support_agent' | 'coaching_insights'
  coach_id INT NOT NULL,
  task_id INT NOT NULL,
  
  -- Groq recommendation
  groq_recommendation VARCHAR,        -- 'email'|'tag'|'escalate'|'message'
  groq_confidence DECIMAL(3,2),       -- 0.0-1.0
  groq_reasoning TEXT,
  
  -- What actually happened
  final_action VARCHAR,               -- What we did
  override_reason VARCHAR,            -- Why we changed it (null if not overridden)
  overridden BOOLEAN,                 -- true if final_action != groq_recommendation
  
  -- Context for learning
  coach_pattern VARCHAR,              -- 'fast_track'|'procrastinator'|'steady'|'inconsistent'
  task_status VARCHAR,                -- 'overdue'|'at_risk'|'on_time'|'completed'
  
  metadata JSONB,                     -- Extra context
  
  FOREIGN KEY (coach_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_agent_decisions_coach ON agent_decisions(coach_id);
CREATE INDEX idx_agent_decisions_task ON agent_decisions(task_id);
CREATE INDEX idx_agent_decisions_agent ON agent_decisions(agent_type);
```

**Logged on every decision:**
- Support Agent picks intervention
- Coaching Insights generates message
- Any override (fatigue, timeout, etc.)

---

## Data Model

**New table:** `agent_decisions` (see above)

**Queue table (optional, if using DB instead of Redis):**
```sql
CREATE TABLE groq_queue (
  id UUID PRIMARY KEY,
  request_type VARCHAR,           -- 'support_intervention' | 'coaching_insight'
  payload JSONB,
  status VARCHAR,                 -- 'pending' | 'processing' | 'completed' | 'failed'
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  response JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0
);
```

---

## Testing Strategy

### Unit Tests (70+ tests, ALL MOCKED)

```javascript
describe('GroqService', () => {
  beforeEach(() => {
    jest.mock('../services/groq-service');
  });
  
  test('queueRequest adds to queue', async () => {
    // Assert: request added with status='queued'
  });
  
  test('analyzeCoachForIntervention returns recommendation', async () => {
    // Mock response, assert structure
  });
  
  test('timeout returns fallback rule', async () => {
    // Mock 10s timeout, assert fallback
  });
  
  test('rate limit error handled gracefully', async () => {
    // Mock 429 error, assert retry logic
  });
});

describe('SupportAgent', () => {
  test('calls GroqService and uses recommendation', async () => {
    // Mock groqService, assert decision
  });
  
  test('fatigue rule overrides Groq recommendation', async () => {
    // Groq says 'email', fatigue says skip
    // Assert: action = null
  });
  
  test('logs decision with override_reason', async () => {
    // Assert: agent_decisions table has entry
  });
});

describe('CoachingInsights', () => {
  test('enhances message with richer context', async () => {
    // Mock enhanceCoachingInsight
    // Assert: metrics and prediction included
  });
  
  test('logs to agent_decisions table', async () => {
    // Assert: logged with agentType='coaching_insights'
  });
});
```

### Integration Tests (15+ tests, MOSTLY MOCKED)

```javascript
describe('Phase 9b Integration', () => {
  test('Support Agent → GroqService → decision log', async () => {
    // Mock GroqService
    // Run full Support Agent cycle
    // Assert: decision_logged correctly
  });
});
```

### Real Groq Integration Tests (2-3 tests, STAGING ONLY)

```javascript
describe('Phase 9b Real Groq (Staging)', () => {
  test('Real Groq call: analyzeCoachForIntervention', async () => {
    // NO MOCK - actually call Groq
    // Assert: response has recommendation, confidence, reasoning
  });
  
  test('Real Groq call: enhanceCoachingInsight', async () => {
    // NO MOCK - actually call Groq
    // Assert: response has message, tone, metrics, prediction
  });
});
```

**Coverage target:**
- GroqService queue mechanism
- Support Agent decision logic + overrides
- Coaching Insights enhancements
- Decision logging accuracy
- Fallback behavior
- Rate limiting + timeout handling

---

## Implementation Plan

**Tasks (estimated 20-22 hours):**

| Task | Hours | Deliverable |
|------|-------|-------------|
| Task 1: GroqService | 4h | `server/services/groq-service.js` (250 lines) + 40 unit tests |
| Task 2: Support Agent | 5h | Modify `support-agent.js` (+80 lines) + 20 tests |
| Task 3: Coaching Insights | 5h | Modify `coaching-insights.js` (+50 lines) + 15 tests |
| Task 4: Decision Logging | 3h | Add `agent_decisions` table + logging code |
| Task 5: Testing | 5h | 70+ unit tests + 15 integration tests + 2-3 real Groq tests |
| Task 6: Docs + Deploy | 2h | Update ROADMAP, deploy to Railway |
| **Total** | **22h** | |

---

## Success Criteria

- [ ] GroqService implements queue with ~25 req/min processing (under 30 RPM)
- [ ] GroqService timeout handling (10s per call)
- [ ] Support Agent calls GroqService, applies fatigue rules
- [ ] Coaching Insights enhanced with richer context + adaptive tone + predictions
- [ ] Decision logging captures all Groq recommendations and overrides
- [ ] 90+ tests passing (95% mocked, 2-3 real integration tests)
- [ ] No API quota exceeded on Railway
- [ ] Graceful fallback if Groq unavailable (use rules instead)
- [ ] Live on production, coaches receiving enhanced support

---

## Files Changed/Created

**New:**
- `server/services/groq-service.js` (core service)
- `server/__tests__/groq-service.test.js` (40+ tests)
- `server/__tests__/integration/phase9b-integration.test.js` (20+ tests)
- `server/db/migrations/add-agent-decisions-table.sql` (schema)

**Modified:**
- `server/agents/support-agent.js` (+80 lines)
- `server/routes/coaching-insights.js` (+50 lines)
- `server/cron.js` (optional: queue processor cron job)
- `docs/ROADMAP.md` (Phase 9b status)

---

## Phase 9c Roadmap (Deferred)

- **Reporting Agent enhancements** — Use Groq to generate smarter daily digest recommendations
- **Performance anomaly detection** — ML to detect unusual coach behavior patterns
- **Predictive delay warnings** — Flag tasks likely to be late before they are
- **Admin dashboard** — Real-time view of agent status and recommendations

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Groq API quota (30 RPM) | Queue limits to ~25/min, graceful fallback if exceeded |
| Groq timeout (>10s) | Return rule-based fallback, log timeout |
| Rate-limit errors | Retry queue, exponential backoff |
| Groq API cost | Free tier (30 RPM, 6K TPM) sufficient for current scale |
| Decision quality | Validate outputs, test with real coaches on staging |
| Fatigue rules too strict | Log overrides, adjust windows in Phase 9c |

---

## Open Questions for Implementation

None. All decisions locked in via brainstorming.

---

**Design Status:** ✅ COMPLETE & APPROVED  
**Next Step:** Invoke `writing-plans` skill to create implementation plan  
**Target Deploy:** 2026-06-12 (3-4 days from start)
