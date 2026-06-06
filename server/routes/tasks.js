/**
 * @phase 3
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-03T00:00:00Z
 * @beads []
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin, requireCoach } = require('../auth');
const { queueCoachingInsights } = require('./coaching-insights');

const createNotification = async (userId, taskId, type, message) => {
  try {
    await db.prepare(
      'INSERT INTO notifications (user_id, task_id, type, message) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, task_id, type) DO NOTHING'
    ).run(userId, taskId, type, message);
  } catch (err) {
    console.error('[createNotification] Error:', err.message);
  }
};

const formatDueDate = (dueDate) => {
  const d = new Date(dueDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const validateDueDate = (dueDate) => {
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) {
    return { valid: false, error: 'Invalid due_date format' };
  }
  if (d.getTime() < Date.now()) {
    return { valid: false, error: 'Due date must be in the future' };
  }
  return { valid: true };
};

const VALID_STATUSES = ['assigned', 'in_progress', 'completed', 'overdue'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

const getTaskWithCoachName = async (taskId) => {
  const task = await db.prepare(`
    SELECT t.*, u.name as coach_name,
      EXTRACT(DAY FROM (t.due_date - NOW()))::INTEGER as days_left
    FROM tasks t
    JOIN users u ON t.coach_id = u.id
    WHERE t.id = ?
  `).get(taskId);

  if (task) {
    try {
      task.links = task.links ? JSON.parse(task.links) : [];
    } catch (e) {
      console.error('Error parsing links for task', taskId, ':', e);
      task.links = [];
    }
  }
  return task;
};

const getTasksQuery = async (whereClause = '', params = []) => {
  const sql = `
    SELECT t.*, u.name as coach_name,
      EXTRACT(DAY FROM (t.due_date - NOW()))::INTEGER as days_left
    FROM tasks t
    JOIN users u ON t.coach_id = u.id
    ${whereClause ? 'WHERE ' + whereClause : ''}
    ORDER BY t.due_date ASC
  `;
  const tasks = await db.prepare(sql).all(...params);
  return tasks.map(task => {
    try {
      return {
        ...task,
        links: task.links ? JSON.parse(task.links) : []
      };
    } catch (e) {
      console.error('Error parsing links for task', task.id, ':', e);
      return {
        ...task,
        links: []
      };
    }
  });
};

// BATCH A: Read Endpoints

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { coach_id, status } = req.query;
    let whereClause = '';
    const params = [];

    if (coach_id) {
      const id = Number.parseInt(coach_id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid coach_id' });
      }
      whereClause += 't.coach_id = ?';
      params.push(id);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      if (whereClause) whereClause += ' AND ';
      whereClause += 't.status = ?';
      params.push(status);
    }

    const tasks = await getTasksQuery(whereClause, params);
    res.json(tasks);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mine', requireCoach, async (req, res) => {
  try {
    const tasks = await getTasksQuery('t.coach_id = ?', [req.user.id]);
    res.json(tasks);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task id' });
  }

  try {
    const task = await getTaskWithCoachName(id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (req.user.role === 'coach' && task.coach_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// BATCH B: Write Endpoints

router.post('/', requireAdmin, async (req, res) => {
  const { coach_ids, coach_id, title, description, priority, due_date, links } = req.body;

  console.log('[DEBUG] POST /api/tasks - links received:', links);

  // Support both single coach_id (legacy) and multiple coach_ids (new)
  const coachIdsArray = coach_ids && Array.isArray(coach_ids) ? coach_ids : (coach_id ? [coach_id] : []);

  if (coachIdsArray.length === 0 || !title || !priority || !due_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (title.length === 0 || title.length > 255) {
    return res.status(400).json({ error: 'Title must be 1-255 characters' });
  }

  if (description && description.length > 2000) {
    return res.status(400).json({ error: 'Description too long (max 2000 characters)' });
  }

  if (!VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  const dueDateValidation = validateDueDate(due_date);
  if (!dueDateValidation.valid) {
    return res.status(400).json({ error: dueDateValidation.error });
  }

  try {
    // Validate all coach IDs exist
    const validCoaches = [];
    for (const cId of coachIdsArray) {
      const parsed = Number.parseInt(cId, 10);
      if (!Number.isInteger(parsed)) {
        return res.status(400).json({ error: `Invalid coach_id: ${cId}` });
      }
      const coach = await db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(parsed, 'coach');
      if (!coach) {
        return res.status(400).json({ error: `Invalid coach_id: ${parsed}` });
      }
      validCoaches.push(parsed);
    }

    // Create tasks in loop (one per coach)
    const insertStmt = db.prepare(`
      INSERT INTO tasks (coach_id, title, description, priority, due_date, status, assigned_at, links)
      VALUES (?, ?, ?, ?, ?, 'assigned', NOW(), ?)
      RETURNING id
    `);

    const createdTasks = [];
    const dueDateFormatted = formatDueDate(due_date);
    const notificationMessage = `You've got a new challenge! 🎯 '${title}' — let's make it happen by ${dueDateFormatted}.`;

    const linksJson = links && links.length > 0 ? JSON.stringify(links) : null;
    console.log('[DEBUG] linksJson:', linksJson);
    console.log('[DEBUG] typeof linksJson:', typeof linksJson);

    for (const coachId of validCoaches) {
      console.log('[DEBUG] Inserting task with:', { coachId, title, priority, due_date, linksJson });
      const result = await insertStmt.run(coachId, title, description || null, priority, due_date, linksJson);
      const taskId = result.rows[0]?.id;
      createdTasks.push({ id: taskId, coach_id: coachId });
      await createNotification(coachId, taskId, 'assigned', notificationMessage);
    }

    // Backward compatible: single coach returns { id, ... }, multiple returns { tasks: [...] }
    if (createdTasks.length === 1) {
      const t = createdTasks[0];
      res.json({
        id: t.id,
        coach_id: t.coach_id,
        title,
        description: description !== undefined ? description : null,
        priority,
        due_date,
        links: links || [],
        status: 'assigned'
      });
    } else {
      res.json({
        tasks: createdTasks.map(t => ({
          id: t.id,
          coach_id: t.coach_id,
          title,
          description: description !== undefined ? description : null,
          priority,
          due_date,
          links: links || [],
          status: 'assigned'
        }))
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task id' });
  }

  const { title, description, priority, due_date } = req.body;

  if (!title && !description && !priority && !due_date) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  if (title !== undefined && (title.length === 0 || title.length > 255)) {
    return res.status(400).json({ error: 'Title must be 1-255 characters' });
  }

  if (description !== undefined && description && description.length > 2000) {
    return res.status(400).json({ error: 'Description too long (max 2000 characters)' });
  }

  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }

  if (due_date !== undefined) {
    const dueDateValidation = validateDueDate(due_date);
    if (!dueDateValidation.valid) {
      return res.status(400).json({ error: dueDateValidation.error });
    }
  }

  try {
    const task = await db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`);
    await stmt.run(...values);

    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task id' });
  }

  try {
    const task = await db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// BATCH C: Coach Actions

router.put('/:id/complete', requireCoach, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task id' });
  }

  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.coach_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (task.status === 'completed') {
      return res.status(409).json({ error: 'Task already completed' });
    }

    const stmt = db.prepare(`
      UPDATE tasks
      SET status = 'completed', completed_at = NOW()
      WHERE id = ?
    `);
    await stmt.run(id);

    const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      const coach = await db.prepare('SELECT name FROM users WHERE id = ?').get(task.coach_id);
      const message = `🎉 ${coach.name} just completed '${task.title}'!`;
      await createNotification(admin.id, id, 'completed', message);
    }

    // Queue coaching insights (async, non-blocking)
    queueCoachingInsights(req.user.id, id, 'completion');

    res.json({
      id,
      status: 'completed',
      completed_at: new Date().toISOString()
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/delay-reason', requireCoach, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid task id' });
  }

  const { delay_reason } = req.body;

  if (!delay_reason || delay_reason.length === 0) {
    return res.status(400).json({ error: 'Delay reason is required' });
  }

  if (typeof delay_reason !== 'string') {
    return res.status(400).json({ error: 'Delay reason must be a string' });
  }

  const trimmed = delay_reason.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Delay reason cannot be only whitespace' });
  }

  if (trimmed.length > 1000) {
    return res.status(400).json({ error: 'Delay reason too long (max 1000 characters)' });
  }

  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.coach_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (task.status === 'completed') {
      return res.status(409).json({ error: 'Cannot submit delay reason for completed task' });
    }

    await db.prepare('UPDATE tasks SET delay_reason = ? WHERE id = ?').run(trimmed, id);

    const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      const coach = await db.prepare('SELECT name FROM users WHERE id = ?').get(task.coach_id);
      const message = `${coach.name} submitted a reason for delay on '${task.title}'`;
      await createNotification(admin.id, id, 'delay_submitted', message);
    }

    // Queue coaching insights (async, non-blocking)
    queueCoachingInsights(req.user.id, id, 'delay');

    res.json({
      id,
      delay_reason: trimmed
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
