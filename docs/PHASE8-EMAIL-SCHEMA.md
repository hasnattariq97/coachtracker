---
phase: "8"
status: "active"
owner: "automation"
last_updated: "2026-06-08T00:00:00Z"
beads: []
---

# Phase 8 Email Database Schema

## email_queue Table

Stores pending emails waiting to be sent with retry tracking.

```sql
CREATE TABLE email_queue (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'skipped'
  attempt INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP,
  error_message TEXT
);
```

**Columns:**
- `coach_id` — Coach recipient (for task assignment, midpoint, overdue emails)
- `admin_id` — Admin recipient (for task completion, delay reason notifications)
- `type` — Email type: 'assignment', 'midpoint_nudge', 'overdue', 'delay_submitted'
- `status` — 'pending' (waiting), 'sent' (successful), 'failed' (error), 'skipped' (user opted out)
- `attempt` — Number of send attempts (max 3 retries before marking failed)
- `scheduled_for` — When email should be sent (allows deferring immediate sends)
- `error_message` — Last error message if status is 'failed'

## email_logs Table

Immutable audit trail of all email attempts.

```sql
CREATE TABLE email_logs (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'failed'
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT
);
```

**Columns:**
- `recipient` — Full email address of recipient
- `status` — 'success' or 'failed'
- `sent_at` — When email was attempted
- `error_message` — Error details if failed

**Purpose:** Audit trail for compliance, debugging, and retry analysis.

## email_batches Table

Groups related emails for digest batching (future feature).

```sql
CREATE TABLE email_batches (
  id SERIAL PRIMARY KEY,
  batch_hash TEXT UNIQUE NOT NULL,
  coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'overdue_digest'
  email_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);
```

**Columns:**
- `batch_hash` — Hash of grouped items (e.g., coach_id + date + type)
- `type` — Batch type: 'overdue_digest' (daily summary), 'weekly_summary'
- `email_count` — Number of emails grouped in this batch
- `status` — 'pending' or 'sent'

**Purpose:** Allow coaches to receive 1 digest instead of 5 overdue emails per day.
