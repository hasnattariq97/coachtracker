---
phase: "8"
status: "draft"
owner: "brainstorming"
last_updated: "2026-06-08T00:00:00Z"
beads: []
---

# Phase 8: Email Notifications Design

**Date:** 2026-06-08  
**Status:** Design Approved  
**Scope:** Add email notifications to Coach Task Tracker via Resend API  

---

## Overview

Coaches and admins currently receive **in-app notifications only** (30-second polling). Phase 8 adds **email notifications** for key events so users don't have to be logged in to know about task updates.

**In scope:**
- Email triggers: task assignment, midpoint nudge, overdue alert, delay reason submission
- Email provider: Resend (free tier, simple API)
- Smart batching: digest emails for multiple overdue tasks
- Retry logic: failed emails queued and retried up to 3 times
- Audit trail: all emails logged to database
- Testing: both local mode (flag) and mocks

**Out of scope:**
- Email unsubscribe links (Phase 9+)
- Weekly coaching summary emails (Phase 9+)
- Email templates in database (hardcoded for now)
- SMS or push notifications

---

## Requirements

### Functional

**Email Triggers:**
1. **Task Assignment** — Coach gets email when admin assigns task to them
   - Sent: immediately when task created
   - Recipient: coach email
   - Skip if: task already completed before email sent

2. **Midpoint Nudge** — Coach gets email at 50% of deadline
   - Sent: via cron job (every hour check)
   - Recipient: coach email
   - Skip if: task completed before nudge time
   - Skip if: email already sent

3. **Overdue Alert** — Coach gets email when task passes due date
   - Sent: via cron job (every hour check)
   - Recipient: coach email (batched into digest if multiple tasks overdue)
   - Skip if: task completed before alert time
   - Skip if: email already sent

4. **Delay Reason Submission** — Admin gets email when coach explains delay
   - Sent: immediately when coach submits reason via PUT /api/tasks/:id/delay-reason
   - Recipient: admin email (currently hardcoded as admin@tracker.com)

**Batching:**
- Multiple overdue tasks for same coach → 1 digest email listing all overdue tasks
- One email per midpoint nudge (no batching for this type)
- One email per assignment (no batching)

### Non-Functional

- **Idempotency:** Never send the same email twice to the same person for the same task
- **Reliability:** Failed emails queued and retried (max 3 attempts)
- **Auditability:** All email attempts logged (success/fail) with timestamps and error messages
- **Testing safety:** Local dev mode logs to console, doesn't send real emails
- **Performance:** Email sending doesn't block task operations (queued asynchronously)

---

## Architecture

### High-Level Flow

```
Task Event (assignment, completion, delay reason, etc.)
         ↓
Application Code
         ↓
createEmailQueue(type, coachId, taskId, adminId)
         ↓
Insert row into email_queue table
         ↓
Background Job (runs every 5 minutes)
         ↓
Process Pending Emails
         ↓
Two Paths:
  A) Single email → send via Resend
  B) Digest email → batch & send
         ↓
Log result to email_logs table
         ↓
Update email_queue row to sent/failed
```

### Database Schema

#### Table 1: `email_queue`
Stores pending and failed emails awaiting processing.

```sql
CREATE TABLE email_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coach_id INTEGER,
  admin_id INTEGER,
  type TEXT NOT NULL, -- 'assignment', 'midpoint_nudge', 'overdue', 'delay_submitted'
  task_id INTEGER,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempt INTEGER DEFAULT 0, -- number of send attempts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP, -- when to send (for delayed emails)
  error_message TEXT,
  FOREIGN KEY (coach_id) REFERENCES users(id),
  FOREIGN KEY (admin_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

#### Table 2: `email_logs`
Immutable audit trail of all email attempts (success and failure).

```sql
CREATE TABLE email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coach_id INTEGER,
  admin_id INTEGER,
  type TEXT NOT NULL,
  task_id INTEGER,
  recipient EMAIL NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failed'
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY (coach_id) REFERENCES users(id),
  FOREIGN KEY (admin_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

#### Table 3: `email_batches`
Groups related emails for digest batching (optional, for deduplication).

```sql
CREATE TABLE email_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_hash TEXT UNIQUE NOT NULL, -- hash of (coach_id, type, date)
  coach_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'overdue_digest'
  email_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  FOREIGN KEY (coach_id) REFERENCES users(id)
);
```

---

## Implementation Components

### 1. Email Service (`server/services/email.js`)

**Responsibility:** Send emails via Resend API, with test mode fallback.

```javascript
// Pseudocode
export async function sendEmail(to, subject, html) {
  if (process.env.EMAIL_PROVIDER === 'test') {
    console.log(`[EMAIL TEST] To: ${to}, Subject: ${subject}`);
    return { success: true };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({ to, subject, html });
}

export async function createEmailQueue(type, coachId, taskId, adminId = null) {
  // 1. Check idempotency: is this email already queued for this task?
  const exists = db.prepare(
    'SELECT id FROM email_queue WHERE type = ? AND task_id = ? AND coach_id = ?'
  ).get(type, taskId, coachId);

  if (exists) return { skip: true, reason: 'already_queued' };

  // 2. Determine recipient
  let recipient;
  if (type === 'delay_submitted') {
    recipient = adminId || 1; // admin user
  } else {
    recipient = coachId;
  }

  // 3. Insert into queue
  const row = db.prepare(
    'INSERT INTO email_queue (type, coach_id, admin_id, task_id, status) VALUES (?, ?, ?, ?, "pending")'
  ).run(type, coachId, adminId, taskId);

  return { created: true, id: row.lastInsertRowid };
}
```

### 2. Email Templates (`server/services/email-templates.js`)

**Responsibility:** Generate HTML email content.

```javascript
export function taskAssignmentEmail(coachName, taskTitle, dueDate, taskLink) {
  return `
    <p>Hi ${coachName},</p>
    <p>You've got a new challenge! 🎯</p>
    <p><strong>${taskTitle}</strong> — make it happen by ${dueDate}.</p>
    <p><a href="${taskLink}">View task →</a></p>
    <p style="color: #666; font-size: 12px;">Coaching builds the future. You've got this.</p>
  `;
}

export function midpointNudgeEmail(coachName, taskTitle, dueDate, taskLink) {
  return `
    <p>Hi ${coachName},</p>
    <p>Halfway there! ⚡</p>
    <p>Don't let momentum slip — <strong>${taskTitle}</strong> is due ${dueDate}. How's it going?</p>
    <p><a href="${taskLink}">Check progress →</a></p>
  `;
}

export function overdueBatchEmail(coachName, overdueTasks) {
  let taskList = overdueTasks.map(t => 
    `<li>${t.title} (due ${t.dueDate})</li>`
  ).join('');

  return `
    <p>Hi ${coachName},</p>
    <p>This one slipped by — and that's okay. 💪</p>
    <p>You have ${overdueTasks.length} overdue task(s):</p>
    <ul>${taskList}</ul>
    <p>Please share what got in the way so we can move forward together.</p>
  `;
}

export function delayReasonSubmittedEmail(adminName, coachName, taskTitle, reason) {
  return `
    <p>Hi ${adminName},</p>
    <p><strong>${coachName}</strong> submitted a reason for the overdue task <strong>${taskTitle}</strong>:</p>
    <blockquote>${reason}</blockquote>
    <p>Follow up to understand any blockers and adjust support as needed.</p>
  `;
}
```

### 3. Email Processor Job (`server/jobs/email-processor.js`)

**Responsibility:** Background job that processes queued emails every 5 minutes.

```javascript
export async function processEmailQueue() {
  // 1. Get pending emails, oldest first
  const pending = db.prepare(
    'SELECT * FROM email_queue WHERE status = "pending" ORDER BY created_at LIMIT 50'
  ).all();

  for (const item of pending) {
    try {
      // 2. Get task and coach details
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(item.task_id);
      const coach = db.prepare('SELECT * FROM users WHERE id = ?').get(item.coach_id);
      const admin = db.prepare('SELECT * FROM users WHERE id = ?').get(item.admin_id);

      // 3. Check if task already completed (skip email)
      if (task.status === 'completed' && ['midpoint_nudge', 'overdue', 'assignment'].includes(item.type)) {
        updateEmailQueue(item.id, 'skipped', 'task_completed');
        continue;
      }

      // 4. Generate email content
      let to, subject, html;
      if (item.type === 'assignment') {
        to = coach.email;
        subject = `New challenge: ${task.title}`;
        html = taskAssignmentEmail(coach.name, task.title, task.due_date, taskLink(task.id));
      } else if (item.type === 'midpoint_nudge') {
        to = coach.email;
        subject = `Halfway there: ${task.title}`;
        html = midpointNudgeEmail(coach.name, task.title, task.due_date, taskLink(task.id));
      } else if (item.type === 'overdue') {
        // For overdue, batch multiple tasks
        const batchHash = hashBatch(coach.id, 'overdue', new Date().toISOString().split('T')[0]);
        // ... batching logic
      } else if (item.type === 'delay_submitted') {
        to = admin.email;
        subject = `Delay reason: ${task.title}`;
        html = delayReasonSubmittedEmail(admin.name, coach.name, task.title, task.delay_reason);
      }

      // 5. Send email
      const result = await sendEmail(to, subject, html);

      // 6. Log and update queue
      logEmailSuccess(item, to);
      updateEmailQueue(item.id, 'sent');

    } catch (error) {
      // 7. Handle failure: retry or mark as failed
      item.attempt++;
      if (item.attempt >= 3) {
        logEmailFailure(item, to, error.message);
        updateEmailQueue(item.id, 'failed', error.message);
      } else {
        // Increment attempt, keep status as pending for next run
        updateEmailQueueAttempt(item.id, item.attempt);
      }
    }
  }
}
```

### 4. Integration Points

**In `server/routes/tasks.js` — POST /api/tasks (create task):**
```javascript
// After task creation succeeds
for (const coachId of coach_ids) {
  await createEmailQueue('assignment', coachId, taskId);
}
```

**In `server/routes/tasks.js` — PUT /api/tasks/:id/delay-reason (submit delay):**
```javascript
// After delay reason inserted
const admin = db.prepare('SELECT id FROM users WHERE role = "admin" LIMIT 1').get();
await createEmailQueue('delay_submitted', task.coach_id, task.id, admin.id);
```

**In `server/cron.js` — Midpoint and overdue jobs:**
```javascript
// In existing midpoint job:
if (needsNotification(task)) {
  await createEmailQueue('midpoint_nudge', task.coach_id, task.id);
}

// In existing overdue job:
if (needsNotification(task)) {
  await createEmailQueue('overdue', task.coach_id, task.id);
}
```

**In `server/index.js` — startup:**
```javascript
import { processEmailQueue } from './jobs/email-processor.js';

// Start email processor job (every 5 minutes)
schedule('*/5 * * * *', processEmailQueue);
```

---

## Testing Strategy

### Local Development (Flag-Based)

Set in `.env`:
```
EMAIL_PROVIDER=test
RESEND_API_KEY=sk_test_xxx (dummy, won't be used)
```

When `EMAIL_PROVIDER=test`, `sendEmail()` logs to console instead of calling Resend API.

**Test manually:**
```bash
cd server && node index.js
# Create task via UI or API
# Check console logs: "[EMAIL TEST] To: coach@example.com, Subject: New challenge: ..."
# No real email sent ✅
```

### Automated Tests (Mocks)

Mock the Resend service in test files:

```javascript
import { createEmailQueue, sendEmail } from '../services/email.js';

jest.mock('../services/email.js', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  createEmailQueue: jest.fn().mockResolvedValue({ created: true })
}));

describe('Email Notifications', () => {
  test('creates email queue when task assigned', async () => {
    const response = await POST('/api/tasks', {
      coach_ids: [1, 2],
      title: 'Q2 Strategy',
      due_date: '2026-06-15'
    });

    expect(createEmailQueue).toHaveBeenCalledWith('assignment', 1, expect.any(Number));
    expect(createEmailQueue).toHaveBeenCalledWith('assignment', 2, expect.any(Number));
  });

  test('sends email via Resend in production mode', async () => {
    process.env.EMAIL_PROVIDER = 'resend';

    await processEmailQueue();

    expect(sendEmail).toHaveBeenCalledWith(
      expect.stringContaining('@example.com'),
      expect.stringContaining('challenge'),
      expect.stringContaining('html')
    );
  });

  test('retries failed emails up to 3 times', async () => {
    // Mock Resend to fail first 2 times, succeed 3rd
    sendEmail
      .mockRejectedValueOnce(new Error('Rate limited'))
      .mockRejectedValueOnce(new Error('Rate limited'))
      .mockResolvedValueOnce({ success: true });

    await processEmailQueue(); // attempt 1: fail
    await processEmailQueue(); // attempt 2: fail
    await processEmailQueue(); // attempt 3: success

    // Verify email_logs shows failed→failed→success
    const logs = db.prepare('SELECT * FROM email_logs WHERE task_id = ?').all(taskId);
    expect(logs.length).toBe(3);
    expect(logs[2].status).toBe('success');
  });
});
```

### Production

Set in `.env`:
```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_abc123xyz_realkey
```

Real Resend API calls happen. All sent/failed emails logged to `email_logs` table.

---

## Error Handling & Resilience

### Scenarios

| Scenario | Handling |
|----------|----------|
| Coach email invalid/missing | Log error, mark as failed, don't retry |
| Resend API rate limited | Keep in queue, retry on next run (within 3 attempts) |
| Network timeout | Keep in queue, retry on next run |
| Coach completes task before email sent | Skip email, mark as "skipped" in logs |
| Task deleted before email sends | Log error, don't send |
| Database connection fails | Job fails gracefully, next run retries |
| Email processor job crashes | Next run picks up pending emails again |

### Retry Logic

- **Max attempts:** 3
- **Retry interval:** 5 minutes (job runs every 5 minutes)
- **Total time to give up:** 10+ minutes
- **Failed emails:** marked as "failed" in `email_queue`, with error message in `email_logs`

---

## Dependencies

### External
- **Resend API** — send emails (free tier: 100 emails/day)
- **Node.js environment variables** — `.env` file for API key and mode

### Internal
- **Database** — SQLite/PostgreSQL (3 new tables)
- **Cron jobs** — already exists in `server/cron.js`
- **Express routes** — already exists
- **User/task models** — existing schema

### NPM Packages
- `resend` — NPM package (if not already installed, `npm install resend`)

---

## Security Considerations

1. **API Key Management**
   - Store `RESEND_API_KEY` in `.env`, never commit to git
   - Use different keys for dev (test mode) and production
   - Rotate keys if compromised

2. **Email Content**
   - No sensitive data in email subjects (task title ok, password not ok)
   - HTML templates escaped (no user input directly in HTML)
   - Task links are authenticated (coach sees only their tasks)

3. **Rate Limiting**
   - Resend free tier: 100 emails/day (sufficient for MVP)
   - If hitting limits, add backoff and alert admin

4. **Privacy**
   - Only send emails to coach/admin assigned to task
   - Email logs stored in database (audit trail)
   - Can query logs for compliance (GDPR, etc.)

---

## Success Criteria

✅ Coaches get emails when:
- Task assigned to them
- 50% of deadline elapsed
- Task past due date

✅ Admins get emails when:
- Coach submits delay reason

✅ Emails have:
- Correct recipient (coach or admin)
- Relevant subject line
- Coaching-tone message
- Clickable task link

✅ System handles:
- Failed emails (retries, logs errors)
- Duplicate prevention (idempotency)
- Test mode (console logging, no real emails)
- Production mode (real Resend API)

✅ Testing covers:
- Email queue creation
- Email sending (mocked in tests)
- Retry logic
- Idempotency
- Skipping completed tasks

---

## Future Enhancements (Phase 9+)

- Email preferences per coach (opt-in/opt-out by type)
- Unsubscribe links in emails
- Weekly coaching summary emails
- Email templates in database (customizable)
- HTML email styling improvements
- SMS notifications
- Batch coaching insights via email

---

## Timeline & Effort

- **Database setup:** 30 min
- **Email service:** 1 hour
- **Email templates:** 1 hour
- **Email processor job:** 1 hour
- **Route integration:** 30 min
- **Cron integration:** 30 min
- **Tests:** 2 hours
- **Documentation & review:** 1 hour

**Total: ~7-8 hours**

---

## References

- Resend docs: https://resend.com/docs
- Coach Task Tracker CLAUDE.md: CLAUDE.md
- Current notification system: `server/routes/notifications.js`
- Current cron jobs: `server/cron.js`
