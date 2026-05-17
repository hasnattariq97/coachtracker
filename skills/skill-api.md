# skill-api.md — Express Route Conventions

## Router Structure
```javascript
// server/index.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const coachesRoutes = require('./routes/coaches');
const tasksRoutes = require('./routes/tasks');
const notificationsRoutes = require('./routes/notifications');
const {verifyJWT} = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/coaches', verifyJWT, coachesRoutes);
app.use('/api/tasks', verifyJWT, tasksRoutes);
app.use('/api/notifications', verifyJWT, notificationsRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({error: 'Internal server error'});
});

app.listen(3001, () => console.log('Server running on port 3001'));
```

## Route File Pattern (e.g., coaches.js)
```javascript
// server/routes/coaches.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const {requireAdmin} = require('../auth');

// GET all coaches (admin only)
router.get('/', requireAdmin, (req, res) => {
  try {
    const coaches = db.prepare(`
      SELECT u.*, 
        COUNT(CASE WHEN t.status IN ('assigned', 'in_progress') THEN 1 END) as assigned,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN t.status = 'overdue' THEN 1 END) as overdue
      FROM users u
      LEFT JOIN tasks t ON u.id = t.coach_id
      WHERE u.role = 'coach'
      GROUP BY u.id
    `).all();
    res.json(coaches);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// POST create coach (admin only)
router.post('/', requireAdmin, (req, res) => {
  const {name, email, password} = req.body;
  
  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({error: 'Missing required fields'});
  }
  if (name.length > 100) {
    return res.status(400).json({error: 'Name too long'});
  }
  
  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'coach')
    `);
    const result = stmt.run(name, email, hash);
    res.json({id: result.lastInsertRowid, name, email, role: 'coach'});
  } catch (e) {
    if (e.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({error: 'Email already exists'});
    } else {
      res.status(500).json({error: e.message});
    }
  }
});

// PUT update coach (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  const {name, email} = req.body;
  const id = parseInt(req.params.id);
  
  if (!name && !email) {
    return res.status(400).json({error: 'Nothing to update'});
  }
  
  try {
    const updates = [];
    const values = [];
    if (name) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email);
    }
    values.push(id);
    
    const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    res.json({id});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// DELETE coach (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  try {
    db.prepare('DELETE FROM tasks WHERE coach_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(id, 'coach');
    res.json({success: true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

module.exports = router;
```

## Key Patterns

### Input Validation
```javascript
// Always validate at route level
if (!req.body.title || req.body.title.length === 0) {
  return res.status(400).json({error: 'Title is required'});
}
if (req.body.title.length > 255) {
  return res.status(400).json({error: 'Title too long (max 255 chars)'});
}
```

### Authorization
```javascript
// For routes that access user-specific data:
router.get('/:id', requireCoach, (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  
  // Coach can only read their own tasks
  if (task.coach_id !== req.user.id) {
    return res.status(403).json({error: 'Access denied'});
  }
  
  res.json(task);
});
```

### Error Handling
```javascript
// Try-catch in each route
try {
  // database operation
  res.json(result);
} catch (e) {
  if (e.message.includes('UNIQUE constraint')) {
    res.status(409).json({error: 'Resource already exists'});
  } else if (e.message.includes('FOREIGN KEY')) {
    res.status(400).json({error: 'Invalid reference'});
  } else {
    console.error(e);
    res.status(500).json({error: 'Internal server error'});
  }
}
```

### Creating Notifications
```javascript
// When an action happens, create related notifications
router.post('/', requireAdmin, (req, res) => {
  // ... create task ...
  
  // Create 'assigned' notification for coach
  const notifStmt = db.prepare(`
    INSERT INTO notifications (user_id, task_id, type, message)
    VALUES (?, ?, 'assigned', ?)
  `);
  notifStmt.run(task.coach_id, newTaskId, 
    `You've got a new challenge! ${task.title} — make it happen by ${task.due_date}.`
  );
  
  // Also notify admin
  notifStmt.run(req.user.id, newTaskId, 
    `Task ${task.title} assigned to ${coachName}`
  );
  
  res.json(result);
});
```
