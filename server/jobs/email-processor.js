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
} = require('../services/email-templates.js');

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
    const pending = db
      .prepare('SELECT * FROM email_queue WHERE status = "pending" ORDER BY created_at LIMIT 50')
      .all();

    console.log(`[EMAIL PROCESSOR] Processing ${pending.length} pending emails`);

    for (const item of pending) {
      try {
        // Get task details
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(item.task_id);
        if (!task) {
          console.log(`[EMAIL PROCESSOR] Task ${item.task_id} not found, skipping`);
          db.prepare(
            'UPDATE email_queue SET status = "skipped", error_message = "task_not_found" WHERE id = ?'
          ).run(item.id);
          continue;
        }

        // Get coach details (if applicable)
        let coach = null;
        if (item.coach_id) {
          coach = db.prepare('SELECT * FROM users WHERE id = ?').get(item.coach_id);
          if (!coach) {
            console.log(`[EMAIL PROCESSOR] Coach ${item.coach_id} not found, skipping`);
            db.prepare(
              'UPDATE email_queue SET status = "skipped", error_message = "coach_not_found" WHERE id = ?'
            ).run(item.id);
            continue;
          }
        }

        // Get admin details (if applicable)
        let admin = null;
        if (item.admin_id) {
          admin = db.prepare('SELECT * FROM users WHERE id = ?').get(item.admin_id);
          if (!admin) {
            console.log(`[EMAIL PROCESSOR] Admin ${item.admin_id} not found, skipping`);
            db.prepare(
              'UPDATE email_queue SET status = "skipped", error_message = "admin_not_found" WHERE id = ?'
            ).run(item.id);
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
          db.prepare(
            'UPDATE email_queue SET status = "skipped", error_message = "task_completed" WHERE id = ?'
          ).run(item.id);
          continue;
        }

        // Determine recipient and generate email
        let to, subject, html;

        if (item.type === 'assignment') {
          to = coach.email;
          subject = `New challenge: ${task.title}`;
          const taskLink = `http://localhost:5173/coach/tasks/${task.id}`;
          html = taskAssignmentEmail(coach.name, task.title, task.due_date, taskLink);
        } else if (item.type === 'midpoint_nudge') {
          to = coach.email;
          subject = `Halfway there: ${task.title}`;
          const taskLink = `http://localhost:5173/coach/tasks/${task.id}`;
          html = midpointNudgeEmail(coach.name, task.title, task.due_date, taskLink);
        } else if (item.type === 'overdue') {
          to = coach.email;
          subject = `Overdue: ${task.title}`;
          const dashboardLink = `http://localhost:5173/coach`;
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
          db.prepare(
            'INSERT INTO email_logs (coach_id, admin_id, type, task_id, recipient, status) VALUES (?, ?, ?, ?, ?, "success")'
          ).run(item.coach_id, item.admin_id, item.type, item.task_id, to);

          // Update queue
          db.prepare('UPDATE email_queue SET status = "sent" WHERE id = ?').run(item.id);
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
          db.prepare(
            'INSERT INTO email_logs (coach_id, admin_id, type, task_id, recipient, status, error_message) VALUES (?, ?, ?, ?, ?, "failed", ?)'
          ).run(item.coach_id, item.admin_id, item.type, item.task_id, '(unknown)', error.message);

          db.prepare(
            'UPDATE email_queue SET status = "failed", error_message = ?, attempt = ? WHERE id = ?'
          ).run(error.message, item.attempt, item.id);

          console.log(`[EMAIL PROCESSOR] Email ${item.id} failed after 3 attempts`);
        } else {
          // Increment attempt, keep pending for next retry
          db.prepare('UPDATE email_queue SET attempt = ? WHERE id = ?').run(
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
