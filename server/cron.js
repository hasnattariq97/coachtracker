/**
 * @phase 5
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-03T00:00:00Z
 * @beads []
 */

const cron = require('node-cron');
const db = require('./db');

const createNotification = (userId, taskId, type, message) => {
  db.prepare(
    'INSERT OR IGNORE INTO notifications (user_id, task_id, type, message) VALUES (?, ?, ?, ?)'
  ).run(userId, taskId, type, message);
};

const midpointNudgeJob = () => {
  try {
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

    for (const task of candidates) {
      const message = `Halfway there! ⚡ Don't let momentum slip — '${task.title}' is due ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. How's it going?`;
      createNotification(task.coach_id, task.id, 'midpoint_nudge', message);
    }

    if (candidates.length > 0) {
      console.log(`✓ Midpoint nudge: notified ${candidates.length} coach(es)`);
    }
  } catch (e) {
    console.error('Cron midpoint nudge error:', e);
  }
};

const overdueJob = () => {
  try {
    const overdue = db.prepare(`
      SELECT id, coach_id, title
      FROM tasks
      WHERE due_date < datetime('now')
        AND status NOT IN ('completed', 'overdue')
    `).all();

    for (const task of overdue) {
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('overdue', task.id);

      const coachMessage = `This one slipped by — and that's okay. 💪 Please share what got in the way for '${task.title}' so we can move forward together.`;
      createNotification(task.coach_id, task.id, 'overdue_nudge', coachMessage);

      const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
      if (adminUser) {
        const adminMessage = `Task '${task.title}' is now overdue.`;
        createNotification(adminUser.id, task.id, 'overdue_nudge', adminMessage);
      }
    }

    if (overdue.length > 0) {
      console.log(`✓ Overdue job: marked ${overdue.length} task(s) overdue, notified coaches and admin`);
    }
  } catch (e) {
    console.error('Cron overdue job error:', e);
  }
};

const scheduleJobs = () => {
  cron.schedule('0 * * * *', midpointNudgeJob);
  cron.schedule('0 * * * *', overdueJob);
  console.log('✓ Cron jobs scheduled (hourly)');
};

module.exports = { scheduleJobs };
