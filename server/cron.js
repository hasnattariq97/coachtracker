/**
 * @phase 5
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-07T00:00:00Z
 * @beads ["cron-postgresql-migration"]
 */

const cron = require('node-cron');
const db = require('./db');

const createNotification = async (userId, taskId, type, message) => {
  try {
    await db.prepare(
      'INSERT INTO notifications (user_id, task_id, type, message) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, task_id, type) DO NOTHING'
    ).run(userId, taskId, type, message);
  } catch (err) {
    console.error('Error creating notification:', err.message);
  }
};

const midpointNudgeJob = async () => {
  try {
    const candidates = await db.prepare(`
      SELECT t.id, t.coach_id, t.title, t.assigned_at, t.due_date
      FROM tasks t
      WHERE t.status != 'completed'
        AND t.assigned_at + ((t.due_date - t.assigned_at) / 2) <= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'midpoint_nudge'
        )
    `).all();

    if (!candidates || candidates.length === 0) {
      return;
    }

    for (const task of candidates) {
      const dueDate = new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const message = `Halfway there! ⚡ Don't let momentum slip — '${task.title}' is due ${dueDate}. How's it going?`;
      await createNotification(task.coach_id, task.id, 'midpoint_nudge', message);
    }

    console.log(`[Cron] ✓ Midpoint nudge: notified ${candidates.length} coach(es)`);
  } catch (e) {
    console.error('[Cron] Midpoint nudge error:', e.message);
  }
};

const overdueJob = async () => {
  try {
    const overdue = await db.prepare(`
      SELECT id, coach_id, title
      FROM tasks
      WHERE due_date < NOW()
        AND status NOT IN ('completed', 'overdue')
    `).all();

    if (!overdue || overdue.length === 0) {
      return;
    }

    for (const task of overdue) {
      await db.prepare('UPDATE tasks SET status = $1 WHERE id = $2').run('overdue', task.id);

      const coachMessage = `This one slipped by — and that's okay. 💪 Please share what got in the way for '${task.title}' so we can move forward together.`;
      await createNotification(task.coach_id, task.id, 'overdue_nudge', coachMessage);

      const adminUser = await db.prepare("SELECT id FROM users WHERE role = $1 LIMIT 1").get('admin');
      if (adminUser) {
        const adminMessage = `Task '${task.title}' is now overdue.`;
        await createNotification(adminUser.id, task.id, 'overdue_nudge', adminMessage);
      }
    }

    console.log(`[Cron] ✓ Overdue job: marked ${overdue.length} task(s) overdue, notified coaches and admin`);
  } catch (e) {
    console.error('[Cron] Overdue job error:', e.message);
  }
};

let scheduledTasks = [];

const scheduleJobs = () => {
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
