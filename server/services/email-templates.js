/**
 * @phase 8
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-08T00:00:00Z
 * @beads []
 */

/**
 * Generate task assignment email HTML
 * @param {string} coachName - Coach's name
 * @param {string} taskTitle - Task title
 * @param {string} dueDate - Due date (formatted)
 * @param {string} taskLink - URL to task details
 * @returns {string} HTML email content
 */
function taskAssignmentEmail(coachName, taskTitle, dueDate, taskLink) {
  return `
    <h2>Hi ${coachName},</h2>
    <p>You've got a new challenge! 🎯</p>
    <p><strong>${taskTitle}</strong> — make it happen by ${dueDate}.</p>
    <p><a href="${taskLink}" style="background: #0D9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View task →</a></p>
    <p style="color: #666; font-size: 12px;">Coaching builds the future. You've got this.</p>
  `;
}

/**
 * Generate midpoint nudge email HTML
 * @param {string} coachName - Coach's name
 * @param {string} taskTitle - Task title
 * @param {string} dueDate - Due date (formatted)
 * @param {string} taskLink - URL to task details
 * @returns {string} HTML email content
 */
function midpointNudgeEmail(coachName, taskTitle, dueDate, taskLink) {
  return `
    <h2>Hi ${coachName},</h2>
    <p>Halfway there! ⚡</p>
    <p>Don't let momentum slip — <strong>${taskTitle}</strong> is due ${dueDate}. How's it going?</p>
    <p><a href="${taskLink}" style="background: #0D9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Check progress →</a></p>
  `;
}

/**
 * Generate overdue alert email HTML
 * @param {string} coachName - Coach's name
 * @param {Array} overdueTasks - Array of {title, dueDate}
 * @param {string} dashboardLink - URL to coach dashboard
 * @returns {string} HTML email content
 */
function overdueAlertEmail(coachName, overdueTasks, dashboardLink) {
  const taskList = overdueTasks
    .map(t => `<li>${t.title} (due ${t.dueDate})</li>`)
    .join('');

  return `
    <h2>Hi ${coachName},</h2>
    <p>This one slipped by — and that's okay. 💪</p>
    <p>You have ${overdueTasks.length} overdue task(s):</p>
    <ul>${taskList}</ul>
    <p>Please share what got in the way so we can move forward together.</p>
    <p><a href="${dashboardLink}" style="background: #EA580C; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Go to dashboard →</a></p>
  `;
}

/**
 * Generate delay reason submitted email HTML
 * @param {string} adminName - Admin's name
 * @param {string} coachName - Coach's name
 * @param {string} taskTitle - Task title
 * @param {string} reason - Coach's delay reason
 * @returns {string} HTML email content
 */
function delayReasonSubmittedEmail(adminName, coachName, taskTitle, reason) {
  return `
    <h2>Hi ${adminName},</h2>
    <p><strong>${coachName}</strong> submitted a reason for the overdue task <strong>${taskTitle}</strong>:</p>
    <blockquote style="border-left: 3px solid #0D9488; padding-left: 15px; color: #666;">
      ${reason}
    </blockquote>
    <p>Follow up to understand any blockers and adjust support as needed.</p>
  `;
}

module.exports = {
  taskAssignmentEmail,
  midpointNudgeEmail,
  overdueAlertEmail,
  delayReasonSubmittedEmail,
};
