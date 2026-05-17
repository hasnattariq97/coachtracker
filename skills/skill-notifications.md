# skill-notifications.md — In-App Notification System

## Database Table
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  task_id INTEGER,
  type TEXT NOT NULL CHECK (type IN ('assigned', 'midpoint_nudge', 'overdue_nudge', 'completed', 'delay_submitted')),
  message TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

## Notification Types & Coaching-Tone Messages

### Type: 'assigned'
When: Admin creates a task and assigns it to a coach
Recipient: Coach (user_id = coach_id)
Message template: "You've got a new challenge! 🎯 '[Task Title]' — let's make it happen by [due_date formatted]."
Example: "You've got a new challenge! 🎯 'Q2 Growth Strategy' — let's make it happen by May 15, 2026."

### Type: 'midpoint_nudge'
When: Cron job detects task is at the midpoint (50% of time elapsed)
Recipient: Coach
Message template: "Halfway there! ⚡ Don't let momentum slip — '[Task Title]' is due [due_date]. How's it going?"
Example: "Halfway there! ⚡ Don't let momentum slip — 'Q2 Growth Strategy' is due May 15. How's it going?"

### Type: 'overdue_nudge'
When: Cron job detects task is past due date
Recipient: Coach
Message template: "This one slipped by — and that's okay. 💪 Please share what got in the way for '[Task Title]' so we can move forward together."
Example: "This one slipped by — and that's okay. 💪 Please share what got in the way for 'Q2 Growth Strategy' so we can move forward together."

### Type: 'completed'
When: Coach marks a task as complete
Recipient: Admin (req.user.id = the admin who assigned it... or just send to all admins)
Message template: "[Coach Name] just completed '[Task Title]'! 🎉"
Example: "Sarah just completed 'Q2 Growth Strategy'! 🎉"

### Type: 'delay_submitted'
When: Coach submits a delay reason for an overdue task
Recipient: Admin
Message template: "[Coach Name] submitted a reason for delay on '[Task Title]'"
Example: "Sarah submitted a reason for delay on 'Q2 Growth Strategy'"

## Backend: Notifications Routes (server/routes/notifications.js)
```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all notifications for logged-in user
router.get('/', (req, res) => {
  try {
    const notifs = db.prepare(`
      SELECT n.*, t.title as task_title
      FROM notifications n
      LEFT JOIN tasks t ON n.task_id = t.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
    `).all(req.user.id);
    res.json(notifs);
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// PUT mark single notification as read
router.put('/:id/read', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Verify ownership
    const notif = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(id);
    if (!notif || notif.user_id !== req.user.id) {
      return res.status(403).json({error: 'Access denied'});
    }
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    res.json({success: true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

// PUT mark all notifications as read for logged-in user
router.put('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
    res.json({success: true});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

module.exports = router;
```

## Frontend: NotificationBell Component (client/src/components/NotificationBell.jsx)
```javascript
import {useState, useEffect, useContext} from 'react';
import {AuthContext} from '../context/AuthContext';
import api from '../api';
import timeago from 'timeago.js';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const {user} = useContext(AuthContext);
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const {data} = await api.get('/notifications');
        setNotifications(data);
      } catch (e) {
        console.error('Failed to fetch notifications', e);
      }
    };
    
    // Fetch immediately on mount
    fetchNotifs();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(notifs => notifs.map(n => ({...n, read: 1})));
    } catch (e) {
      console.error('Failed to mark all read', e);
    }
  };
  
  const typeIcon = (type) => {
    switch (type) {
      case 'assigned': return '🎯';
      case 'midpoint_nudge': return '⚡';
      case 'overdue_nudge': return '⚠️';
      case 'completed': return '🎉';
      case 'delay_submitted': return '📝';
      default: return '📢';
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-gray-700 rounded"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      
      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    n.read ? '' : 'bg-blue-50'
                  }`}
                  onClick={async () => {
                    if (!n.read) {
                      await api.put(`/notifications/${n.id}/read`);
                      setNotifications(notifs =>
                        notifs.map(notif => notif.id === n.id ? {...notif, read: 1} : notif)
                      );
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{typeIcon(n.type)}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{timeago.format(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

## Creating Notifications on Actions

### Example: Assign Task Route
```javascript
// In server/routes/tasks.js - POST /api/tasks
router.post('/', requireAdmin, (req, res) => {
  const {coach_id, title, description, priority, due_date} = req.body;
  
  // Validate...
  
  try {
    // Insert task
    const stmt = db.prepare(`
      INSERT INTO tasks (coach_id, title, description, priority, due_date, assigned_at, status)
      VALUES (?, ?, ?, ?, ?, datetime('now'), 'assigned')
    `);
    const result = stmt.run(coach_id, title, description, priority, due_date);
    const taskId = result.lastInsertRowid;
    
    // Create notification for coach
    const dueDateObj = new Date(due_date);
    const dueDateStr = dueDateObj.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
    
    const notifStmt = db.prepare(`
      INSERT INTO notifications (user_id, task_id, type, message)
      VALUES (?, ?, 'assigned', ?)
    `);
    notifStmt.run(
      coach_id,
      taskId,
      `You've got a new challenge! 🎯 '${title}' — let's make it happen by ${dueDateStr}.`
    );
    
    res.json({id: taskId, ...req.body});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});
```

## Idempotency (Prevent Double-Nudge)
```javascript
// Always check if notification of same type already exists before inserting
const existingNotif = db.prepare(`
  SELECT 1 FROM notifications
  WHERE task_id = ? AND type = ? AND user_id = ?
  LIMIT 1
`).get(taskId, type, userId);

if (!existingNotif) {
  db.prepare(`
    INSERT INTO notifications (user_id, task_id, type, message)
    VALUES (?, ?, ?, ?)
  `).run(userId, taskId, type, message);
}
```
