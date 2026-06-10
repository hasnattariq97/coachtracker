---
phase: "9c"
status: "design"
owner: "planning"
last_updated: "2026-06-10T00:00:00Z"
beads: []
---

# Phase 9c Design: Reporting Agent + Admin Dashboard (Focused Scope)

**Date:** 2026-06-10  
**Status:** Design Phase  
**Scope:** 2 components, ~10 hours, 1-2 days implementation  
**Dependencies:** Phase 9 (agents operational) + Phase 9b (decision logging + Groq)

---

## Executive Summary

Phase 9c adds **AI-powered reporting** and **agent visibility** to the coaching system:

1. **Reporting Agent Enhancement** — Groq-powered daily digest with smart recommendations
2. **Admin Dashboard** — Real-time view of agent decisions and coach patterns

No ML/predictive models; focus on visibility + AI-enhanced recommendations.

---

## 1. Reporting Agent Enhancement

### Current Behavior (Phase 9)

The Reporting Agent (runs daily 9am UTC):
1. Reads `support_actions` from last 24 hours
2. Analyzes coach patterns (fast-track, procrastinator, steady, inconsistent)
3. Counts interventions (emails, tags, escalations)
4. Generates HTML digest email to admin
5. Archives to `daily_reports` table

### Phase 9c Enhancement

Replace step 3-4 with Groq-powered analysis:

```
Step 3: Call GroqService to analyze 24-hour data
Input:
  - support_actions (20-50 items from last 24h)
  - coach_patterns (detected from snapshots)
  - intervention_counts (emails sent, tags, escalations)
  - on_time_metrics (% completion by deadline)

GroqService.generateReportingInsights() returns:
  - key_insights: ["Sarah trending toward procrastination", "Team email interventions work 85%", ...]
  - recommendations: ["Consider escalation for Sarah next", "John responds to deadline pressure", ...]
  - coach_analysis: {
      coach_id: 1,
      name: "Sarah",
      pattern: "procrastinator",
      recent_performance: "2 late tasks in last 7 days",
      suggested_approach: "Escalation more effective than email"
    }
  - team_insights: [...]
  - confidence: 0.88
```

Step 4: Build HTML digest with AI insights instead of rules

### Implementation Details

**File:** `server/agents/reporting-agent.js`

**New Method:** `generateAIInsights(actionData, coachPatterns, metrics)`

```javascript
async generateAIInsights(actionData, coachPatterns, metrics) {
  const groqService = new GroqService();
  
  const context = {
    actions_24h: actionData.length,
    emails_sent: metrics.emails,
    tags_created: metrics.tags,
    escalations: metrics.escalations,
    coaches_affected: actionData.map(a => a.coach_id).length,
    on_time_rate: metrics.onTimeRate,
    coach_patterns: coachPatterns
  };
  
  const insights = await groqService.generateReportingInsights(context);
  
  return {
    key_insights: insights.key_insights,
    recommendations: insights.recommendations,
    coach_analysis: insights.coach_analysis,
    team_insights: insights.team_insights,
    confidence: insights.confidence,
    generated_at: new Date().toISOString()
  };
}
```

**GroqService Enhancement:**

Add new method to `server/services/groq-service.js`:

```javascript
async generateReportingInsights(context) {
  // Input: { actions_24h, emails_sent, tags_created, escalations, coaches_affected, on_time_rate, coach_patterns }
  // Output: { key_insights, recommendations, coach_analysis, team_insights, confidence }
  
  const systemPrompt = `You are a coaching analytics expert. Analyze 24-hour coaching data and generate actionable insights for the admin team.
Return ONLY valid JSON with:
- key_insights: ["insight1", "insight2", ...] (3-5 brief insights, max 100 chars each)
- recommendations: ["rec1", "rec2", ...] (3-5 actionable recommendations)
- coach_analysis: [{ coach_id, name, pattern, recent_performance, suggested_approach }, ...] (top 3 coaches by activity)
- team_insights: { on_time_trend, most_effective_intervention, emerging_patterns } (team-level observations)
- confidence: 0.0-1.0 (how confident in these insights)`;
  
  try {
    const response = await Promise.race([
      this.client.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: `${systemPrompt}\n\nData:\n${JSON.stringify(context)}` }]
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Groq timeout')), 15000)
      )
    ]);
    
    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed;
  } catch (err) {
    console.error('[GroqService] generateReportingInsights error:', err.message);
    return this._getFallbackReportingInsights(context);
  }
}

_getFallbackReportingInsights(context) {
  return {
    key_insights: [
      `Processed ${context.actions_24h} coaching actions (${context.emails_sent} emails, ${context.tags_created} tags, ${context.escalations} escalations)`,
      `On-time completion rate: ${Math.round(context.on_time_rate * 100)}%`,
      `Coached ${context.coaches_affected} coaches with focus on ${context.coach_patterns[0] || 'mixed patterns'}`
    ],
    recommendations: [
      'Continue monitoring at-risk coaches daily',
      'Review intervention effectiveness by coach pattern',
      'Consider pattern-specific strategies for next week'
    ],
    coach_analysis: context.coach_patterns.slice(0, 3).map(p => ({
      pattern: p,
      suggested_approach: p === 'procrastinator' ? 'Escalation' : 'Email support'
    })),
    team_insights: {
      on_time_trend: 'Stable',
      most_effective_intervention: 'Escalation for procrastinators',
      emerging_patterns: 'Monitored'
    },
    confidence: 0.5
  };
}
```

**Reporting Agent Integration:**

Modify `analyzeAndReport()` to use AI insights:

```javascript
async analyzeAndReport(actionData, coachPatterns, metrics) {
  // ... existing code ...
  
  // NEW: Get AI insights
  const aiInsights = await this.generateAIInsights(actionData, coachPatterns, metrics);
  
  // Update HTML template to include:
  // - Key insights section
  // - Coach-specific analysis
  // - Team recommendations
  // - Confidence score
  
  const htmlDigest = buildHTMLDigest({
    timestamp: new Date(),
    summary: metrics,
    aiInsights: aiInsights,
    actionDetails: actionData,
    metadata: { confidence: aiInsights.confidence, generated_by: 'Groq AI' }
  });
  
  // Send via email (existing Phase 8 email system)
  await sendReportingEmail(adminEmail, htmlDigest);
  
  // Archive to daily_reports (existing)
  await db.query(
    `INSERT INTO daily_reports (timestamp, report_data, insights, generated_by)
     VALUES ($1, $2, $3, $4)`,
    [new Date(), JSON.stringify(metrics), JSON.stringify(aiInsights), 'groq-ai']
  );
}
```

### Database Changes

**New columns for daily_reports table:**

```sql
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS generated_by VARCHAR DEFAULT 'rules-based';
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS insights JSONB;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);
```

### Testing

Create `server/__tests__/agents/reporting-agent-phase9c.test.js`:

**Tests:**
- `generateAIInsights returns structured data` (5 tests)
- `Groq timeout returns fallback insights` (2 tests)
- `Report includes AI insights in HTML` (3 tests)
- `Insights logged to daily_reports table` (2 tests)
- `Team insights extracted correctly` (2 tests)
- `Confidence score indicates AI vs fallback` (1 test)

**Total:** 15 tests

---

## 2. Admin Dashboard (Real-Time)

### Current State

Admin dashboard shows:
- Coaches list (KPIs, progress)
- Task board (status, timeline)
- Notifications (coaching insights, completion alerts)

**Missing:** Agent visibility and decision tracking

### Phase 9c Addition

New page: `/admin/agent-dashboard`

Shows:
1. **Agent Status** — Last run, items processed, queue depth
2. **Decision Analytics** — Groq recommendations vs actual actions
3. **Coach Patterns** — Detected behaviors, intervention effectiveness
4. **24-Hour Summary** — What agents did, what they decided

### Implementation

#### Backend: Agent Status API

**Endpoint:** `GET /api/admin/agent-status`

```javascript
router.get('/api/admin/agent-status', requireAdmin, async (req, res) => {
  try {
    // Get latest agent runs
    const monitoring = await db.query(
      `SELECT id, timestamp, snapshots_created, coaches_at_risk, status
       FROM agent_runs WHERE agent_type = 'monitoring'
       ORDER BY timestamp DESC LIMIT 1`
    );
    
    const support = await db.query(
      `SELECT id, timestamp, actions_taken, emails_sent, tags_created, escalations, status
       FROM agent_runs WHERE agent_type = 'support'
       ORDER BY timestamp DESC LIMIT 1`
    );
    
    const reporting = await db.query(
      `SELECT id, timestamp, report_generated, insights_count, status
       FROM agent_runs WHERE agent_type = 'reporting'
       ORDER BY timestamp DESC LIMIT 1`
    );
    
    // Queue depth
    const queueDepth = await db.query(
      `SELECT COUNT(*) as pending FROM groq_queue WHERE status = 'pending'`
    );
    
    res.json({
      monitoring: monitoring.rows[0] || null,
      support: support.rows[0] || null,
      reporting: reporting.rows[0] || null,
      groq_queue_pending: queueDepth.rows[0].pending,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Admin API] Agent status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch agent status' });
  }
});
```

#### Backend: Decision Analytics API

**Endpoint:** `GET /api/admin/decisions?hours=24&coach_id=optional`

```javascript
router.get('/api/admin/decisions', requireAdmin, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const coachId = req.query.coach_id ? parseInt(req.query.coach_id) : null;
    
    let query = `
      SELECT 
        id, timestamp, agent_type, coach_id,
        groq_recommendation, groq_confidence, final_action,
        override_reason, overridden, coach_pattern,
        metadata
      FROM agent_decisions
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
    `;
    
    const params = [];
    if (coachId) {
      query += ` AND coach_id = $${params.length + 1}`;
      params.push(coachId);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT 100`;
    
    const result = await db.query(query, params);
    
    // Summarize
    const summary = {
      total_decisions: result.rows.length,
      by_agent: {
        support_agent: result.rows.filter(r => r.agent_type === 'support_agent').length,
        coaching_insights: result.rows.filter(r => r.agent_type === 'coaching_insights').length
      },
      groq_vs_fallback: {
        groq_confidence_avg: (result.rows.reduce((s, r) => s + (r.groq_confidence || 0), 0) / result.rows.length).toFixed(2),
        fallback_count: result.rows.filter(r => r.groq_confidence === 0).length
      },
      overrides: {
        total: result.rows.filter(r => r.overridden).length,
        by_reason: {}
      }
    };
    
    // Count overrides by reason
    result.rows.forEach(r => {
      if (r.override_reason) {
        summary.overrides.by_reason[r.override_reason] = (summary.overrides.by_reason[r.override_reason] || 0) + 1;
      }
    });
    
    res.json({
      summary,
      decisions: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});
```

#### Backend: Coach Pattern Analytics API

**Endpoint:** `GET /api/admin/coach-patterns`

```javascript
router.get('/api/admin/coach-patterns', requireAdmin, async (req, res) => {
  try {
    // Get recent snapshots to analyze patterns
    const snapshots = await db.query(`
      SELECT DISTINCT coach_id, coach_pattern, COUNT(*) as detections
      FROM monitoring_snapshots
      WHERE timestamp > NOW() - INTERVAL '7 days'
      GROUP BY coach_id, coach_pattern
      ORDER BY coach_id, timestamp DESC
    `);
    
    // Get intervention effectiveness per coach
    const effectiveness = await db.query(`
      SELECT 
        coach_id,
        final_action,
        COUNT(*) as total,
        SUM(CASE WHEN overridden = false THEN 1 ELSE 0 END) as executed
      FROM agent_decisions
      WHERE timestamp > NOW() - INTERVAL '7 days'
      GROUP BY coach_id, final_action
    `);
    
    // Aggregate by pattern
    const byPattern = {};
    snapshots.rows.forEach(row => {
      const pattern = row.coach_pattern;
      if (!byPattern[pattern]) {
        byPattern[pattern] = { coaches: [], detections: 0 };
      }
      byPattern[pattern].coaches.push(row.coach_id);
      byPattern[pattern].detections += row.detections;
    });
    
    res.json({
      patterns: byPattern,
      intervention_effectiveness: effectiveness.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coach patterns' });
  }
});
```

#### Frontend: Admin Dashboard Component

**File:** `client/src/pages/admin/AgentDashboard.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Clock, Zap, TrendingUp, AlertCircle } from 'lucide-react';

export default function AgentDashboard() {
  const [agentStatus, setAgentStatus] = useState(null);
  const [decisions, setDecisions] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);
  
  const fetchData = async () => {
    try {
      const [statusRes, decisionsRes, patternsRes] = await Promise.all([
        fetch('/api/admin/agent-status'),
        fetch('/api/admin/decisions?hours=24'),
        fetch('/api/admin/coach-patterns')
      ]);
      
      setAgentStatus(await statusRes.json());
      setDecisions(await decisionsRes.json());
      setPatterns(await patternsRes.json());
    } catch (err) {
      console.error('Failed to fetch agent data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div className="p-8">Loading agent dashboard...</div>;
  
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Agent Dashboard</h1>
        <p className="text-gray-600">Real-time view of autonomous coaching agents</p>
      </div>
      
      {/* Agent Status Cards */}
      <div className="grid grid-cols-3 gap-6">
        <AgentStatusCard title="Monitoring" data={agentStatus?.monitoring} />
        <AgentStatusCard title="Support" data={agentStatus?.support} />
        <AgentStatusCard title="Reporting" data={agentStatus?.reporting} />
      </div>
      
      {/* Queue Status */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Groq Queue</h3>
            <p className="text-gray-600">{agentStatus?.groq_queue_pending || 0} pending requests</p>
          </div>
          <div className="text-3xl font-bold text-teal-600">{agentStatus?.groq_queue_pending || 0}</div>
        </div>
      </div>
      
      {/* Decision Analytics */}
      <div className="grid grid-cols-2 gap-6">
        <DecisionStats decisions={decisions?.summary} />
        <CoachPatterns patterns={patterns?.patterns} />
      </div>
      
      {/* Recent Decisions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Recent Agent Decisions (24h)</h3>
        </div>
        <DecisionsTable decisions={decisions?.decisions} />
      </div>
    </div>
  );
}

function AgentStatusCard({ title, data }) {
  if (!data) return <div className="bg-gray-100 p-6 rounded-lg text-gray-600">No data</div>;
  
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-teal-600" />
        {title}
      </h3>
      <div className="space-y-2 text-sm">
        <p><span className="text-gray-600">Last run:</span> {new Date(data.timestamp).toLocaleTimeString()}</p>
        <p><span className="text-gray-600">Status:</span> <span className="text-green-600 font-semibold">{data.status || 'Complete'}</span></p>
        {data.snapshots_created && <p><span className="text-gray-600">Snapshots:</span> {data.snapshots_created}</p>}
        {data.actions_taken && <p><span className="text-gray-600">Actions:</span> {data.actions_taken}</p>}
      </div>
    </div>
  );
}

function DecisionStats({ decisions }) {
  if (!decisions) return null;
  
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-teal-600" />
        Decision Quality
      </h3>
      <div className="space-y-4">
        <div>
          <p className="text-gray-600 text-sm">Total Decisions (24h)</p>
          <p className="text-2xl font-bold text-teal-600">{decisions.total_decisions}</p>
        </div>
        <div>
          <p className="text-gray-600 text-sm">Avg. Groq Confidence</p>
          <p className="text-2xl font-bold">{decisions.groq_vs_fallback.groq_confidence_avg}</p>
        </div>
        <div>
          <p className="text-gray-600 text-sm">Fallback Decisions</p>
          <p className="text-lg font-semibold text-amber-600">{decisions.groq_vs_fallback.fallback_count}</p>
        </div>
      </div>
    </div>
  );
}

function CoachPatterns({ patterns }) {
  if (!patterns) return null;
  
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-teal-600" />
        Coach Patterns (7d)
      </h3>
      <div className="space-y-2">
        {Object.entries(patterns).map(([pattern, data]) => (
          <div key={pattern} className="flex justify-between items-center">
            <span className="text-sm text-gray-700 capitalize">{pattern}</span>
            <span className="text-sm font-semibold text-teal-600">{data.detections} detections</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionsTable({ decisions }) {
  if (!decisions?.length) return <div className="p-6 text-gray-600 text-center">No decisions yet</div>;
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Time</th>
            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Agent</th>
            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Coach</th>
            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Groq Rec.</th>
            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Actual</th>
            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {decisions.slice(0, 20).map(d => (
            <tr key={d.id} className={d.overridden ? 'bg-yellow-50' : ''}>
              <td className="px-6 py-3 text-gray-700">{new Date(d.timestamp).toLocaleTimeString()}</td>
              <td className="px-6 py-3 text-gray-700 capitalize">{d.agent_type.replace('_', ' ')}</td>
              <td className="px-6 py-3 text-gray-700">Coach {d.coach_id}</td>
              <td className="px-6 py-3 text-gray-700 capitalize font-mono text-xs">{d.groq_recommendation || '—'}</td>
              <td className="px-6 py-3 text-gray-700 capitalize font-mono text-xs font-semibold">{d.final_action || '—'}</td>
              <td className="px-6 py-3">
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                  d.groq_confidence > 0.8 ? 'bg-green-100 text-green-800' :
                  d.groq_confidence > 0.5 ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {(d.groq_confidence * 100).toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### Frontend: Navigation

Update `client/src/components/Navigation.jsx` to add link:

```jsx
{user?.role === 'admin' && (
  <>
    <Link to="/admin/coaches" className="...">Coaches</Link>
    <Link to="/admin/tasks" className="...">Tasks</Link>
    <Link to="/admin/agent-dashboard" className="...">Agent Dashboard</Link> {/* NEW */}
  </>
)}
```

### Database Schema

**New table: agent_runs** (optional, for tracking runs)

```sql
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type VARCHAR NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR DEFAULT 'pending',
  
  -- Monitoring metrics
  snapshots_created INT,
  coaches_at_risk INT,
  
  -- Support metrics
  actions_taken INT,
  emails_sent INT,
  tags_created INT,
  escalations INT,
  
  -- Reporting metrics
  report_generated BOOLEAN,
  insights_count INT,
  
  metadata JSONB
);

CREATE INDEX idx_agent_runs_type ON agent_runs(agent_type);
CREATE INDEX idx_agent_runs_timestamp ON agent_runs(timestamp);
```

### Testing

Create `server/__tests__/api/admin-dashboard.test.js`:

**Tests:**
- `GET /api/admin/agent-status returns latest runs` (3 tests)
- `GET /api/admin/decisions filters by time and coach` (4 tests)
- `GET /api/admin/coach-patterns groups by pattern` (2 tests)
- `Dashboard updates every 30 seconds` (1 test)

Create `client/src/__tests__/AdminDashboard.test.js`:

**Tests:**
- `Renders agent status cards` (2 tests)
- `Displays decision table with overrides highlighted` (2 tests)
- `Refreshes data on 30s interval` (1 test)
- `Shows pattern distribution` (2 tests)

**Total:** 17 tests

---

## Implementation Tasks

### Phase 9c Tasks (In Order)

**Task 1: GroqService Enhancement (2 hours)**
- [ ] Add `generateReportingInsights()` method to GroqService
- [ ] Add `_getFallbackReportingInsights()` fallback
- [ ] Write 8 GroqService tests
- [ ] Commit

**Task 2: Reporting Agent Enhancement (2 hours)**
- [ ] Add `generateAIInsights()` method to Reporting Agent
- [ ] Integrate AI insights into daily digest HTML
- [ ] Update database schema (new columns for daily_reports)
- [ ] Write 7 Reporting Agent tests
- [ ] Commit

**Task 3: Admin API Endpoints (2 hours)**
- [ ] Create `GET /api/admin/agent-status` endpoint
- [ ] Create `GET /api/admin/decisions` endpoint
- [ ] Create `GET /api/admin/coach-patterns` endpoint
- [ ] Write 9 API tests
- [ ] Commit

**Task 4: Admin Dashboard Frontend (3 hours)**
- [ ] Create AgentDashboard.jsx component
- [ ] Create sub-components (StatusCard, DecisionStats, DecisionsTable)
- [ ] Add routing in App.jsx
- [ ] Update navigation menu
- [ ] Write 8 frontend tests
- [ ] Commit

**Task 5: Integration + Polish (1 hour)**
- [ ] Integration tests (full workflow)
- [ ] Update ROADMAP with Phase 9c completion
- [ ] Deploy to Railway
- [ ] Commit

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  Phase 9c Architecture                   │
└─────────────────────────────────────────────────────────┘

REPORTING AGENT (Daily 9am):
  support_actions (24h) → GroqService.generateReportingInsights()
  coach_patterns    ↗    ↓ ↘ (fallback if timeout/error)
  metrics          ┘     HTML Digest Email
                         Archive to daily_reports
                         New: { insights, ai_confidence }

ADMIN DASHBOARD (Real-time, 30s refresh):
  API Tier:
  ├─ GET /api/admin/agent-status
  │  └─ agent_runs table (latest monitoring/support/reporting)
  ├─ GET /api/admin/decisions?hours=24&coach_id=X
  │  └─ agent_decisions table (filtered, summarized)
  └─ GET /api/admin/coach-patterns
     └─ monitoring_snapshots + agent_decisions (aggregated)
  
  Frontend (React Component):
  ├─ Agent Status Cards (3 columns)
  ├─ Groq Queue Status
  ├─ Decision Statistics
  ├─ Coach Patterns Distribution
  └─ Recent Decisions Table (20 rows, 24h window)
```

---

## Testing Strategy

**Total Tests:** 35
- GroqService: 8
- Reporting Agent: 7  
- Admin API: 9
- Dashboard Component: 8
- Integration: 3

**RED-GREEN-REFACTOR Pattern:**
1. Write tests first (RED)
2. Implement code (GREEN)
3. Refactor for clarity (REFACTOR)

---

## Deployment Checklist

- [ ] All tests passing locally
- [ ] No security vulnerabilities (API permissions checked)
- [ ] Database migrations applied
- [ ] Environment variables set (none needed for Phase 9c)
- [ ] Frontend builds without errors
- [ ] Railway deployment successful
- [ ] Health check responds (200 OK)
- [ ] Agent Dashboard accessible at `/admin/agent-dashboard`

---

## Success Criteria

- ✅ Reporting Agent generates AI-powered insights daily
- ✅ Admin Dashboard displays real-time agent status
- ✅ Decision analytics show Groq recommendations vs actual actions
- ✅ Coach patterns visible and tracked
- ✅ 35+ tests passing (100%)
- ✅ Deployed to Railway production
- ✅ Zero breaking changes to existing features

---

## Timeline

| Task | Hours | Status |
|------|-------|--------|
| Task 1: GroqService | 2 | Pending |
| Task 2: Reporting Agent | 2 | Pending |
| Task 3: Admin API | 2 | Pending |
| Task 4: Dashboard UI | 3 | Pending |
| Task 5: Integration + Deploy | 1 | Pending |
| **Total** | **10** | **~1-2 days** |

---

## Optional Enhancements (Future)

- Drill-down: Click a coach in patterns → see their full decision history
- Groq Confidence chart: Trend over time
- Automated alerts: Queue depth > 50, Groq confidence < 0.7
- Export: Download decision CSV for analysis
- Webhooks: Send notifications on high-override situations

---

**Status:** Design Complete ✅  
**Next Step:** Implementation (Task 1 - GroqService Enhancement)
