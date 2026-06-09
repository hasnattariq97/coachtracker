---
phase: "9"
status: "active"
owner: "phase-builder"
last_updated: "2026-06-09T23:30:00Z"
beads: ["phase-9-agent-guide-complete"]
---

# Phase 9: Autonomous Multi-Agent Coaching System — User Guide

**Version:** 1.0  
**Status:** Production Ready ✅  
**Last Updated:** 2026-06-09

---

## Overview

Phase 9 introduces **three autonomous agents** that continuously monitor coaches and provide real-time support without requiring admin intervention. This guide explains how the system works, how to configure it, and how to interpret its insights.

### What Is Phase 9?

Phase 9 is an autonomous coaching intelligence layer that runs on a schedule:

1. **Every 30 minutes:** Monitoring and Support agents analyze coach behavior
2. **Daily at 9am:** Reporting agent generates performance digests
3. **Throughout:** Automated interventions help at-risk coaches before delays happen

### What It Does

**For Coaches:**
- Detects when you're falling behind and sends preventive support
- Tags your tasks in Google Sheets with status indicators
- Identifies your work patterns (procrastinator? fast-track? steady?)
- Generates daily performance insights

**For Admins:**
- Daily digests showing team patterns and recommendations
- Monitoring snapshots with task risk analysis
- Audit trail of all interventions (emails, tags, escalations)
- Actionable recommendations for coaching interventions

### Key Features

- 🤖 **Autonomous** — Runs without admin clicking anything
- 🔍 **Intelligent** — Detects patterns in coach behavior, not just deadlines
- 🎯 **Preventive** — Sends support *before* tasks are late
- 😌 **Fatigue-Free** — Built-in rules prevent message overload
- 📊 **Transparent** — All decisions logged, all reasoning visible
- 🚀 **Scalable** — Works for 1 coach or 100

---

## How It Works: The Three-Agent System

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│         Cron Scheduler (server/cron.js)          │
│  • 30-minute cycle: :00, :30 every hour         │
│  • Daily cycle: 9:00 AM UTC                     │
└─────────────────────────────────────────────────┘
                        ↓
        ┌───────────────────────────────┐
        │  Agent Orchestrator           │
        │  (server/agents/orchestrator) │
        └───────────────────────────────┘
                   ↓              ↓
    ┌──────────────────────┐  ┌─────────────────────┐
    │  30-Minute Cycle     │  │   Daily Cycle       │
    │  (run every 30min)   │  │   (run at 9am UTC)  │
    └──────────────────────┘  └─────────────────────┘
         ↓          ↓                    ↓
    ┌─────────┐ ┌─────────┐        ┌──────────┐
    │Monitoring│ │ Support │        │Reporting │
    │  Agent   │ │  Agent  │        │  Agent   │
    └─────────┘ └─────────┘        └──────────┘
         ↓          ↓                    ↓
   Snapshots    Emails/Tags         Digests
   +Patterns    +Escalations        +Recs
```

### Agent 1: Monitoring Agent (Every 30 Minutes)

**What It Does:**
1. Scans all tasks in database (filtering for near-due, overdue, in-progress)
2. Pulls updated progress data from Google Sheets (if configured)
3. Categorizes each task by risk level:
   - **On Track** — < 75% of time elapsed
   - **At Risk** — >= 75% of time elapsed but not overdue
   - **Overdue** — Past due date
4. Analyzes coach behavior patterns:
   - **Fast-Track** — 90%+ on-time completion
   - **Steady** — 60-89% on-time completion
   - **Procrastinator** — < 60% on-time, avg 48+ hours late
   - **Inconsistent** — Varies wildly (some on-time, some very late)
5. Saves snapshot to `monitoring_snapshots` table with:
   - Task risk scores
   - Coach pattern classification
   - Timestamp and detection metadata

**Database Output:**
```
monitoring_snapshots
├── id: UUID
├── cycle_timestamp: 2026-06-09 14:30:00
├── coach_id: 5
├── tasks: [
│   { id: 42, title: "Q2 Strategy", risk: "at_risk", pct_time: 0.82 },
│   { id: 43, title: "Coaching Notes", risk: "on_track", pct_time: 0.45 }
│ ]
├── coach_pattern: "procrastinator"
├── pattern_confidence: 0.87
└── metadata: { ... }
```

**READ-ONLY Agent:** Does not send emails or make changes. Just observes and reports.

### Agent 2: Support Agent (Every 30 Minutes, After Monitoring)

**What It Does:**
1. Reads latest monitoring snapshot
2. Decides: "Should we intervene? Which tasks? Which coaches?"
3. Applies decision tree (7 rules):
   - ✅ Fast-track coach on-time → No intervention (let them work)
   - ⚠️ At-risk task + procrastinator coach → Tag in Sheets + email
   - 🚨 Overdue task + any coach → Escalate to admin
   - 💪 At-risk task + steady coach → Motivational email
   - 😔 Multiple overdue tasks → Direct support (phone call)
   - And 2 more rules (see below)
4. **Executes Actions:**
   - **Tag** — Update Google Sheets column with task status
   - **Email** — Queue support email (sent by email processor)
   - **Escalate** — Flag to admin in daily digest
5. **Prevents Fatigue:**
   - Same task tagged? Wait 30 minutes before tagging again
   - Same coach emailed? Wait 4 hours before emailing again
   - No spam, just strategic interventions

**Decision Rules:**

| Situation | Action | Why |
|-----------|--------|-----|
| Fast-track + on-time | Skip | They're crushing it, don't interrupt |
| At-risk + procrastinator | Tag + Email | Nudge before they miss deadline |
| Overdue + any | Escalate | Admin needs to know, coaching might not be enough |
| At-risk + steady | Email | Gentle reminder, they usually deliver |
| Multiple overdue | Escalate | Multiple blockers = admin should chat directly |
| No pattern detected | Monitor | Not enough data yet to intervene |
| Coached recently | Skip (4-hour window) | Prevent message fatigue |

**Database Output:**
```
support_actions
├── id: UUID
├── action_timestamp: 2026-06-09 14:35:00
├── coach_id: 5
├── task_id: 42
├── action_type: "email"  (or "tag", "escalate")
├── reason: "at_risk_procrastinator"
├── email_queue_id: "email-123"  (if email sent)
└── metadata: { ... }
```

**DECISION-MAKING Agent:** Reads snapshots and decides what to do. Queues actions but doesn't execute immediately (email processor handles email delivery).

### Agent 3: Reporting Agent (Daily at 9am UTC)

**What It Does:**
1. Reads all support actions from past 24 hours
2. Analyzes patterns:
   - Which coaches are at-risk?
   - Which tasks are blockers?
   - What patterns emerged?
   - Team completion rate vs individual completion rates
3. Generates recommendations:
   - "Consider 1-on-1 with Coach Sarah (procrastinator pattern)"
   - "Task 'Q2 Strategy' is stuck with 3 coaches — unblock dependency?"
   - "Team at 78% on-time — trend improving 📈"
4. Creates HTML email digest with:
   - Summary statistics (on-time %, at-risk tasks, escalations)
   - Coach patterns (who's struggling, who's excelling)
   - Top blockers (which tasks have most at-risk coaches)
   - Recommendations (what to focus on)
5. Queues to admin email
6. Archives report to `daily_reports` table for historical analysis

**Database Output:**
```
daily_reports
├── id: UUID
├── report_date: "2026-06-09"
├── generated_at: "2026-06-09 09:00:00"
├── patterns: {
│   "on_time_rate": 0.78,
│   "at_risk_count": 12,
│   "procrastinator_coaches": [5, 7],
│   "blocker_tasks": [42, 51]
│ }
├── recommendations: [
│   "1-on-1 with Coach Sarah about task blockers",
│   "Unblock Q2 Strategy — 3 coaches affected"
│ ]
└── email_sent_to: "admin@tracker.com"
```

**ANALYSIS Agent:** Synthesizes all 24-hour data into actionable insights for admins.

---

## Admin Guide

### Viewing Monitoring Results

#### Option 1: Daily Email Digest (Recommended)
Every day at 9:05am UTC, you receive email with:
- **Team Stats** — On-time completion %, at-risk tasks, overdue count
- **Coach Patterns** — Who's procrastinating, who's excelling
- **Blockers** — Tasks with highest risk
- **Recommendations** — What to focus on this week

Example digest subject: `[Coach Tracker] Daily Insights — 78% on-time, 12 at-risk tasks`

#### Option 2: Database Query (Advanced)
```sql
-- Last 24 hours of monitoring snapshots
SELECT * FROM monitoring_snapshots
WHERE cycle_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY cycle_timestamp DESC;

-- Support actions (interventions) from last 24 hours
SELECT * FROM support_actions
WHERE action_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY action_timestamp DESC;

-- Latest daily report
SELECT * FROM daily_reports
ORDER BY report_date DESC
LIMIT 1;
```

#### Option 3: UI Dashboard (Planned for Phase 9b)
- Real-time agent status indicator
- Last run timestamps
- Quick view of at-risk coaches
- Recommendation cards (clickable to take action)

### Interpreting Coach Patterns

**Fast-Track Coach** (90%+ on-time, < 10% late)
- ✅ Typically needs no intervention
- 💡 Use as mentor for struggling coaches
- 📈 Track their methods for best practices

**Steady Coach** (60-89% on-time)
- ✅ Reliable, occasional delays
- 💡 Gentle reminders work well
- 📈 Support Agent sends emails to nudge them

**Procrastinator Coach** (< 60% on-time, 48+ hours late avg)
- ⚠️ Needs preventive intervention
- 💡 Check for blockers, not laziness
- 📊 Support Agent escalates, you follow up 1-on-1

**Inconsistent Coach** (wildly varying, no pattern)
- ❓ Unpredictable behavior
- 💡 Could indicate external blockers or personal issues
- 📞 Reach out to understand what's happening

### Configuration & Control

#### Environment Variables
Set in `server/.env`:

```bash
# Agent scheduling
AGENT_MONITORING_ENABLED=true        # Enable/disable monitoring agent
AGENT_SUPPORT_ENABLED=true           # Enable/disable support agent
AGENT_REPORTING_ENABLED=true         # Enable/disable reporting agent

# Google Sheets integration (Phase 9b)
GOOGLE_SHEETS_SERVICE_ACCOUNT=...    # For reading progress
GOOGLE_SHEETS_OAUTH_TOKEN=...        # For tagging

# Email configuration
ADMIN_EMAIL=you@example.com          # Receive daily digests
EMAIL_PROVIDER=gmail                 # or "test" for console logs
```

#### Disable Agents Temporarily
```javascript
// In server/.env or database config:
AGENT_MONITORING_ENABLED=false   // Stop monitoring agent
AGENT_SUPPORT_ENABLED=false      // Stop support interventions
```

**When to disable:**
- During system maintenance
- During mass task reassignments (avoid false alerts)
- For testing

#### View Agent Logs
Agents log all activity to console. In production (Railway):
```bash
railway logs --service backend | grep -i "monitoring\|support\|reporting"
```

### Troubleshooting Agent Issues

#### Agents not running (nothing in email)
**Check 1:** Verify cron jobs scheduled
```bash
# In server/cron.js, look for:
schedule('0,30 * * * *', async () => { // 30-min cycle
  await orchestrator.runMonitoringCycle();
});

schedule('0 9 * * *', async () => { // 9am daily
  await orchestrator.runReportingCycle();
});
```

**Check 2:** Look for errors in database
```sql
SELECT * FROM agent_errors
ORDER BY error_timestamp DESC
LIMIT 10;
```

**Check 3:** Restart backend
```bash
# Kill old processes
taskkill /IM node.exe /F

# Start fresh
cd server && node index.js
```

#### Groq API timeouts (Phase 7 insights failing)
**Issue:** Recommendations aren't being generated
```
Error: Groq API timeout after 30 seconds
```

**Fix:**
```bash
# Check GROQ_API_KEY is set
echo $GROQ_API_KEY

# If empty, add to server/.env:
GROQ_API_KEY=gsk_YOUR_KEY_HERE

# Restart:
taskkill /IM node.exe /F
cd server && node index.js
```

#### Google Sheets not syncing (tags not appearing)
**Issue:** Support Agent can't tag tasks in Sheets
```
Error: Google Sheets authentication failed
```

**Current Status:** OAuth stub only. Full implementation in Phase 9b.  
**Workaround:** Tags are logged in `support_actions` table even if Sheets update fails.

#### Email queue backed up (emails not being sent)
**Issue:** Support Agent queued emails but they haven't been sent
```sql
-- Check queue:
SELECT COUNT(*) FROM email_queue WHERE sent_at IS NULL;

-- View oldest pending:
SELECT * FROM email_queue
WHERE sent_at IS NULL
ORDER BY created_at
LIMIT 5;
```

**Fix:**
```bash
# Email processor runs every 5 minutes (server/jobs/email-processor.js)
# Check that it's imported in server/index.js

# Manually trigger (in Node console):
const processor = require('./jobs/email-processor');
await processor.processPending();
```

---

## Coach Guide

### What Notifications Will You Receive?

#### Type 1: Midpoint Nudge (Cron-Scheduled, Every Hour)
**When:** 50% of task time has elapsed  
**From:** System automation  
**Message:** "Halfway there! ⚡ 'Q2 Strategy' is due June 12. How's it going?"  
**Action:** Reassuring check-in, no urgency

#### Type 2: Support Email (From Support Agent)
**When:** At-risk or overdue task detected  
**From:** Autonomous Support Agent  
**Message:** Depends on situation:
- *Gentle:* "Moving 'Q2 Strategy' to your priority queue. Let's talk if you're blocked."
- *Urgent:* "'Customer Feedback' is overdue. What blockers are we hitting?"
- *Motivational:* "You nailed the last 3 on time. 'New Initiative' is coming up — thinking about approach?"

**Action:** Click email link to view task details or reply with blockers

#### Type 3: Overdue Alert (Cron-Scheduled, Hourly)
**When:** Task passes due date  
**From:** System automation  
**Message:** "This one slipped by — and that's okay. 💪 Please share what got in the way for 'Q2 Strategy' so we can move forward together."  
**Action:** Submit delay reason in app

#### Type 4: Daily Summary (From Reporting Agent)
**When:** Daily at 9:05am UTC  
**From:** Daily Reporting Agent  
**Message:** Only if you're flagged as at-risk or procrastinator pattern  
Example: "Your 'Q2 Strategy' is at-risk. I've noted that you sometimes work better with a deadline. We're here if you need support."

### How to Use Support (Email Intervention)

**When you receive a support email:**

1. **Read the message** — It explains why you're getting contacted
2. **Check the details** — Task name, deadline, current status
3. **Respond or act:**
   - If you need help: Reply with blockers ("waiting on legal team")
   - If you'll finish: Confirm ("starting today, done by Friday")
   - If you need extension: Ask ("can we push to June 15?")
4. **Admin will follow up** — Next business day (based on support level)

**Support escalation levels:**

| Level | Response Time | Communication |
|-------|---------------|----------------|
| Tag | Async | Task tagged in Google Sheets, your signal to check |
| Email | 24 hours | Email + task notification, expect reply |
| Escalate | 2 hours | Admin notified, direct phone call likely |

### Understanding Your Performance Pattern

**Every 30 minutes, the system analyzes your completion rate:**

- ✅ **Fast-Track** (90%+ on-time) — You're crushing it. Minimal support.
- ✅ **Steady** (60-89% on-time) — You deliver consistently. Light support.
- ⚠️ **Procrastinator** (< 60% on-time, 48+ hours late) — Support Agent sends preventive nudges.
- ❓ **Inconsistent** (unpredictable) — More frequent check-ins while pattern stabilizes.

**Your pattern isn't a judgment.** It's data for support:
- If you're a procrastinator but aware → We can work with deadlines you choose
- If you're inconsistent → We'll help you find patterns that work
- If you're steady → We trust you, we're just here when needed

### What Happens When You Delay a Task

**Scenario:** Task due June 12, it's now June 14, you haven't completed it.

1. **System detects overdue** (every hour)
2. **You get notification:** "This one slipped by — share what got in the way"
3. **You submit delay reason:** "Legal team hasn't approved the proposal yet"
4. **Admin sees reason:** In daily digest + task detail view
5. **Coaching happens:** Admin reaches out with support, not judgment
6. **Next time:** System notes pattern ("legal approvals take 5 days") for better planning

### Accessing Task Resources

Each task has resource links (Google Sheets, Drive folders, Docs) attached:

1. **View task** in your dashboard
2. **Click resource link** (opens in new tab)
3. **Edit/review** directly in Google Sheets or Docs
4. **Support Agent may tag** your sheet as "At-Risk" — indicator for quick reference

---

## Database Reference

### monitoring_snapshots Table

**Purpose:** Store snapshots of coach/task status captured every 30 minutes

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique snapshot ID |
| `cycle_timestamp` | TIMESTAMP | When this snapshot was taken |
| `coach_id` | INT | Coach being monitored |
| `tasks` | JSON | Array of task status objects: `{id, title, risk, pct_time, status}` |
| `coach_pattern` | VARCHAR | "fast_track", "steady", "procrastinator", "inconsistent" |
| `pattern_confidence` | DECIMAL | 0.0-1.0, how confident is the pattern assessment |
| `created_at` | TIMESTAMP | Record creation time |

**Example Query:**
```sql
-- View latest snapshot for each coach
SELECT DISTINCT ON (coach_id) *
FROM monitoring_snapshots
ORDER BY coach_id, cycle_timestamp DESC;

-- Find all "at-risk" tasks from last 6 hours
SELECT coach_id, tasks -> 'risk' as risk_level, cycle_timestamp
FROM monitoring_snapshots
WHERE cycle_timestamp > NOW() - INTERVAL '6 hours'
  AND tasks ->> 'risk' = 'at_risk';
```

### support_actions Table

**Purpose:** Audit trail of all support agent decisions and actions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique action ID |
| `action_timestamp` | TIMESTAMP | When action was decided |
| `coach_id` | INT | Coach receiving intervention |
| `task_id` | INT | Task (if applicable) |
| `action_type` | VARCHAR | "tag", "email", "escalate" |
| `reason` | VARCHAR | Why this action: "at_risk_procrastinator", "overdue_any", etc. |
| `email_queue_id` | UUID | Reference to queued email (if action_type=email) |
| `sheet_cell` | VARCHAR | Google Sheets cell tagged (if action_type=tag) |
| `metadata` | JSON | Additional context |
| `created_at` | TIMESTAMP | Record creation time |

**Example Query:**
```sql
-- View all interventions for Coach ID 5 today
SELECT * FROM support_actions
WHERE coach_id = 5
  AND action_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY action_timestamp DESC;

-- Count escalations by reason
SELECT reason, COUNT(*) as count
FROM support_actions
WHERE action_type = 'escalate'
GROUP BY reason;

-- Coaches who got emailed in last 6 hours
SELECT DISTINCT coach_id, COUNT(*) as email_count
FROM support_actions
WHERE action_type = 'email'
  AND action_timestamp > NOW() - INTERVAL '6 hours'
GROUP BY coach_id;
```

### daily_reports Table

**Purpose:** Historical archive of daily digests for analysis and audit

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique report ID |
| `report_date` | DATE | Date report covers |
| `generated_at` | TIMESTAMP | When report was generated (usually 9:00am UTC) |
| `patterns` | JSON | Analyzed patterns: `{on_time_rate, at_risk_count, procrastinator_coaches, blocker_tasks}` |
| `recommendations` | JSON | Array of actionable recommendations |
| `email_sent_to` | VARCHAR | Admin email(s) receiving digest |
| `created_at` | TIMESTAMP | Record creation time |

**Example Query:**
```sql
-- View last 7 days of reports
SELECT report_date, patterns -> 'on_time_rate' as on_time_pct,
       patterns -> 'at_risk_count' as at_risk_count
FROM daily_reports
ORDER BY report_date DESC
LIMIT 7;

-- Track team on-time trend over 30 days
SELECT report_date,
       (patterns -> 'on_time_rate')::DECIMAL as on_time_rate
FROM daily_reports
WHERE report_date >= NOW()::DATE - INTERVAL '30 days'
ORDER BY report_date;
```

### agent_errors Table

**Purpose:** Error tracking for debugging and operational health

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique error ID |
| `error_timestamp` | TIMESTAMP | When error occurred |
| `agent_name` | VARCHAR | Which agent: "MonitoringAgent", "SupportAgent", "ReportingAgent" |
| `error_type` | VARCHAR | Error category: "timeout", "database", "sheets_api", "email", "logic" |
| `error_message` | TEXT | Full error message/stack |
| `retry_count` | INT | How many times we've retried |
| `resolved` | BOOLEAN | Did we recover? |
| `created_at` | TIMESTAMP | Record creation time |

**Example Query:**
```sql
-- View all unresolved errors
SELECT * FROM agent_errors
WHERE resolved = FALSE
ORDER BY error_timestamp DESC;

-- Error frequency by type (last 24 hours)
SELECT error_type, COUNT(*) as frequency
FROM agent_errors
WHERE error_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY error_type;
```

### Debugging Queries

**Find coaches never intervened on (working great!)**
```sql
SELECT DISTINCT c.id, c.name, COUNT(sa.id) as intervention_count
FROM users c
LEFT JOIN support_actions sa ON c.id = sa.coach_id
WHERE c.role = 'coach'
GROUP BY c.id, c.name
HAVING COUNT(sa.id) = 0;
```

**Find most problematic task (most at-risk flags)**
```sql
SELECT t.id, t.title,
       COUNT(*) as at_risk_count,
       MAX(ms.cycle_timestamp) as last_flagged
FROM tasks t
JOIN monitoring_snapshots ms ON ms.coach_id = t.coach_id
WHERE ms.tasks ->> 'risk' = 'at_risk'
GROUP BY t.id, t.title
ORDER BY at_risk_count DESC
LIMIT 10;
```

**How many times was each coach emailed (last 7 days)**
```sql
SELECT c.id, c.name, COUNT(*) as email_count
FROM users c
JOIN support_actions sa ON c.id = sa.coach_id
WHERE sa.action_type = 'email'
  AND sa.action_timestamp > NOW() - INTERVAL '7 days'
GROUP BY c.id, c.name
ORDER BY email_count DESC;
```

---

## Phase 9b & Beyond

### What's Coming in Phase 9b (Deferred)

Phase 9b will enhance the autonomous system with:

#### 1. Groq API Integration for Adaptive Insights
- **Current:** Heuristic-based recommendations ("coach procrastinates → send email")
- **Phase 9b:** LLM-powered analysis ("coach procrastinates on complex tasks → suggest breaking into milestones")
- **Benefit:** Personalized coaching advice generated per coach/task
- **Timeline:** Q3 2026 (after Phase 9 stabilizes)

#### 2. OAuth for Google Sheets Commenting
- **Current:** Support Agent tags cells in Sheets but can't add comments
- **Phase 9b:** Agents post comments directly ("This is at-risk, here's what we can do...")
- **Benefit:** Coaches see support advice right where they're working
- **Timeline:** Q3 2026 (awaiting OAuth approval from Google)

#### 3. Performance Anomaly Detection (ML)
- **Current:** Thresholds set by admins (75% time = at-risk)
- **Phase 9b:** ML models learn per-coach baselines (Coach Sarah is at-risk at 60%, Coach John at 85%)
- **Benefit:** Early detection tailored to each coach's style
- **Timeline:** Q4 2026

#### 4. Predictive Delay Warnings
- **Current:** Alert on overdue or at-risk
- **Phase 9b:** Predict "this task has 73% chance of being late based on Coach X's patterns"
- **Benefit:** Ultra-early intervention before coaching becomes reactive
- **Timeline:** Q4 2026

#### 5. Team Cohort Analysis
- **Current:** Individual coach analysis
- **Phase 9b:** Cohort comparison ("Your team is 15% behind pace vs last quarter")
- **Benefit:** Context for understanding if patterns are individual or team-wide
- **Timeline:** Q4 2026

### Phase 9 Limitations (Known Constraints)

**Google Sheets Integration (Read-Only)**
- Monitoring Agent can read from Sheets (progress, custom status columns)
- Support Agent **cannot write** to Sheets (Phase 9b with OAuth)
- Workaround: Manual updates or check app notifications

**Email Only (No SMS)**
- Support notifications via email only
- Phase 9c may add SMS for urgent escalations
- Workaround: Email forwarding to phone

**Heuristic Recommendations (Not AI)**
- Recommendations based on fixed rules, not LLM
- Phase 9b will add Groq API for intelligent suggestions
- Workaround: Admin review + manual coaching

**Scheduling Fixed (Not Dynamic)**
- Agents run on cron schedule (every 30 min, daily at 9am)
- Can't dynamically adjust based on urgency
- Workaround: Manual trigger via API (to be added Phase 9b)

### When to Escalate Issues to Human Coaches

The system is autonomous but not omniscient. **When to override system and chat with coach directly:**

1. **Task stuck 2+ weeks** — System can't help with blocker investigation
2. **Pattern doesn't match data** — You know something the system doesn't
3. **Personal circumstances** — Family issues, health, etc. (system won't know this)
4. **Ambiguous blocker** — Coach says "waiting on approval" but unclear from whom
5. **Multiple failed interventions** — Email/tag didn't move the needle, needs conversation

**Coaching Tone:** "System flagged this, and I want to understand how I can help" (not "System says you're failing").

---

## Deployment & Operations

### Running Agents Locally

**Prerequisite:** Backend running
```bash
cd server && npm install && node index.js
```

**Verify agents started:**
```
✓ Monitoring Agent scheduled (30-minute cycle)
✓ Support Agent scheduled (30-minute cycle)
✓ Reporting Agent scheduled (daily at 9am UTC)
```

### Running Agents in Production (Railway)

Agents run automatically on Railway's cron scheduler.

**View logs:**
```bash
railway logs --service backend | grep -E "MonitoringAgent|SupportAgent|ReportingAgent"
```

**Trigger manual run (for testing):**
```bash
# Add endpoint to server/index.js:
app.post('/api/admin/agents/run-monitoring', requireAdmin, async (req, res) => {
  const orchestrator = require('./agents/orchestrator');
  await orchestrator.runMonitoringCycle();
  res.json({ success: true });
});

# Then curl:
curl -X POST http://localhost:3001/api/admin/agents/run-monitoring \
  -H "Authorization: Bearer <token>"
```

### Monitoring Agent Health

**Healthy indicators:**
```bash
# Database growing (snapshots being saved)
SELECT COUNT(*) FROM monitoring_snapshots;
# Should increase every 30 min

# Support actions being logged
SELECT COUNT(*) FROM support_actions WHERE action_timestamp > NOW() - INTERVAL '24 hours';
# Should have entries throughout the day

# No errors
SELECT * FROM agent_errors WHERE error_timestamp > NOW() - INTERVAL '1 hour';
# Should be empty or minimal
```

**Unhealthy indicators:**
```bash
# No snapshots in 1 hour
SELECT MAX(cycle_timestamp) FROM monitoring_snapshots;
# Should be within last 30 minutes

# Errors accumulating
SELECT COUNT(*) FROM agent_errors WHERE resolved = FALSE;
# Should be 0

# Support actions stopped
SELECT MAX(action_timestamp) FROM support_actions;
# Should be within last 30 minutes
```

---

## FAQ

### Q: Can I turn off an agent temporarily?
**A:** Yes. Set `AGENT_SUPPORT_ENABLED=false` in `.env` and restart backend. Only that agent stops; others continue.

### Q: Will agents send emails to coaches about every little thing?
**A:** No. Built-in fatigue prevention:
- Won't tag same task twice within 30 minutes
- Won't email same coach twice within 4 hours
- Escalations only for overdue tasks

### Q: Can admins override agent decisions?
**A:** Yes, but logged. Manually sending email to coach while system skipped it creates audit trail in `support_actions` table.

### Q: What happens if Groq API is down?
**A:** Reporting Agent still works (heuristic recommendations). Groq-powered recommendations in Phase 9b will timeout gracefully and use fallback heuristics.

### Q: How often should I review daily digests?
**A:** At minimum, daily (9:05am UTC). Pattern is: read digest, scan for at-risk coaches, spend 5 min on 1-on-1s if needed.

### Q: Can I modify the decision rules (e.g., change 75% threshold)?
**A:** Yes. Edit constants in `server/agents/monitoring-agent.js`:
```javascript
static RISK_THRESHOLD_PCT = 0.75;  // Change to 0.70 for earlier detection
```

### Q: Are coaches told they're in a pattern?
**A:** Not automatically. You decide in emails. System just flags pattern for you to address in conversation.

### Q: What if a coach disagrees with the pattern assessment?
**A:** Good. Patterns are data-informed, not destiny. Use as conversation starter: "Data shows you finish 48 hours late on average. Is that accurate? What would help?"

---

## Support & Questions

**For issues:**
- Check [@docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems
- Query `agent_errors` table for system-level issues
- Contact admin: hasnat@niete.edu.pk

**For enhancements:**
- Document feature request in `.beads/` directory
- Reference Phase 9b roadmap above
- Open GitHub issue with details

**For training:**
- Share this guide with new team members
- Highlight "Coach Guide" and "Understanding Patterns" sections
- Walk through daily digest email to explain metrics

---

## Glossary

| Term | Definition |
|------|------------|
| **Agent** | Autonomous program that runs on schedule, makes decisions, takes actions |
| **Monitoring Agent** | Detects at-risk/overdue tasks, analyzes patterns (every 30 min) |
| **Support Agent** | Decides interventions (email/tag/escalate) based on monitoring (every 30 min) |
| **Reporting Agent** | Synthesizes 24-hour data into daily digest with recommendations (daily 9am) |
| **Snapshot** | Captured state at one moment: which tasks at-risk, which coaches procrastinating |
| **Pattern** | Coach behavior classification: Fast-Track, Steady, Procrastinator, Inconsistent |
| **Intervention** | Action taken: tag in Sheets, send support email, escalate to admin |
| **Fatigue Prevention** | Rules preventing message overload (30-min tag window, 4-hour email window) |
| **Escalate** | Flag to admin for direct intervention (usually overdue tasks) |
| **At-Risk Task** | Task with >= 75% of time elapsed, not yet overdue |
| **Phase 9b** | Future enhancements (Groq AI, OAuth, ML, predictive warnings, cohort analysis) |

---

**Last Updated:** 2026-06-09  
**Maintained By:** Phase 9 Agent System  
**Next Review:** 2026-06-23 (2 weeks after Phase 9 launch)
