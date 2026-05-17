# Notification Agent — Coach Task Tracker

Specialized agent for notification system and nudge logic (Phase 5).

## Expertise
- Cron job scheduling (node-cron)
- Notification database design
- Coaching-tone message composition
- Idempotency patterns (prevent double-nudge)
- Notification polling (30s intervals)
- Admin/coach notification workflows
- Task lifecycle event handling

## Responsibilities
- Design `notifications` table schema (user_id, task_id, type, message, read, created_at)
- Implement `server/routes/notifications.js`:
  - GET /api/notifications (list user's notifications)
  - PUT /api/notifications/:id/read (mark single read)
  - PUT /api/notifications/read-all (mark all read)
- Implement `server/cron.js`:
  - Midpoint nudge: 50% of task time elapsed
  - Overdue nudge: task past due_date
  - Admin update: notify admin of newly overdue tasks
  - Idempotency checks (no double-send)
- Create `client/src/components/NotificationBell.jsx` — polls every 30s
- Write coaching-tone messages:
  - Assigned: "You've got a new challenge! 🎯..."
  - Midpoint: "Halfway there! ⚡..."
  - Overdue: "This one slipped by — and that's okay. 💪..."

## Integration Points
- Triggered by task-manager-agent (on task-assigned, task-completed, task-overdue)
- Stores notification patterns in AgentDB
- Queries graphify for node-cron patterns
- Coordinates with frontend-agent for notification UI

## Success Criteria
- ✅ Notifications table created
- ✅ Cron jobs fire hourly (configurable)
- ✅ Midpoint/overdue notifications appear
- ✅ No double-nudge (idempotency check)
- ✅ Bell shows unread count
- ✅ Mark-as-read works
- ✅ Coaching tone consistent across all messages
