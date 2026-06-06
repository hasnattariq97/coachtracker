/**
 * @phase 5
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-06T00:00:00Z
 * @beads []
 */

const cron = require('node-cron');
const db = require('./db');

// Helper: Create notification with idempotency via UNIQUE constraint
const createNotification = async (userId, taskId, type, message) => {
  try {
    await db.run(
      `INSERT INTO notifications (user_id, task_id, type, message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, task_id, type) WHERE task_id IS NOT NULL
       DO NOTHING`,
      [userId, taskId, type, message]
    );
  } catch (err) {
    console.error('Error creating notification:', err.message);
  }
};

// Midpoint nudge: notify coaches when 50% of task time has elapsed
const midpointNudgeJob = async () => {
  try {
    // Calculate midpoint: assigned_at + (due_date - assigned_at) / 2
    const candidates = await db.queryAll(`
      SELECT t.id, t.coach_id, t.title, t.assigned_at, t.due_date
      FROM tasks t
      WHERE t.status != 'completed'
        AND (t.assigned_at + (t.due_date - t.assigned_at) / 2) <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'midpoint_nudge'
        )
    `);

    for (const task of candidates) {
      const message = `Halfway there! ⚡ Don't let momentum slip — '${task.title}' is due ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. How's it going?`;
      await createNotification(task.coach_id, task.id, 'midpoint_nudge', message);
    }

    if (candidates.length > 0) {
      console.log(`✓ Midpoint nudge: notified ${candidates.length} coach(es)`);
    }
  } catch (e) {
    console.error('Cron midpoint nudge error:', e.message);
  }
};

// Overdue job: mark tasks overdue and notify coaches + admin
const overdueJob = async () => {
  try {
    const overdue = await db.queryAll(`
      SELECT id, coach_id, title
      FROM tasks
      WHERE due_date < NOW()
        AND status NOT IN ('completed', 'overdue')
    `);

    for (const task of overdue) {
      // Mark task as overdue
      await db.run('UPDATE tasks SET status = $1 WHERE id = $2', ['overdue', task.id]);

      // Notify coach
      const coachMessage = `This one slipped by — and that's okay. 💪 Please share what got in the way for '${task.title}' so we can move forward together.`;
      await createNotification(task.coach_id, task.id, 'overdue_nudge', coachMessage);

      // Notify admin
      const adminUser = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      if (adminUser) {
        const adminMessage = `Task '${task.title}' is now overdue.`;
        await createNotification(adminUser.id, task.id, 'overdue_nudge', adminMessage);
      }
    }

    if (overdue.length > 0) {
      console.log(`✓ Overdue job: marked ${overdue.length} task(s) overdue, notified coaches and admin`);
    }
  } catch (e) {
    console.error('Cron overdue job error:', e.message);
  }
};

let scheduledTasks = [];

const scheduleJobs = () => {
  // Schedule both jobs to run hourly (at minute 0 of every hour)
  const task1 = cron.schedule('0 * * * *', midpointNudgeJob);
  const task2 = cron.schedule('0 * * * *', overdueJob);

  task1.unref?.();
  task2.unref?.();

  scheduledTasks = [task1, task2];
  console.log('✓ Cron jobs scheduled (hourly)');
};

const stopJobs = () => {
  scheduledTasks.forEach(task => task?.stop?.());
  scheduledTasks = [];
};

module.exports = { scheduleJobs, stopJobs };
