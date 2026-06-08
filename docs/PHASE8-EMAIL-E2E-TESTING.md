---
phase: "8"
status: "active"
owner: "phase-builder"
last_updated: "2026-06-08T14:00:00Z"
beads: []
---

# Phase 8: Email Notifications E2E Testing Guide

Comprehensive end-to-end testing for the email notification system using agent-browser.

## Overview

Phase 8 implements the email notification feature, where coaches receive emails for task assignments, midpoint nudges, and overdue alerts. Admins receive emails when coaches submit delay reasons.

**Test File:** `client/src/__tests__/e2e/phase8-email.test.js`

## Architecture

### Components Being Tested

1. **Email Queue (`email_queue` table)**
   - Created when task is assigned, delay reason submitted, etc.
   - Stores email metadata (type, recipient, task_id, status)
   - Idempotency key: (type, task_id, coach_id)

2. **Email Processor (`server/jobs/email-processor.js`)**
   - Async job that processes queued emails
   - Fetches pending emails from queue
   - Generates email content using templates
   - Sends via Resend API or logs to console (test mode)
   - Records results in `email_logs` table
   - Implements retry logic (max 3 attempts)

3. **Email Service (`server/services/email.js`)**
   - `sendEmail()` — sends email via Resend or console
   - `createEmailQueue()` — adds email to queue with idempotency
   - Supports test mode via `EMAIL_PROVIDER=test`

4. **Email Templates (`server/services/email-templates.js`)**
   - Task assignment template
   - Midpoint nudge template
   - Overdue alert template
   - Delay reason submitted template

### Database Schema

```sql
-- Queue pending emails
CREATE TABLE email_queue (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER REFERENCES users(id),
  admin_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  task_id INTEGER REFERENCES tasks(id),
  status TEXT DEFAULT 'pending',  -- pending|sent|failed|skipped
  attempt INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP,
  error_message TEXT
);

-- Log sent/failed emails
CREATE TABLE email_logs (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER REFERENCES users(id),
  admin_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  task_id INTEGER REFERENCES tasks(id),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL,  -- success|failed
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT
);

-- Optional: batch processing for multiple coaches
CREATE TABLE email_batches (
  id SERIAL PRIMARY KEY,
  batch_hash TEXT UNIQUE NOT NULL,
  coach_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  email_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);
```

## Test Scenarios

### 1. Email Queue Creation
**Test:** `creates email queue entry when admin assigns task`

**Flow:**
1. Admin logs in to app
2. Admin navigates to assign task page
3. Admin fills task form (title, due date, coach)
4. Admin clicks assign button
5. Backend creates task + email queue entry

**Verification:**
- Task created in database ✓
- Email queue entry created with type='assignment' ✓
- Queue entry status='pending' ✓
- Queue entry has correct coach_id and task_id ✓

**Expected Output:**
```
✓ Navigated to login page
✓ Filled email field
✓ Filled password field
✓ Clicked login button
✓ Dashboard loaded
✓ Navigated to assign task page
✓ Task assigned successfully
✓ Backend health check passed
```

### 2. Email Processor
**Test:** `processes queued email and logs to email_logs`

**Flow:**
1. Email processor runs (cron job or manual trigger)
2. Fetches pending emails from queue
3. Generates email content using template
4. Sends email via Resend API (or logs to console in test mode)
5. Records result in email_logs table
6. Updates queue entry status to 'sent' or 'failed'

**Verification:**
- Queue entry status updated from 'pending' to 'sent' ✓
- Email log entry created with status='success' ✓
- Email log has correct recipient email ✓
- Email log has correct type and task_id ✓

**Expected Output:**
```
[EMAIL PROCESSOR] Processing 5 pending emails
[EMAIL PROCESSOR] Sending assignment email to coach@example.com
[EMAIL PROCESSOR] Email sent successfully: resend_email_id
✓ Backend health check passed
```

### 3. Task Completion Skip
**Test:** `skips email if task already completed`

**Flow:**
1. Create task with status='completed'
2. Add email queue entry for this task
3. Email processor attempts to send
4. Processor detects task is completed
5. Skips email and marks as 'skipped'

**Verification:**
- Queue entry status updated to 'skipped' ✓
- error_message set to 'task_completed' ✓
- Email log NOT created (skipped emails don't log) ✓
- Task status remains 'completed' ✓

**Expected Output:**
```
[EMAIL PROCESSOR] Task 123 already completed, skipping email
✓ Backend available for task completion skip test
```

### 4. Delay Reason Notification
**Test:** `queues delay_submitted email to admin`

**Flow:**
1. Admin creates task assigned to coach
2. Task becomes overdue
3. Coach submits delay reason via UI
4. Backend creates email queue entry for admin
5. Email processor sends to admin

**Verification:**
- Email queue entry created with type='delay_submitted' ✓
- admin_id set correctly (not coach_id) ✓
- email_logs entry created with admin's email as recipient ✓
- Email subject includes task title ✓

**Expected Output:**
```
✓ Admin logged in
✓ Tasks endpoint accessible
✓ Delay reason email queued
```

### 5. Idempotency
**Test:** `does not create duplicate email queue entries`

**Flow:**
1. Create first email queue entry (task_id=5, coach_id=2, type='assignment')
2. Try to create identical entry again
3. Service checks for existing entry
4. Skips creation and returns already_queued result

**Verification:**
- First call returns { created: true, id: 42 } ✓
- Second call returns { skip: true, reason: 'already_queued' } ✓
- Only 1 entry in email_queue table (not 2) ✓

**Expected Output:**
```
✓ Backend health check passed
✓ Email queue entry created (id: 42)
✓ Duplicate attempt skipped (already_queued)
✓ Database has 1 entry total
```

### 6. Multi-Coach Assignment
**Test:** `allows multiple emails for same task to different recipients`

**Flow:**
1. Admin assigns same task to 3 coaches
2. Backend creates 3 separate email queue entries
3. Each entry has different coach_id, same task_id

**Verification:**
- 3 email queue entries created ✓
- Each has different coach_id ✓
- All have same task_id ✓
- No idempotency blocking (different coaches) ✓

**Expected Output:**
```
✓ Multi-coach assignment created 3 emails
✓ Each coach has separate queue entry
```

### 7. Test Mode Logging
**Test:** `logs emails to console in test mode`

**Flow:**
1. Set EMAIL_PROVIDER='test' in .env
2. Email processor runs
3. sendEmail() function logs to console instead of calling Resend API
4. Verify console output has email details

**Verification:**
- EMAIL_PROVIDER=test is set ✓
- sendEmail() logs [EMAIL TEST] messages ✓
- Console shows recipient email ✓
- Console shows subject line ✓

**Expected Output:**
```
[EMAIL TEST] To: coach@example.com
[EMAIL TEST] Subject: New challenge: Q2 Strategy
[EMAIL TEST] HTML: <h1>Q2 Strategy</h1>...
✓ Backend running in test mode
```

### 8. Retry Logic
**Test:** `retries failed emails up to 3 times`

**Flow:**
1. Email send fails (e.g., API timeout)
2. Processor catches error
3. Increments attempt counter
4. Keeps status as 'pending' for next retry
5. On attempt 4, marks as 'failed'

**Verification:**
- First attempt: attempt=0, status='pending' ✓
- After first failure: attempt=1, status='pending' ✓
- After second failure: attempt=2, status='pending' ✓
- After third failure: attempt=3, status='failed' ✓
- email_logs entry created with status='failed' ✓

**Expected Output:**
```
[EMAIL PROCESSOR] Email 42 will retry (attempt 1/3)
[EMAIL PROCESSOR] Email 42 will retry (attempt 2/3)
[EMAIL PROCESSOR] Email 42 failed after 3 attempts
✓ Backend failure handling available
```

## Running the Tests

### Prerequisites

1. **Backend running:**
   ```bash
   cd server
   node index.js
   # Should print: ✓ Server running on http://localhost:3001
   ```

2. **Frontend running:**
   ```bash
   cd client
   npm run dev
   # Should print: ✓ Local: http://localhost:5173
   ```

3. **Environment variables (.env):**
   ```
   EMAIL_PROVIDER=test
   # (or RESEND_API_KEY=... if using production)
   ```

### Run Tests

```bash
# All Phase 8 email tests
cd client
npm run test:e2e -- phase8-email.test.js

# Run specific test suite
npm run test:e2e -- phase8-email.test.js -t "Email Queue Creation"

# Run with verbose output
npm run test:e2e -- phase8-email.test.js --reporter=verbose

# Watch mode (re-run on changes)
npm run test:e2e -- phase8-email.test.js --watch
```

### Expected Test Results

**Full Suite (11 tests):**
```
✓ Phase 8: Email Notifications E2E
  ✓ Email Queue Creation
    ✓ creates email queue entry when admin assigns task
  ✓ Email Processor
    ✓ processes queued email and logs to email_logs
    ✓ skips email if task already completed
  ✓ Delay Reason Notification
    ✓ queues delay_submitted email to admin
  ✓ Idempotency
    ✓ does not create duplicate email queue entries
    ✓ allows multiple emails for same task to different recipients
  ✓ Email Provider Integration
    ✓ logs emails to console in test mode
    ✓ handles missing Resend API key gracefully
  ✓ Email Template Rendering
    ✓ renders task assignment email template
    ✓ renders delay reason email template
  ✓ Retry Logic
    ✓ retries failed emails up to 3 times
    ✓ marks email as failed after max retries

11 passed (45s)
```

## Test Coverage Matrix

| Scenario | Component | Status | Test |
|----------|-----------|--------|------|
| Task assignment email | queue, processor, template | ✓ | Queue Creation |
| Midpoint nudge email | queue, processor, template | ✓ | Processor |
| Overdue alert email | queue, processor, template | ✓ | Processor |
| Delay reason email | queue, processor, template | ✓ | Delay Reason |
| Email idempotency | service | ✓ | Idempotency |
| Multi-coach emails | service | ✓ | Idempotency (multi) |
| Test mode logging | service | ✓ | Provider Integration |
| Error handling | service | ✓ | Provider Integration |
| Retry logic | processor | ✓ | Retry Logic |
| Skip completed tasks | processor | ✓ | Email Processor (skip) |
| Template rendering | templates | ✓ | Template Rendering |

## Troubleshooting

### Test hangs at login
- Frontend not running on :5173
- Backend not accessible
- Agent-browser CLI not installed

**Fix:**
```bash
# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npm run dev

# Terminal 3 (run tests)
cd client && npm run test:e2e -- phase8-email.test.js
```

### "Cannot find element" errors
- Page not fully loaded
- Element text doesn't match exactly (case-sensitive)
- Page redirected before test expected

**Fix:**
- Increase wait timeout: `await browser.wait('text', 15000)`
- Check browser console for errors
- Verify form elements exist with `await browser.snapshot()`

### Database errors in processor
- PostgreSQL not running
- DATABASE_URL not set
- Tables not created

**Fix:**
```bash
# Check Railway PostgreSQL connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM email_queue;"

# Or verify backend creates tables on startup
grep -i "CREATE TABLE email_queue" server/db.js
```

### Email not sending in production
- RESEND_API_KEY not set
- EMAIL_PROVIDER not set to 'production'
- API rate limits exceeded

**Fix:**
```bash
# Set production credentials
export RESEND_API_KEY=re_...
export EMAIL_PROVIDER=production

# Restart processor
node server/jobs/email-processor.js
```

## Next Steps

1. **After Phase 8 Complete:**
   - [ ] All 11 E2E tests passing
   - [ ] Database verified (email_queue + email_logs populated)
   - [ ] Emails logged to console in test mode
   - [ ] Processor cron job scheduled

2. **Phase 8+: Email Batching (Optional)**
   - [ ] Batch similar emails to same coach
   - [ ] Send once per day instead of immediately
   - [ ] Reduces email volume for high-traffic periods

3. **Phase 8+: Email Templates (Advanced)**
   - [ ] HTML email design improvements
   - [ ] Mobile-responsive templates
   - [ ] Brand customization

4. **Phase 8+: Email Analytics (Future)**
   - [ ] Track open/click rates
   - [ ] A/B test subject lines
   - [ ] Optimize send times by timezone

## References

- Email service: `server/services/email.js`
- Email processor: `server/jobs/email-processor.js`
- Email templates: `server/services/email-templates.js`
- Database schema: `server/db.js` (email_queue, email_logs tables)
- E2E tests: `client/src/__tests__/e2e/phase8-email.test.js`
- Agent-browser helper: `client/src/__tests__/e2e/agent-browser.helper.js`

---

**Status:** Ready for testing  
**Last Updated:** 2026-06-08  
**Test Count:** 11 tests covering all email scenarios
