# API Reference — Coach Task Tracker

## Base URL
- **Development:** http://localhost:3001
- **All requests:** include `Authorization: Bearer <token>` header (except `/api/auth/login`)

---

## Authentication

### POST /api/auth/login
Login with email and password. Returns JWT token.

**Request:**
```json
{
  "email": "admin@tracker.com",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (401):**
```json
{
  "error": "Invalid credentials"
}
```

---

## Coaches (Admin Only)

### GET /api/coaches
List all coaches with task counts.

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Sarah",
    "email": "sarah@example.com",
    "role": "coach",
    "assigned": 5,
    "completed": 3,
    "overdue": 1
  }
]
```

### POST /api/coaches
Create a new coach account.

**Request:**
```json
{
  "name": "John",
  "email": "john@example.com",
  "password": "temp-password"
}
```

**Response (200):**
```json
{
  "id": 2,
  "name": "John",
  "email": "john@example.com",
  "role": "coach"
}
```

### PUT /api/coaches/:id
Update coach name or email.

**Request:**
```json
{
  "name": "John Smith",
  "email": "john.smith@example.com"
}
```

**Response (200):**
```json
{
  "id": 2
}
```

### DELETE /api/coaches/:id
Delete coach and cascade-delete their tasks.

**Response (200):**
```json
{
  "success": true
}
```

---

## Tasks

### GET /api/tasks
List all tasks (admin only).

**Query params:**
- `coach_id` (optional) — filter by coach
- `status` (optional) — 'assigned', 'in_progress', 'completed', 'overdue'

**Response (200):**
```json
[
  {
    "id": 1,
    "coach_id": 1,
    "coach_name": "Sarah",
    "title": "Q2 Growth Strategy",
    "description": "Plan Q2 initiatives",
    "status": "assigned",
    "priority": "high",
    "assigned_at": "2026-05-08T10:00:00Z",
    "due_date": "2026-05-15T18:00:00Z",
    "completed_at": null,
    "delay_reason": null,
    "days_left": 7
  }
]
```

### GET /api/tasks/mine
List tasks for logged-in coach only.

**Response (200):** Same as GET /api/tasks but only coach's tasks.

### POST /api/tasks
Assign a task to a coach (admin only). Creates 'assigned' notification for coach.

**Request:**
```json
{
  "coach_id": 1,
  "title": "Q2 Growth Strategy",
  "description": "Plan Q2 initiatives and set metrics",
  "priority": "high",
  "due_date": "2026-05-15T18:00:00Z"
}
```

**Response (200):**
```json
{
  "id": 1,
  "coach_id": 1,
  "title": "Q2 Growth Strategy",
  "status": "assigned",
  "priority": "high"
}
```

### GET /api/tasks/:id
Get single task detail (admin or task owner).

**Response (200):** Full task object (see GET /api/tasks).

### PUT /api/tasks/:id
Update task title, description, priority, or due_date (admin only).

**Request:**
```json
{
  "title": "Q2 Growth Strategy (Updated)",
  "priority": "medium",
  "due_date": "2026-05-20T18:00:00Z"
}
```

**Response (200):**
```json
{
  "id": 1
}
```

### DELETE /api/tasks/:id
Delete task (admin only).

**Response (200):**
```json
{
  "success": true
}
```

### PUT /api/tasks/:id/complete
Mark task as completed (coach only, own tasks).

**Request:** (no body)

**Response (200):**
```json
{
  "id": 1,
  "status": "completed",
  "completed_at": "2026-05-10T14:30:00Z"
}
```

Creates 'completed' notification for admin.

### PUT /api/tasks/:id/delay-reason
Submit delay reason for overdue task (coach only, own tasks).

**Request:**
```json
{
  "delay_reason": "Got stuck on dependency; waiting for approval from legal team"
}
```

**Response (200):**
```json
{
  "id": 1,
  "delay_reason": "Got stuck on dependency; waiting for approval from legal team"
}
```

Creates 'delay_submitted' notification for admin.

---

## Notifications

### GET /api/notifications
Get logged-in user's notifications, newest first.

**Response (200):**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "task_id": 5,
    "task_title": "Q2 Growth Strategy",
    "type": "assigned",
    "message": "You've got a new challenge! 🎯 'Q2 Growth Strategy' — make it happen by May 15.",
    "read": 0,
    "created_at": "2026-05-08T10:00:00Z"
  },
  {
    "id": 2,
    "user_id": 1,
    "task_id": 3,
    "task_title": "Customer Feedback",
    "type": "midpoint_nudge",
    "message": "Halfway there! ⚡ Don't let momentum slip — 'Customer Feedback' is due May 12. How's it going?",
    "read": 1,
    "created_at": "2026-05-10T10:00:00Z"
  }
]
```

### PUT /api/notifications/:id/read
Mark single notification as read.

**Response (200):**
```json
{
  "success": true
}
```

### PUT /api/notifications/read-all
Mark all notifications as read for logged-in user.

**Response (200):**
```json
{
  "success": true
}
```

---

## Error Responses

### 400 Bad Request
Missing required fields or validation error.
```json
{
  "error": "Title is required"
}
```

### 401 Unauthorized
Missing or invalid JWT token.
```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden
User doesn't have permission (wrong role or accessing another user's data).
```json
{
  "error": "Access denied"
}
```

### 409 Conflict
Resource already exists (e.g., email already registered).
```json
{
  "error": "Email already exists"
}
```

### 500 Internal Server Error
Server error.
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting
Currently none. To be added in Phase 7.

## Cron Jobs
- **Midpoint nudge**: runs hourly, notifies coaches when 50% of task time has elapsed
- **Overdue nudge**: runs hourly, marks tasks overdue and notifies coaches
- **Admin update**: notifies admin of newly overdue tasks
