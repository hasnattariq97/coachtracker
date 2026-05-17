---
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-05-17T22:30:00Z"
beads: []
---

# Beads Work-Tracking System

Append-only JSON event log for session-level work tracking, decision logging, and failure analysis across context resets.

## Files

| File | Purpose |
|------|---------|
| `status.jsonl` | Session/work-block tracking (open → in_progress → closed) |
| `decisions.jsonl` | Phase Builder board decisions (logged per phase completion) |
| `failures.jsonl` | Errors, blockers, escalations (soft enforcement log) |
| `_manifest.json` | Bootstrap metadata + bead statistics |

---

## Format

Each bead is a JSON object (one per line in JSONL files):

```json
{
  "id": "unique_id_or_uuid",
  "timestamp": "2026-05-17T22:30:00Z",
  "session_id": "session_20260517_claude_code",
  "type": "status|decision|failure|note",
  "status": "open|in_progress|closed",
  "phase": "0|1|2|...|N",
  "agent": "phase-builder|user|hook|automation",
  "title": "Brief one-line description",
  "body": "Detailed notes (markdown support)",
  "metadata": {
    "file_path": "/d/Cursor_new/server/auth.js",
    "line_number": 42,
    "tag": "auth|frontend|db|notifications",
    "priority": "low|medium|high|critical"
  },
  "relationships": ["bead_id_1", "bead_id_2"]
}
```

**Field Reference:**

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | ✅ | Unique identifier (can be UUID or sequence like "auth_p1_001") |
| `timestamp` | ISO 8601 | ✅ | When bead was created/updated |
| `session_id` | string | ✅ | Which Claude Code session created this |
| `type` | enum | ✅ | `status` (work items), `decision` (board votes), `failure` (errors/blockers), `note` (misc) |
| `status` | enum | ✅ | Lifecycle: `open` (created), `in_progress` (started), `closed` (done) |
| `phase` | string | ✅ | Which phase (0=scaffold, 1=auth, 2=coaches, etc.) |
| `agent` | string | ✅ | Who created it (phase-builder, auth-agent, user, hook, automation) |
| `title` | string | ✅ | One-liner, max 100 chars |
| `body` | string | ✅ | Details (can be empty string "") |
| `metadata` | object | ✅ | File path, line, tag, priority (can be empty {}) |
| `relationships` | array | ✅ | Links to related beads (can be empty []) |

---

## Lifecycle

### 1. Open
Bead is created when work is identified:
```json
{
  "id": "auth_agent_phase1",
  "type": "status",
  "status": "open",
  "phase": "1",
  "agent": "phase-builder",
  "title": "Auth Agent: Implement server/auth.js",
  "body": "JWT + bcrypt + session management"
}
```

### 2. In Progress
Agent updates status during execution:
```json
{
  "id": "auth_agent_phase1",
  "status": "in_progress",
  "timestamp": "2026-05-17T22:45:00Z"
}
```

### 3. Closed
Work item complete:
```json
{
  "id": "auth_agent_phase1",
  "status": "closed",
  "timestamp": "2026-05-17T23:30:00Z",
  "body": "Complete: POST /api/auth/login returns JWT. All tests pass."
}
```

---

## Integration Points

### SessionStart Hook
Every session start, the SessionStart hook reads `.beads/status.jsonl` and injects open beads:
```
Open Work Items from Previous Session:
- Auth Agent: Implement server/auth.js
- Task Manager Agent: Schema + CRUD routes
```

This ensures work-in-progress survives context resets.

### Stop Hook
On session end, the Stop hook reminds about unclosed beads:
```
⚠️  Note: 3 unclosed beads. Consider closing before next session:
  - Auth Agent: Implement server/auth.js (id: auth_agent_phase1)
  - Task Manager Agent: Schema + CRUD routes (id: tm_agent_phase1)
  - Frontend Agent: React components (id: fe_agent_phase1)
```

### PreToolUse Write Guard
When writing markdown/code files, the hook validates YAML frontmatter and logs violations:
```json
{
  "id": "guard_1715959200",
  "type": "failure",
  "status": "open",
  "title": "Missing YAML frontmatter",
  "body": "File server/auth.js written without metadata contract"
}
```

### Phase Builder Agent
At end of each phase, Phase Builder logs:
- **Decision bead** → `.beads/decisions.jsonl` (board votes + rationale)
- **Failure beads** → `.beads/failures.jsonl` (issues requiring fix loops)
- **Status beads** → `.beads/status.jsonl` (work items closed)

---

## Querying Beads

All files are JSONL — query with grep, jq, or Python:

**Show all open beads:**
```bash
grep '"status":"open"' .beads/status.jsonl
```

**Show all decisions:**
```bash
grep '"type":"decision"' .beads/decisions.jsonl
```

**Show failures by phase:**
```bash
grep '"phase":"1"' .beads/failures.jsonl
```

**Count open beads:**
```bash
grep -c '"status":"open"' .beads/status.jsonl
```

**Pretty-print one bead:**
```bash
grep 'auth_agent_phase1' .beads/status.jsonl | jq '.'
```

---

## Why This System Exists

Claude Code sessions have no persistent memory across context resets. If you're mid-Phase-1 and the context window fills:
- Without beads: next session has zero idea what was happening
- With beads: SessionStart hook auto-injects open beads, work resumes

The system survives context resets because:
1. SessionStart hook reads `.beads/status.jsonl` every session
2. Injects open beads as context (only if any exist, silent otherwise)
3. Work-in-progress becomes visible to next session

---

## Maintenance

**No archiving needed for Phase 0-1.** Beads grow indefinitely and are append-only (never edit previous lines).

For quarterly cleanup (if file grows very large):
```bash
# Archive closed beads older than 90 days
python3 -c "
import json
from datetime import date, timedelta

cutoff = (date.today() - timedelta(days=90)).isoformat()
active, archive = [], []

with open('.beads/status.jsonl') as f:
    for line in f:
        try:
            d = json.loads(line)
            if d.get('status') == 'closed' and d.get('timestamp', '')[:10] < cutoff:
                archive.append(line)
            else:
                active.append(line)
        except:
            active.append(line)

with open('.beads/status.jsonl', 'w') as f:
    f.writelines(active)

with open('.beads/history.jsonl', 'a') as f:
    f.writelines(archive)

print(f'Archived {len(archive)} beads.')
"
```

---

## Examples

### Work Item (Status Bead)
```json
{
  "id": "auth_agent_p1_001",
  "timestamp": "2026-05-17T22:30:00Z",
  "session_id": "session_20260517_claude_code",
  "type": "status",
  "status": "open",
  "phase": "1",
  "agent": "phase-builder",
  "title": "Auth Agent: Implement server/auth.js",
  "body": "JWT verification middleware, role guards, bcrypt password hashing",
  "metadata": {
    "assigned_files": ["server/auth.js", "server/db.js"],
    "priority": "high",
    "tag": "auth"
  }
}
```

### Phase Decision (Decision Bead)
```json
{
  "id": "phase_1_board_vote",
  "timestamp": "2026-05-17T23:45:00Z",
  "session_id": "session_20260517_claude_code",
  "type": "decision",
  "status": "closed",
  "phase": "1",
  "agent": "phase-builder",
  "title": "Phase 1 Board Decision: APPROVE",
  "body": "All 4 quality evaluators passed. Board consensus: 5/5 APPROVE.",
  "metadata": {
    "board_votes": {
      "chief_architect": "APPROVE",
      "chief_product_officer": "APPROVE",
      "chief_security_officer": "APPROVE",
      "chief_operating_officer": "APPROVE",
      "chief_experience_officer": "APPROVE"
    },
    "consensus": true,
    "phase": "1"
  }
}
```

### Issue/Blocker (Failure Bead)
```json
{
  "id": "phase_1_eval_failure",
  "timestamp": "2026-05-17T23:30:00Z",
  "session_id": "session_20260517_claude_code",
  "type": "failure",
  "status": "open",
  "phase": "1",
  "agent": "code-quality-evaluator",
  "title": "Phase 1 Code Quality Issues (Retry 1/5)",
  "body": "- Uncommented debug console.log in auth.js:42\n- Missing JSDoc on authenticateToken()\n- No input validation on password field",
  "metadata": {
    "failed_evaluators": ["Code Quality Evaluator"],
    "retry_attempt": 1,
    "max_retries": 5,
    "priority": "high"
  },
  "relationships": ["phase_1_board_vote"]
}
```
