/**
 * @phase 8
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-08T00:00:00Z
 * @beads ["email-integration-phase8"]
 */

const cron = require('node-cron');
const db = require('./db');
const { processEmailQueue } = require('./jobs/email-processor.js');
const { createEmailQueue } = require('./services/email.js');
const AgentOrchestrator = require('./agents/orchestrator');

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
      await createEmailQueue('midpoint_nudge', task.coach_id, task.id);
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
      await createEmailQueue('overdue', task.coach_id, task.id);

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
  const orchestrator = new AgentOrchestrator();

  const task1 = cron.schedule('0 * * * *', midpointNudgeJob);
  const task2 = cron.schedule('0 * * * *', overdueJob);
  const task3 = cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running email processor job');
    await processEmailQueue();
  });

  // Phase 9: 30-minute agent cycle (Monitoring → Support)
  // Schedule: Every 30 minutes (*/30 in cron = 00:00, 00:30, 01:00, 01:30, etc.)
  const task4 = cron.schedule('*/30 * * * *', async () => {
    console.log('\n🔔 [CRON] 30-minute agent cycle triggered');
    try {
      await orchestrator.run30MinuteCycle();
    } catch (err) {
      console.error('[CRON] 30-minute cycle failed:', err.message);
    }
  });

  // Phase 9: Daily cycle (Reporting Agent)
  // Schedule: Daily at 9am UTC (0 9 = 09:00)
  const task5 = cron.schedule('0 9 * * *', async () => {
    console.log('\n🔔 [CRON] Daily reporting cycle triggered (9am UTC)');
    try {
      await orchestrator.runDailyCycle();
    } catch (err) {
      console.error('[CRON] Daily cycle failed:', err.message);
    }
  });

  task1.unref?.();
  task2.unref?.();
  task3.unref?.();
  task4.unref?.();
  task5.unref?.();

  scheduledTasks = [task1, task2, task3, task4, task5];
  console.log('✓ Cron jobs scheduled (hourly nudges, email processor, Phase 9 agent cycles)');
};

const stopJobs = () => {
  scheduledTasks.forEach(task => task?.stop?.());
  scheduledTasks = [];
};

module.exports = { scheduleJobs, stopJobs };
