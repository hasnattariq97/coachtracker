---
phase: "9"
status: "draft"
owner: "brainstorming"
last_updated: "2026-06-09T12:00:00Z"
beads: []
---

# Phase 9 Design: Autonomous Multi-Agent Coaching System

**Date:** June 9, 2026  
**Version:** 1.0 (Draft)  
**Architecture:** Ruflo Multi-Agent Orchestration  
**Status:** Ready for Implementation Planning

---

## Executive Summary

Phase 9 builds a **24/7 autonomous coaching system** using a Ruflo-orchestrated swarm of three specialized AI agents. The system monitors coaches proactively, provides real-time support (tagging in Google Sheets, sending emails), and delivers daily performance reports with pattern analysis—all without manual intervention.

**Key outcome:** Admin doesn't need to check the dashboard. Agents handle monitoring and coaching; admin receives actionable daily digests.

---

## 1. Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────┐
│            PHASE 9: AUTONOMOUS COACHING SYSTEM           │
│                 (Ruflo Orchestrator)                     │
│                                                         │
│  Triggered: Every 30 minutes via node-cron              │
│  Runtime: ~30-60 seconds per cycle                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         AGENT SWARM (Parallel Execution)         │  │
│  │                                                  │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │   MONITORING AGENT (Parallel)            │  │  │
│  │  │  • Reads all tasks from database         │  │  │
│  │  │  • Reads linked Google Sheets/Docs       │  │  │
│  │  │  • Detects: blockers, overdue, missing   │  │  │
│  │  │  • Writes to: phase-9-monitoring         │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │   SUPPORT AGENT (Parallel)               │  │  │
│  │  │  • Reads monitoring results              │  │  │
│  │  │  • Decides: tag? email? nudge?           │  │  │
│  │  │  • Takes action: comments, queues email  │  │  │
│  │  │  • Writes to: phase-9-support            │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │   REPORTING AGENT (Parallel)             │  │  │
│  │  │  • Reads monitoring + support results    │  │  │
│  │  │  • Analyzes coach patterns               │  │  │
│  │  │  • Builds daily digest email             │  │  │
│  │  │  • Writes to: phase-9-reporting          │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                          ▲                              │
│         All agents read/write shared AgentDB            │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │            AGENTDB SHARED STATE                  │  │
│  │                                                  │  │
│  │  • phase-9-monitoring: detection results        │  │
│  │  • phase-9-support: intervention actions        │  │
│  │  • phase-9-reporting: metrics & patterns        │  │
│  │  • phase-9-errors: escalations & issues         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Parallel execution:** All three agents run concurrently via Ruflo
2. **Shared state via AgentDB:** Agents read each other's work, make intelligent decisions
3. **Graceful degradation:** If one agent fails, others continue
4. **Message-smart:** Tag in sheets first (no email spam), email only as fallback
5. **Pattern-aware:** Learn from coach history, predict delays before they happen

---

## 2. Agent Specifications

### Agent 1: Monitoring Agent

**Purpose:** Detect problems before coaches realize they're stuck

**Execution:** Every 30 minutes (parallel with other agents)

**Algorithm:**
1. Query database: fetch all active tasks, coaches, deadlines
2. For each task:
   - Check: Is task overdue? Has coach started?
   - If Google Sheet link → read sheet, parse structure, detect missing sections
   - If Google Doc link → read doc, find empty required fields
   - Use Groq AI to understand what "completion" means for this task
3. Classify each task:
   - `on_time`: progressing normally
   - `at_risk`: pattern detected (coach is slow) OR approaching deadline
   - `overdue`: past due date
   - `blocked`: missing external dependency (awaiting manager review)
4. Write results to AgentDB `phase-9-monitoring`

**Output format:**
```json
{
  "task_id": 5,
  "coach_id": 2,
  "coach_name": "Sarah",
  "task_title": "Observation Sheet",
  "status": "overdue",
  "days_overdue": 2,
  "sheet_id": "1A2B3C",
  "sheet_completion_percent": 45,
  "missing_sections": ["Coaching notes", "Follow-up actions"],
  "blockers": ["Section A requires coach signature"],
  "last_update_from_coach": "2026-06-07T10:30:00Z",
  "coach_pattern": "usually 1-2 days late",
  "detected_at": "2026-06-09T10:30:00Z"
}
```

**Intelligence:**
- Uses Groq to understand task requirements from description + sheet structure
- Tracks coach history (did Sarah finish on-time before?)
- Predicts: if Sarah follows her pattern, she'll be 2 days late again
- Context-aware: "visit 3 locations" → looks for location count in task updates

### Agent 2: Support Agent

**Purpose:** Help coaches in real-time, remove blockers, keep admin in the loop

**Execution:** Every 30 minutes (parallel with other agents)

**Algorithm:**
1. Read results from AgentDB `phase-9-monitoring`
2. For each issue:
   - Decide support strategy based on:
     - Does task have a Google Sheet link?
     - How overdue is it? (1 day vs 3 days = different actions)
     - Is this coach's first delay or recurring pattern?
3. Take action:
   - **If sheet exists AND first-time delay:**
     - Tag coach in sheet with specific comment
     - Don't email (avoid spam)
   - **If sheet exists AND 2+ days overdue:**
     - Tag in sheet AND send email (escalation)
   - **If no sheet OR tagging not possible:**
     - Send email to coach
   - **If severely overdue (3+ days):**
     - Email admin directly with escalation alert
4. Write to AgentDB `phase-9-support`

**Message templates:**

For sheet tagging (first nudge):
```
@${coach.email} - Please complete the Coaching Notes section by 3pm today.

Required:
• Your observations from the site visit
• Any blockers you faced
• Recommended follow-up actions

You're on track overall - just need to wrap up this section. 
Let me know if you need help!
```

For email (if no sheet or escalation):
```
Subject: Task "${task.title}" - ${Math.ceil(days_overdue)} days overdue

Hi ${coach.name},

Your task "${task.title}" is ${days_overdue} days overdue. Here's what we need:

${missing_sections.map(s => `• ${s}`).join('\n')}

Can you complete this by ${due_date.format('3pm')} today? 
If you're blocked, reply here and I'll help.

Thanks!
```

**Fatigue prevention:**
- Don't tag same task twice within 30 minutes (let coach respond)
- Don't email same task twice within 4 hours
- Skip notifications if coach just submitted an update

### Agent 3: Reporting Agent

**Purpose:** Summarize system health, detect patterns, recommend coaching adjustments

**Execution:** Daily at 9am (admin review time)

**Algorithm:**
1. Read all data:
   - Monitoring results for past 24 hours
   - Support actions taken
   - Coach task history (completion rates, delay patterns)
   - Phase 7 coaching insights (if available)
2. Analyze:
   - Count on-time, at-risk, blocked coaches
   - Per-coach breakdown: tasks, status, patterns
   - Cross-coach patterns: which task types slip? which coaches excel?
   - Predictive: based on today's trends, who might miss deadline tomorrow?
3. Generate recommendations:
   - Coaching adjustments: "Sarah needs earlier deadlines"
   - Task design: "Observation sheets slip frequently - break into checkpoints"
   - Team-level: "Celebrate Priya's 100% on-time; offer to mentor others"
4. Write to AgentDB `phase-9-reporting`
5. Send HTML email to admin

**Report sections:**
- **Status Overview:** Summary counts (on-time, at-risk, blocked)
- **At-Risk Coaches:** Detailed per-coach breakdown with actions taken
- **Patterns & Insights:** Task performance, coach patterns, learning opportunities
- **Recommendations:** What to do differently next cycle
- **Agent Activity:** Stats on what agents did (issues detected, actions taken)

**Output format:**
```json
{
  "date": "2026-06-09",
  "summary": {
    "on_time_count": 7,
    "at_risk_count": 1,
    "blocked_count": 0
  },
  "at_risk_coaches": [
    {
      "coach_id": 2,
      "coach_name": "Sarah",
      "days_overdue": 2,
      "task": "Observation Sheet",
      "completion": 45,
      "actions_taken": ["tagged_in_sheet", "email_sent"],
      "recommendation": "Call to offer support"
    }
  ],
  "patterns": {
    "task_patterns": [
      {
        "task_type": "observation_sheets",
        "on_time_rate": 0.60,
        "avg_delay_days": 1.2
      }
    ],
    "coach_patterns": [
      {
        "coach_name": "Sarah",
        "always_late_by": "1-2 days",
        "recommendation": "assign earlier"
      }
    ]
  },
  "recommendations": [
    "Break observation sheets into smaller checkpoints",
    "Assign Sarah deadline 1 day earlier next cycle"
  ],
  "agent_activity": {
    "monitoring_issues_detected": 8,
    "support_actions_taken": 5,
    "errors": 0
  }
}
```

---

## 3. Google Sheets/Docs Integration

### Authentication

**Service Account (Robot Reader):**
- Reads sheets, detects updates
- Can't comment or modify
- One-time setup: share folder with service account

**Admin OAuth (Your Credentials):**
- Tags/comments appear as you authorizing the system
- Coaches see comments from "Coach Tracker System" (on your behalf)
- One-time setup: authenticate app to your Google Drive

### Reading Sheets

Monitoring Agent reads sheets using service account:

```javascript
const sheet = await googleSheetsClient.read({
  spreadsheetId: task.sheet_id,
  range: 'Sheet1!A1:Z100'
});

// Use Groq to understand what's been filled
const analysis = await groq.messages.create({
  model: 'llama-3.3-70b-versatile',
  messages: [{
    role: 'user',
    content: `Analyze this coaching observation sheet.
    
Sheet content (first 100 rows):
${JSON.stringify(sheet.data)}

Task requirement: "${task.description}"

What's been filled? What's missing? Return JSON:
{
  "completion_percent": 0-100,
  "filled_sections": [...],
  "missing_sections": [...],
  "blockers": [...]
}`
  }]
});
```

### Commenting in Sheets

Support Agent tags coaches using admin OAuth:

```javascript
await googleSheetsClient.addComment({
  spreadsheetId: task.sheet_id,
  range: 'A1', // top of sheet
  message: `@${coach.email} - Please fill the Coaching Notes section by 3pm today.

Required fields:
• Coach observations from the site visit
• Any blockers the coach faced
• Recommended follow-up actions

You're doing great - just need this final section. Let me know if you need help!`
});

// Store in database that we left a comment
await db.prepare(`
  INSERT INTO sheet_comments (task_id, coach_id, comment_id, message, created_at)
  VALUES (?, ?, ?, ?, ?)
`).run(task.id, coach.id, commentId, message, new Date());
```

### Sheet Snapshots

Monitoring Agent stores snapshots to detect progress:

```javascript
// Before reading, fetch previous snapshot
const previous = await db.prepare(`
  SELECT * FROM monitoring_snapshots 
  WHERE task_id = ? 
  ORDER BY snapshot_at DESC LIMIT 1
`).get(task.id);

// After reading sheet
const current = {
  sheet_completion_percent: analysis.completion_percent,
  filled_sections: analysis.filled_sections,
  missing_sections: analysis.missing_sections
};

// Store current snapshot
await db.prepare(`
  INSERT INTO monitoring_snapshots 
  (task_id, coach_id, sheet_completion_percent, missing_sections, status)
  VALUES (?, ?, ?, ?, ?)
`).run(task.id, coach.id, current.sheet_completion_percent, 
       JSON.stringify(current.missing_sections), status);

// Detect if stalled (no progress 2+ days)
if (previous && current.sheet_completion_percent === previous.sheet_completion_percent) {
  const daysSinceUpdate = (new Date() - previous.snapshot_at) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > 2) {
    // Mark as "stalled"
  }
}
```

---

## 4. Communication Channels

### Channel Hierarchy

**1. Google Sheets Comment (Preferred)**
- ✅ Context right where coach is working
- ✅ High engagement
- ✅ No email spam
- Used for: data entry tasks, observation sheets, forms with sheet links

**2. Email (Fallback)**
- ✅ Reaches coach even if they don't check app
- ✅ Coach can reply to email
- ✅ Async communication
- Used for: tasks without sheets, escalations, urgent alerts

**3. In-App Notification (Always)**
- ✅ Audit trail
- ✅ Coaches reference later
- ✅ Admin sees all interactions
- Used for: everything (every action logged)

### Message Fatigue Prevention

Before tagging same task again:
```javascript
const recentComments = await db.prepare(`
  SELECT COUNT(*) as count FROM sheet_comments
  WHERE task_id = ? AND created_at > datetime('now', '-30 minutes')
`).get(task.id);

if (recentComments.count > 0) {
  return { action: 'skipped', reason: 'recently_tagged' };
}
```

Before sending email again:
```javascript
const recentEmails = await db.prepare(`
  SELECT COUNT(*) as count FROM email_queue
  WHERE task_id = ? AND status != 'failed'
  AND created_at > datetime('now', '-4 hours')
`).get(task.id);

if (recentEmails.count > 0) {
  return { action: 'skipped', reason: 'recently_emailed' };
}
```

### Coach-to-Agent Communication

If coach replies to agent email:

```
From: sarah@example.com
To: system@coachtracker.app
Subject: Re: Task "Observation Sheet" - Photos needed

Hi, I'm visiting Site 1 tomorrow morning. Can we extend to 5pm tomorrow?
```

System processes:
1. Parse email with Groq (understand intent)
2. Create admin notification: "Coach Sarah requested deadline extension"
3. Admin approves/denies via dashboard
4. If approved → agent updates task, notifies coach

---

## 5. Error Handling & Escalation

### Error Logging

When agents encounter problems:

```javascript
try {
  const sheet = await googleSheetsClient.read(task.sheet_id);
} catch (error) {
  await agentdb.write({
    namespace: 'phase-9-errors',
    key: `monitoring-sheet-${task.id}`,
    value: {
      error_type: 'sheet_read_failed',
      task_id: task.id,
      reason: error.message,
      severity: 'high',
      timestamp: new Date(),
      auto_recovery: 'skip_task_this_cycle',
      manual_action_needed: false
    }
  });
  
  // Continue with other tasks (don't fail entire job)
}
```

### Escalation Levels

| Severity | When | Action | Who's Notified |
|----------|------|--------|-----------------|
| Low | Coach 1 day late | Tag in sheet | Coach only |
| Medium | Coach 2 days late | Tag + email | Coach + admin |
| High | Coach 3+ days late OR pattern | Email admin immediately | Admin only |
| Critical | Agent errors | Log, continue, review in daily report | Admin (in report) |

### Agent Failure Modes

**If Monitoring Agent fails:**
- Skip that cycle, retry next 30 minutes
- Log error to AgentDB
- Admin sees summary in daily report

**If Support Agent fails:**
- Don't escalate (miss one nudge > spam coach)
- Log failure, retry next cycle
- Monitoring continues working

**If Reporting Agent fails:**
- Send alert to admin: "Daily report generation failed"
- Resend previous report
- Ad-hoc report can be generated manually

---

## 6. Database Schema

### New Tables

```sql
-- Monitor snapshots (what agent sees each cycle)
CREATE TABLE IF NOT EXISTS monitoring_snapshots (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL UNIQUE,
  coach_id INTEGER NOT NULL,
  snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sheet_completion_percent INTEGER,
  missing_sections TEXT, -- JSON array
  blockers TEXT, -- JSON array
  status VARCHAR(50), -- 'on_time', 'at_risk', 'overdue', 'blocked'
  days_remaining INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (coach_id) REFERENCES users(id)
);

-- Sheet comments left by agents
CREATE TABLE IF NOT EXISTS sheet_comments (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL,
  coach_id INTEGER NOT NULL,
  comment_id VARCHAR(255), -- Google Sheets comment ID
  message TEXT,
  agent_name VARCHAR(50), -- 'monitoring', 'support'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  coach_response_at TIMESTAMP,
  coach_response TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (coach_id) REFERENCES users(id)
);

-- Support actions taken
CREATE TABLE IF NOT EXISTS support_actions (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL,
  coach_id INTEGER NOT NULL,
  action_type VARCHAR(50), -- 'sheet_comment', 'email', 'notification'
  action_status VARCHAR(50), -- 'pending', 'sent', 'failed'
  details TEXT, -- JSON: message, metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  coach_response TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (coach_id) REFERENCES users(id)
);

-- Daily reports (for history)
CREATE TABLE IF NOT EXISTS daily_reports (
  id INTEGER PRIMARY KEY,
  report_date DATE UNIQUE,
  summary_json TEXT, -- { on_time: 7, at_risk: 1, blocked: 0 }
  patterns_json TEXT, -- coach + task patterns
  recommendations_json TEXT, -- actionable recommendations
  email_sent_to VARCHAR(255),
  email_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent health tracking
CREATE TABLE IF NOT EXISTS agent_errors (
  id INTEGER PRIMARY KEY,
  agent_name VARCHAR(50),
  error_type VARCHAR(100),
  error_message TEXT,
  task_id INTEGER,
  severity VARCHAR(50), -- 'low', 'medium', 'high', 'critical'
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

---

## 7. Cron Schedule & Timeouts

### Execution Schedule

```javascript
// Every 30 minutes: Monitoring + Support agents
schedule('*/30 * * * *', async () => {
  const runId = generateId();
  console.log(`[${runId}] Starting agent swarm...`);
  
  try {
    await runAgentSwarm({
      agents: ['monitoring', 'support'],
      timeout: 60000 // 60 seconds
    });
    console.log(`[${runId}] Agents completed successfully`);
  } catch (error) {
    console.error(`[${runId}] Agent error:`, error);
    await logError('swarm', error.message, 'high');
  }
});

// Daily at 9am: Reporting agent
schedule('0 9 * * *', async () => {
  const runId = generateId();
  console.log(`[${runId}] Starting daily reporting...`);
  
  try {
    await runAgentSwarm({
      agents: ['reporting'],
      timeout: 120000 // 120 seconds (more complex)
    });
    console.log(`[${runId}] Reporting completed successfully`);
  } catch (error) {
    console.error(`[${runId}] Reporting error:`, error);
    await alertAdmin(`Daily report failed: ${error.message}`);
  }
});
```

### Agent Timeouts & Safeguards

- **Per-agent timeout:** 60 seconds (Groq API calls included)
- **Total swarm timeout:** 90 seconds (all agents must finish)
- **Max retries:** 3 per agent per day
- **Failure threshold:** If all 3 retries fail → escalate to admin alert

---

## 8. Cost & Performance

### API Costs (Monthly Estimate)

| Service | Estimate | Notes |
|---------|----------|-------|
| **Groq API** | $0-2 | Free tier: 30 RPM, 6K TPM (sufficient) |
| **Google Sheets API** | $0-0.10 | 2 reads per task per cycle, well under quota |
| **Google Docs API** | $0-0.10 | As needed for doc-based tasks |
| **Email (Gmail)** | $0 | Free via Gmail SMTP |
| **PostgreSQL** | Included | Part of Railway free tier |
| **Total** | **$0-2/month** | Minimal cost |

### Performance Targets

- **Monitoring cycle:** <30 seconds (read all tasks + sheets)
- **Support cycle:** <20 seconds (decide + tag/email)
- **Reporting cycle:** <45 seconds (analysis + email generation)
- **Total system overhead:** ~30 seconds every 30 minutes = 1% CPU overhead

---

## 9. Testing Strategy

### Unit Tests
- Test each agent independently with mocked data
- Verify decision logic (at-risk detection, escalation rules)
- Mock Google Sheets API responses

### Integration Tests
- Test agents reading from database
- Test AgentDB state sharing
- Test email queueing

### End-to-End Tests (Using Agent-Browser)
- Assign task with sheet
- Wait 30 minutes
- Verify: agent commented in sheet ✓
- Verify: notification appeared ✓
- Verify: daily report generated ✓

### Production Monitoring
- Track agent runtimes
- Monitor error rates
- Alert on timeout/failures
- Log all agent decisions to database

---

## 10. Success Criteria

Phase 9 is **complete** when:

✅ Monitoring Agent detects overdue coaches and missing data in sheets
✅ Support Agent tags coaches in sheets (or emails as fallback)
✅ No email spam (fatigue prevention working)
✅ Daily report sent to admin at 9am with accurate patterns & recommendations
✅ All three agents work in parallel via Ruflo
✅ Graceful error handling (one agent failure doesn't break others)
✅ Cost < $5/month
✅ System overhead < 2% (agents run in background)

---

## 11. Future Enhancements (Post-Phase 9)

- **Coach-specific reports:** Each coach gets their own weekly performance summary
- **Predictive alerts:** "Sarah will be late based on current pace" (predict 1 day before)
- **Team patterns:** Cohort analysis (how does this coach compare to peers?)
- **Autonomous rescheduling:** Agent adjusts deadlines based on coach's historical patterns
- **Mobile notifications:** Push notifications to coach's phone for urgent alerts
- **Video coaching:** Agent suggests specific coaching approach based on coach patterns

---

## Sign-Off

**Design Status:** Ready for Implementation Planning  
**Approver:** User (awaiting review)  
**Implementation Team:** Ready  
**Timeline:** Phase 9 (Estimated 3-4 weeks with parallelized development)

