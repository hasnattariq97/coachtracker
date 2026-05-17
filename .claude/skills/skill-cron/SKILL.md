---
name: skill-cron
description: node-cron nudge job patterns and idempotency
---

# skill-cron — node-cron Nudge Jobs

## Setup (server/cron.js)
```javascript
const cron = require('node-cron');
const db = require('./db');

// Start all cron jobs
function startCronJobs() {
  // Production: '0 * * * *' (every hour)
  // Testing: '*/2 * * * *' (every 2 minutes)
  const schedule = process.env.CRON_SCHEDULE || '0 * * * *';
  
  cron.schedule(schedule, () => {
    console.log(`[${new Date().toISOString()}] Running nudge jobs...`);
    runMidpointNudges();
    runOverdueNudges();
  });
  
  console.log(`Cron scheduler started with schedule: ${schedule}`);
}

module.exports = {startCronJobs};
```

## Job 1: Midpoint Nudges
```javascript
function runMidpointNudges() {
  try {
    // Find tasks where now >= 50% of time has elapsed, and no midpoint nudge was sent
    const candidates = db.prepare(`
      SELECT t.id, t.coach_id, t.title, t.assigned_at, t.due_date
      FROM tasks t
      WHERE t.status != 'completed'
        AND datetime(t.assigned_at, '+' || 
          CAST((julianday(t.due_date) - julianday(t.assigned_at)) / 2 AS INTEGER) || ' seconds'
        ) <= datetime('now')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'midpoint_nudge'
        )
    `).all();
    
    const notifStmt = db.prepare(`
      INSERT INTO notifications (user_id, task_id, type, message)
      VALUES (?, ?, 'midpoint_nudge', ?)
    `);
    
    let count = 0;
    for (const task of candidates) {
      const dueDateStr = new Date(task.due_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
      const message = `Halfway there! ⚡ Don't let momentum slip — '${task.title}' is due ${dueDateStr}. How's it going?`;
      notifStmt.run(task.coach_id, task.id, message);
      count++;
    }
    
    if (count > 0) console.log(`  → Sent ${count} midpoint nudges`);
  } catch (e) {
    console.error('Error in midpoint nudges:', e);
  }
}
```

## Job 2: Overdue Nudges & Status Update
```javascript
function runOverdueNudges() {
  try {
    // Find tasks that are past due and not yet marked overdue
    const overdueList = db.prepare(`
      SELECT id, coach_id, title, due_date
      FROM tasks
      WHERE due_date < datetime('now')
        AND status NOT IN ('completed', 'overdue')
    `).all();
    
    const updateStmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
    const notifStmt = db.prepare(`
      INSERT INTO notifications (user_id, task_id, type, message)
      VALUES (?, ?, ?, ?)
    `);
    
    let count = 0;
    const coachesToNotify = new Set();
    
    for (const task of overdueList) {
      // Update task status to overdue
      updateStmt.run('overdue', task.id);
      
      // Create coach notification
      const coachMsg = `This one slipped by — and that's okay. 💪 Please share what got in the way for '${task.title}' so we can move forward together.`;
      notifStmt.run(task.coach_id, task.id, 'overdue_nudge', coachMsg);
      
      coachesToNotify.add(task.coach_id);
      count++;
    }
    
    // Create admin summary notification (one per admin)
    if (count > 0) {
      const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
      const adminMsg = `${count} task(s) are now overdue and waiting for coach feedback.`;
      
      for (const admin of admins) {
        notifStmt.run(admin.id, null, 'overdue_nudge', adminMsg);
      }
    }
    
    if (count > 0) console.log(`  → Marked ${count} tasks as overdue and sent coach nudges`);
  } catch (e) {
    console.error('Error in overdue nudges:', e);
  }
}
```

## Key Concepts

### Idempotency
Always check if a notification of the same type already exists for the task before inserting a new one. This prevents double-nudging if the cron job runs multiple times or is restarted.

```javascript
// Good: checks if midpoint nudge already sent
const existing = db.prepare(`
  SELECT 1 FROM notifications
  WHERE task_id = ? AND type = 'midpoint_nudge'
  LIMIT 1
`).get(taskId);

if (!existing) {
  // Insert notification
}
```

### Midpoint Calculation
50% of time elapsed between assigned_at and due_date:
```javascript
// Halfway point = assigned_at + (due_date - assigned_at) / 2
datetime(assigned_at, '+' || 
  CAST((julianday(due_date) - julianday(assigned_at)) / 2 AS INTEGER) || ' seconds'
)
```

### Status Transitions
Tasks can only transition to 'overdue' once. After that, cron jobs should skip them (check `status NOT IN ('completed', 'overdue')`).

### Testing Schedule
For testing midpoint/overdue logic without waiting hours:
1. Set `process.env.CRON_SCHEDULE = '*/1 * * * *'` (every minute)
2. Create a task with:
   - assigned_at = 2 minutes ago
   - due_date = 1 minute from now (for testing midpoint)
   - Or due_date = 1 minute ago (for testing overdue)
3. Wait for cron to run
4. Check notifications table for newly created notifications

### Import & Start in server/index.js
```javascript
const {startCronJobs} = require('./cron');

// After all routes are mounted:
startCronJobs();

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
```
