---
phase: "3"
status: "active"
owner: "phase-builder"
last_updated: "2026-06-04T12:15:00Z"
beads: []
---

# Multi-Coach Task Assignment Handoff

**Feature:** Assign a single task to multiple coaches simultaneously. Each coach receives their own task instance with individual notifications.

**Status:** ✅ Complete and verified  
**Commit:** `5cf9d9e` — `[Phase 3+] Add multi-coach task assignment feature`

---

## What Changed

### Backend (`server/routes/tasks.js`)

**POST /api/tasks** now accepts **both**:
- **Legacy:** `coach_id` (single integer) — backward compatible
- **New:** `coach_ids` (array of integers) — supports multiple coaches

```javascript
// Support both formats
const coachIdsArray = coach_ids && Array.isArray(coach_ids) ? coach_ids : (coach_id ? [coach_id] : []);

// Validation loop for all coach IDs
for (const cId of coachIdsArray) {
  const parsed = Number.parseInt(cId, 10);
  if (!Number.isInteger(parsed)) return error;
  const coach = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(parsed, 'coach');
  if (!coach) return error;
  validCoaches.push(parsed);
}

// Create one task per coach
for (const coachId of validCoaches) {
  const result = insertStmt.run(coachId, title, description || null, priority, due_date);
  const taskId = result.lastInsertRowid;
  createdTasks.push({ id: taskId, coach_id: coachId });
  createNotification(coachId, taskId, 'assigned', notificationMessage);
}

// Return array of created tasks
res.json({ tasks: createdTasks.map(t => ({ ...t, title, priority, status: 'assigned' })) });
```

**Key behaviors:**
- ✅ Validates all coach IDs before creating any tasks (atomic)
- ✅ Creates one task row per coach (not a shared task)
- ✅ Each coach gets their own notification
- ✅ Returns array of created task IDs for admin reference
- ✅ Maintains backward compatibility with `coach_id` parameter

### Frontend (`client/src/pages/admin/AssignTask.jsx`)

**Coach selection changed from dropdown to multi-select:**

1. **State management:**
   ```javascript
   const [form, setForm] = useState({ 
     coach_ids: [],  // Changed from coach_id
     title: '', 
     description: '', 
     priority: 'medium', 
     due_date: '' 
   });
   ```

2. **Helper functions:**
   ```javascript
   const toggleCoach = (coachId) => {
     setForm(f => ({
       ...f,
       coach_ids: f.coach_ids.includes(coachId)
         ? f.coach_ids.filter(id => id !== coachId)
         : [...f.coach_ids, coachId]
     }));
   };

   const toggleSelectAll = () => {
     setForm(f => ({
       ...f,
       coach_ids: f.coach_ids.length === coaches.length ? [] : coaches.map(c => c.id)
     }));
   };
   ```

3. **UI components:**
   - Dropdown button shows: `"All coaches (2)"` or `"2 coaches selected"` or `"Select coaches…"`
   - Selected coaches display as removable teal tags below dropdown
   - Click `×` on tag to remove that coach
   - Checkbox in dropdown for each coach
   - "Select all coaches" option at top of dropdown

4. **Form submission:**
   ```javascript
   await axios.post('/api/tasks', {
     title: form.title,
     description: form.description,
     priority: form.priority,
     due_date: new Date(form.due_date).toISOString(),
     coach_ids: form.coach_ids,  // Send as array
   });
   
   // Dynamic success message
   toast.success(`Task assigned to ${selectedCoaches.length} coach${selectedCoaches.length > 1 ? 'es' : ''}! 🎯`);
   ```

---

## How It Works: User Flow

### Admin perspective:
1. Click **"Assign Task"** in sidebar
2. Click **"Select coaches…"** dropdown
3. Check boxes for **Coach A** and **Sarah Chen**
4. Tags appear below: `Coach A ×` `Sarah Chen ×`
5. Fill in title, description, priority, due date
6. Click **"Assign Task"** button
7. ✅ Success: Two separate task rows appear in Task Board
   - Same title, description, priority, due date
   - Different coach assigned to each
   - Each coach gets their own notification

### Coach perspective:
1. Login and see notification: `"You've got a new challenge! 🎯 'Q3 Team Alignment Workshop' — make it happen by Jun 7."`
2. Go to **"My Tasks"** tab
3. See their task instance listed
4. Mark complete or submit delay reason
5. Admin gets notified when they complete/delay

---

## Test Plan

### Manual Testing (Verified ✅)

1. **Create task for 2 coaches:**
   - Go to Assign Task
   - Select "Coach A" and "Sarah Chen"
   - Fill form with: Title="Q3 Team Alignment Workshop", Priority="Medium", Date="06/07/2026"
   - Click "Assign Task"
   - ✅ Navigate to Task Board
   - ✅ See 2 identical task rows (same title, different coach)

2. **Verify notifications:**
   - ✅ Both coaches see "assigned" notification in bell
   - ✅ Notification shows correct task title and due date

3. **Coach actions:**
   - Login as Coach A
   - Go to "My Tasks"
   - ✅ See "Q3 Team Alignment Workshop" task
   - Click mark complete
   - ✅ Admin gets notification: "Coach A just completed 'Q3 Team Alignment Workshop'!"

4. **Backward compatibility:**
   - Old code using `coach_id` (single) should still work
   - Test: `curl -X POST http://localhost:3001/api/tasks -d '{"coach_id": 1, ...}'`
   - ✅ Creates single task (old behavior maintained)

### API Testing

**Multi-coach request:**
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "coach_ids": [113, 118],
    "title": "Q3 Planning",
    "priority": "high",
    "due_date": "2026-06-07T00:00:00.000Z"
  }'
```

**Expected response:**
```json
{
  "tasks": [
    {"id": 385, "coach_id": 113, "title": "Q3 Planning", "priority": "high", "status": "assigned"},
    {"id": 386, "coach_id": 118, "title": "Q3 Planning", "priority": "high", "status": "assigned"}
  ]
}
```

**Legacy single-coach request:**
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "coach_id": 113,
    "title": "Q3 Planning",
    "priority": "high",
    "due_date": "2026-06-07T00:00:00.000Z"
  }'
```

**Expected response:**
```json
{
  "tasks": [
    {"id": 387, "coach_id": 113, "title": "Q3 Planning", "priority": "high", "status": "assigned"}
  ]
}
```

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **No coaches selected** | Red error message: "Please select at least one coach" |
| **Invalid coach ID in array** | 400 error: "Invalid coach_id: 999" |
| **Non-existent coach ID** | 400 error: "Invalid coach_id: 999" (no task created) |
| **Empty coach_ids array** | 400 error: "Missing required fields" |
| **Mixed valid/invalid IDs** | 400 error stops at first invalid (atomic — no partial creation) |
| **500 tasks assigned** | Works fine (no limit enforced in code) |

---

## Files Modified

| File | Changes |
|------|---------|
| `server/routes/tasks.js` | POST endpoint accepts `coach_ids` array; validation loop; multi-task creation |
| `client/src/pages/admin/AssignTask.jsx` | Multi-select dropdown; `toggleCoach()`/`toggleSelectAll()` helpers; state management |

---

## Migration Notes

### For existing deployments:
- ✅ **Backward compatible** — old code sending `coach_id` continues to work
- ✅ **No database changes** — uses existing `tasks` table (one row per coach per task)
- ✅ **No breaking changes** — all existing endpoints unaffected

### For new code:
- Use `coach_ids: [113, 118]` instead of `coach_id: 113` to assign to multiple coaches
- Admin UI automatically defaults to multi-select (no need to opt-in)

---

## Future Improvements

1. **Bulk operations:** Edit/delete all instances of a multi-coach task together
2. **Template tasks:** Save a task template, assign to multiple coaches at once (for recurring tasks)
3. **Team assignments:** Assign task to a "team" (group of coaches) instead of individual coach_ids
4. **Progress sync:** When one coach completes, option to auto-mark others as complete or remove their task
5. **Conditional branching:** If coach_id = A AND status = completed, auto-assign different task to coach_id = B

---

## Support & Questions

**Q: What if I want to edit a task assigned to multiple coaches?**  
A: Edit through admin UI or API. The edit applies only to the specific task instance. To edit all instances, edit each separately (or implement bulk edit in future).

**Q: Can a coach see tasks assigned to other coaches?**  
A: No. Each coach only sees their own tasks in "My Tasks" view. This is enforced by `scoped to req.user.id` in backend.

**Q: What happens if I delete a coach?**  
A: All their tasks (including multi-coach assigned ones) are cascade-deleted from the `tasks` table by foreign key constraint.

**Q: Can I assign to 50 coaches at once?**  
A: Yes! No limit enforced. Practical limit depends on performance. (Future optimization: batching if needed.)

---

## Verification Checklist

- [x] Backend accepts `coach_ids` array
- [x] Backend validates all coach IDs before creating tasks
- [x] Backend creates one task per coach
- [x] Backend creates one notification per coach
- [x] Frontend dropdown shows multi-select with checkboxes
- [x] Frontend displays selected coaches as removable tags
- [x] Frontend form submission sends `coach_ids` array
- [x] Success message shows count: "assigned to X coaches"
- [x] Task Board shows separate rows per coach
- [x] Each coach receives their notification
- [x] Backward compatibility with `coach_id` maintained
- [x] Tested with real database and UI
- [x] Committed to git

---

**Done!** The multi-coach feature is production-ready. 🚀
