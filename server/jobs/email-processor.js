/**
 * @phase 8
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-08T00:00:00Z
 * @beads []
 */

const db = require('../db.js');
const { sendEmail } = require('../services/email.js');
const {
  taskAssignmentEmail,
  midpointNudgeEmail,
  overdueAlertEmail,
  delayReasonSubmittedEmail,
  dailyReportEmail,
} = require('../services/email-templates.js');

const DASHBOARD_URL = `${process.env.BASE_URL || 'https://spectacular-connection-production-d07b.up.railway.app'}/admin/agent-dashboard`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://coachtracker-theta.vercel.app';

/**
 * Process pending emails from queue
 * Fetches up to 50 pending emails, generates content, sends via Resend API,
 * logs results to email_logs table, and updates queue status.
 * Implements retry logic: max 3 attempts per email.
 *
 * @returns {Promise<void>}
 */
async function processEmailQueue() {
  try {
    // Get pending emails, oldest first, limit 50
    const pending = await db
      .prepare('SELECT * FROM email_queue WHERE status = ? ORDER BY created_at LIMIT 50')
      .all('pending');

    console.log(`[EMAIL PROCESSOR] Processing ${pending.length} pending emails`);

    for (const item of pending) {
      try {
        // Handle daily report separately — no task_id or coach_id
        if (item.type === 'daily_report') {
          const admin = await db.prepare('SELECT * FROM users WHERE id = ?').get(item.admin_id);
          if (!admin) {
            await db.prepare('UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?')
              .run('skipped', 'admin_not_found', item.id);
            continue;
          }

          const report = await db.prepare(
            'SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT 1'
          ).get();

          if (!report) {
            await db.prepare('UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?')
              .run('skipped', 'no_report_found', item.id);
            continue;
          }

          const summary = JSON.parse(report.summary_json || '{}');
          const recommendations = JSON.parse(report.recommendations_json || '[]');
          const html = dailyReportEmail(
            admin.name, report.report_date, summary, recommendations,
            report.insights, DASHBOARD_URL
          );

          console.log(`[EMAIL PROCESSOR] Sending daily_report email to ${admin.email}`);
          const result = await sendEmail(
            admin.email,
            `Daily Coaching Report — ${report.report_date}`,
            html
          );

          if (result.success || result.id) {
            await db.prepare('UPDATE email_queue SET status = ? WHERE id = ?').run('sent', item.id);
            await db.prepare(
              'INSERT INTO email_logs (admin_id, type, recipient, status) VALUES (?, ?, ?, ?)'
            ).run(item.admin_id, 'daily_report', admin.email, 'success');
            console.log(`[EMAIL PROCESSOR] Daily report sent to ${admin.email}`);
          } else {
            throw new Error(`Send failed: ${JSON.stringify(result)}`);
          }
          continue;
        }

        // Get task details
        const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(item.task_id);
        if (!task) {
          console.log(`[EMAIL PROCESSOR] Task ${item.task_id} not found, skipping`);
          await db.prepare(
            'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?'
          ).run('skipped', 'task_not_found', item.id);
          continue;
        }

        // Get coach details (if applicable)
        let coach = null;
        if (item.coach_id) {
          coach = await db.prepare('SELECT * FROM users WHERE id = ?').get(item.coach_id);
          if (!coach) {
            console.log(`[EMAIL PROCESSOR] Coach ${item.coach_id} not found, skipping`);
            await db.prepare(
              'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?'
            ).run('skipped', 'coach_not_found', item.id);
            continue;
          }
        }

        // Get admin details (if applicable)
        let admin = null;
        if (item.admin_id) {
          admin = await db.prepare('SELECT * FROM users WHERE id = ?').get(item.admin_id);
          if (!admin) {
            console.log(`[EMAIL PROCESSOR] Admin ${item.admin_id} not found, skipping`);
            await db.prepare(
              'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?'
            ).run('skipped', 'admin_not_found', item.id);
            continue;
          }
        }

        // Skip if task already completed
        if (
          task.status === 'completed' &&
          ['assignment', 'midpoint_nudge', 'overdue'].includes(item.type)
        ) {
          console.log(
            `[EMAIL PROCESSOR] Task ${item.task_id} already completed, skipping email`
          );
          await db.prepare(
            'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?'
          ).run('skipped', 'task_completed', item.id);
          continue;
        }

        // Determine recipient and generate email
        let to, subject, html;

        if (item.type === 'assignment') {
          to = coach.email;
          subject = `New challenge: ${task.title}`;
          const taskLink = `${FRONTEND_URL}/coach/tasks/${task.id}`;
          html = taskAssignmentEmail(coach.name, task.title, task.due_date, taskLink);
        } else if (item.type === 'midpoint_nudge') {
          to = coach.email;
          subject = `Halfway there: ${task.title}`;
          const taskLink = `${FRONTEND_URL}/coach/tasks/${task.id}`;
          html = midpointNudgeEmail(coach.name, task.title, task.due_date, taskLink);
        } else if (item.type === 'overdue') {
          to = coach.email;
          subject = `Overdue: ${task.title}`;
          const dashboardLink = `${FRONTEND_URL}/coach`;
          html = overdueAlertEmail(coach.name, [task], dashboardLink);
        } else if (item.type === 'delay_submitted') {
          to = admin.email;
          subject = `Delay reason: ${task.title}`;
          html = delayReasonSubmittedEmail(admin.name, coach.name, task.title, task.delay_reason);
        } else {
          throw new Error(`Unknown email type: ${item.type}`);
        }

        // Send email
        console.log(`[EMAIL PROCESSOR] Sending ${item.type} email to ${to}`);
        const result = await sendEmail(to, subject, html);

        if (result.success || result.id) {
          // Log success
          await db.prepare(
            'INSERT INTO email_logs (coach_id, admin_id, type, task_id, recipient, status) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(item.coach_id, item.admin_id, item.type, item.task_id, to, 'success');

          // Update queue
          await db.prepare('UPDATE email_queue SET status = ? WHERE id = ?').run('sent', item.id);
          console.log(`[EMAIL PROCESSOR] Email sent successfully: ${result.id}`);
        } else {
          throw new Error(`Resend returned unexpected response: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        console.error(`[EMAIL PROCESSOR] Error processing email ${item.id}:`, error.message);

        // Increment attempt count
        item.attempt = (item.attempt || 0) + 1;

        if (item.attempt >= 3) {
          // Max retries reached, mark as failed
          await db.prepare(
            'INSERT INTO email_logs (coach_id, admin_id, type, task_id, recipient, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(item.coach_id, item.admin_id, item.type, item.task_id, '(unknown)', 'failed', error.message);

          await db.prepare(
            'UPDATE email_queue SET status = ?, error_message = ?, attempt = ? WHERE id = ?'
          ).run('failed', error.message, item.attempt, item.id);

          console.log(`[EMAIL PROCESSOR] Email ${item.id} failed after 3 attempts`);
        } else {
          // Increment attempt, keep pending for next retry
          await db.prepare('UPDATE email_queue SET attempt = ? WHERE id = ?').run(
            item.attempt,
            item.id
          );
          console.log(
            `[EMAIL PROCESSOR] Email ${item.id} will retry (attempt ${item.attempt}/3)`
          );
        }
      }
    }
  } catch (error) {
    console.error('[EMAIL PROCESSOR] Fatal error:', error.message);
  }
}

module.exports = {
  processEmailQueue,
};
