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

/**
 * Generate daily coaching report email HTML
 * @param {string} adminName
 * @param {string} reportDate - YYYY-MM-DD
 * @param {object} summary - { completionRate, totalSupportActions }
 * @param {string[]} recommendations
 * @param {string|null} aiInsights
 * @param {string} dashboardLink
 */
function dailyReportEmail(adminName, reportDate, summary, recommendations, aiInsights, dashboardLink) {
  const completionRate = summary?.completionRate ?? 'N/A';
  const supportActions = summary?.totalSupportActions ?? 0;

  const recList = Array.isArray(recommendations) && recommendations.length > 0
    ? `<ul style="padding-left:20px;line-height:1.8">${recommendations.map(r => `<li>${r}</li>`).join('')}</ul>`
    : '<p style="color:#666">No recommendations for today.</p>';

  const insightsSection = aiInsights
    ? `<h3 style="color:#0D9488">AI Insights</h3>
       <p style="background:#f0fdf9;border-left:4px solid #0D9488;padding:12px 16px;border-radius:4px">${aiInsights}</p>`
    : '';

  return `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0D9488;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">Daily Coaching Report</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0">${reportDate}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p>Hi ${adminName},</p>
        <p>Here's your autonomous coaching system summary for today.</p>

        <h3 style="color:#0D9488">At a Glance</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr>
            <td style="padding:12px;background:#f9fafb;border-radius:6px;text-align:center;width:50%">
              <div style="font-size:28px;font-weight:700;color:#0D9488">${completionRate}%</div>
              <div style="font-size:13px;color:#666">Completion Rate</div>
            </td>
            <td style="width:16px"></td>
            <td style="padding:12px;background:#f9fafb;border-radius:6px;text-align:center;width:50%">
              <div style="font-size:28px;font-weight:700;color:#EA580C">${supportActions}</div>
              <div style="font-size:13px;color:#666">Support Actions Taken</div>
            </td>
          </tr>
        </table>

        <h3 style="color:#0D9488">Recommendations</h3>
        ${recList}

        ${insightsSection}

        <p style="margin-top:32px">
          <a href="${dashboardLink}" style="background:#0D9488;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">
            View Agent Dashboard →
          </a>
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px">
          Generated by the Phase 9 Autonomous Agent System. View full details in the Agent Dashboard.
        </p>
      </div>
    </div>
  `;
}

module.exports = {
  taskAssignmentEmail,
  midpointNudgeEmail,
  overdueAlertEmail,
  delayReasonSubmittedEmail,
  dailyReportEmail,
};
