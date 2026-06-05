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
Assign a task to one or more coaches (admin only). Creates 'assigned' notification for each coach.

**Request (single coach - legacy):**
```json
{
  "coach_id": 1,
  "title": "Q2 Growth Strategy",
  "description": "Plan Q2 initiatives and set metrics",
  "priority": "high",
  "due_date": "2026-05-15T18:00:00Z"
}
```

**Request (multiple coaches - new):**
```json
{
  "coach_ids": [1, 2, 3],
  "title": "Q2 Growth Strategy",
  "description": "Plan Q2 initiatives and set metrics",
  "priority": "high",
  "due_date": "2026-05-15T18:00:00Z"
}
```

**Response (200) - single coach:**
```json
{
  "tasks": [
    {
      "id": 1,
      "coach_id": 1,
      "title": "Q2 Growth Strategy",
      "status": "assigned",
      "priority": "high"
    }
  ]
}
```

**Response (200) - multiple coaches:**
```json
{
  "tasks": [
    {
      "id": 1,
      "coach_id": 1,
      "title": "Q2 Growth Strategy",
      "status": "assigned",
      "priority": "high"
    },
    {
      "id": 2,
      "coach_id": 2,
      "title": "Q2 Growth Strategy",
      "status": "assigned",
      "priority": "high"
    },
    {
      "id": 3,
      "coach_id": 3,
      "title": "Q2 Growth Strategy",
      "status": "assigned",
      "priority": "high"
    }
  ]
}
```

**Notes:**
- Use `coach_id` (integer) to assign to a single coach (backward compatible)
- Use `coach_ids` (array of integers) to assign to multiple coaches
- Each coach receives their own task instance with identical title/description/priority/due_date
- Each coach receives their own notification
- Validation is atomic — if any coach_id is invalid, no tasks are created
- Notifications are idempotent (checked via task_id, type, user_id composite key)

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

**Notification Types:**

- `assigned` — New task assigned to coach
- `midpoint_nudge` — 50% of task time elapsed
- `overdue` — Task past due date
- `completed` — Coach completed task (admin notification)
- `delay_submitted` — Coach submitted delay reason (admin notification)
- `coaching_insights` — Multi-agent analysis of coach behavior (Phase 7)

**Example: coaching_insights notification**

```json
{
  "id": 42,
  "user_id": 2,
  "task_id": 5,
  "task_title": "Q2 Strategy",
  "type": "coaching_insights",
  "message": "Great work on deadline execution! Consider applying this approach to future complex tasks.",
  "metadata": {
    "pattern_agent": {
      "summary": "You're 85% on-time — strong execution",
      "confidence": 0.92
    },
    "growth_agent": {
      "summary": "Great execution on deadline pressure",
      "confidence": 0.88
    },
    "risk_agent": {
      "summary": "No risks detected",
      "confidence": 0.95
    },
    "consensus": "Keep it up!",
    "generated_at": "2026-06-04T15:30:00Z"
  },
  "insights_status": "success",
  "read": 0,
  "created_at": "2026-06-04T15:30:00Z"
}
```

**Coaching Insights Behavior:**

- Generated asynchronously after coach completes task or submits delay reason via **Groq API** (free tier, no credit card)
- Uses llama-3.3-70b-versatile model from Groq
- Spawns 3 agents in parallel (Pattern, Growth, Risk) for behavior analysis
- 10 second timeout per agent, 30-second total timeout; partial results stored if any agent times out
- `insights_status`: `success`, `partial`, or `timeout`
- Features on-time pattern analysis, growth opportunities, and risk detection
- Displayed as special card in notification bell with expandable details
- Does not block task completion or delay reason submission
- **Setup:** Set `GROQ_API_KEY=gsk_...` in `server/.env` (get free key at https://console.groq.com)

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
