---
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-05-17T22:30:00Z"
beads: []
---

# Metadata Contract for Coach Task Tracker

All project files must include YAML frontmatter for tracking and integration with the beads work-tracking system.

## Why This Exists

The beads system needs to know:
- Which phase introduced this file (for scoping)
- Whether the file is draft, active, or deprecated (for freshness)
- Who owns it (for accountability)
- When it was last verified (for staleness detection)

This frontmatter enables cross-session durability and prevents doc rot.

---

## Required Frontmatter

### For Markdown Files (`.md`)

All `.md` files MUST include YAML frontmatter at the very top:

```markdown
---
phase: "0"
status: "draft|active|complete|deprecated"
owner: "phase-builder|user|automation|[name]"
last_updated: "2026-05-17T22:30:00Z"
beads: []
---

# Your content here...
```

### For Other Files (Optional)

- **`.js`, `.ts`, `.jsx`, `.tsx`**: Include as multi-line comment block (optional, soft requirement)
- **`.json`**: Include as top-level object (optional)
- **Generated files**: Skip (exceptions below)

---

## Field Reference

| Field | Values | Required | Purpose |
|-------|--------|----------|---------|
| `phase` | "0", "1", "2",..., "N" | ✅ | Which phase introduced this file |
| `status` | "draft", "active", "complete", "deprecated" | ✅ | Is the file current? |
| `owner` | name, agent, or "automation" | ✅ | Who maintains it |
| `last_updated` | ISO 8601 timestamp | ✅ | When was it last verified for accuracy |
| `beads` | Array of bead IDs | ✅ | Link to related work items (can be []) |

### Phase Numbers

| Phase | Description |
|-------|-------------|
| "0" | Scaffold, setup, harness (CLAUDE.md, hooks, agents, docs structure) |
| "1" | Auth system (JWT, bcrypt, login endpoint) |
| "2" | Coach management (CRUD, list, task counts) |
| "3" | Task assignment & management (lifecycle, cron, notifications) |
| "4" | Coach dashboard & UI (progress, my-tasks, empty states) |
| "5" | Notifications system (email, cron, bell component) |
| "6" | Polish & security audit (responsive, error handling, validation) |
| "7" | Multi-agent coaching insights (agent swarm analysis) |

### Status Values

| Status | Meaning |
|--------|---------|
| `draft` | Work in progress, not yet for production |
| `active` | Current, maintained, accurate |
| `complete` | Finished feature, no longer changing |
| `deprecated` | Old, replaced by another file, don't use |

---

## Examples

### Markdown File (`.md`)

```markdown
---
phase: "1"
status: "active"
owner: "phase-builder"
last_updated: "2026-05-17T20:00:00Z"
beads: ["auth_agent_phase1", "bd_001"]
---

# Authentication Routes

## POST /api/auth/login

Accepts email + password, returns JWT token.

...
```

### JavaScript File (Optional)

```javascript
/**
 * @phase 1
 * @status active
 * @owner phase-builder
 * @last_updated 2026-05-17T20:00:00Z
 * @beads ["auth_agent_phase1"]
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

module.exports = { authenticateToken, requireAdmin, requireCoach };
```

### JSON File (Optional)

```json
{
  "_metadata": {
    "phase": "0",
    "status": "active",
    "owner": "automation",
    "last_updated": "2026-05-17T00:00:00Z"
  },
  "bead_count": { ... }
}
```

---

## Enforcement

### Hard Rule: Markdown Files

All `.md` files in `docs/`, `.claude/`, `.beads/` directories MUST have frontmatter.

Violations are logged to `.beads/failures.jsonl` by the `pre-tool-use-write-guard.sh` hook (soft enforcement, non-blocking).

### Soft Rule: Code Files

JavaScript/TypeScript/JSON files may include frontmatter as comments (recommended for key files like `server/auth.js`, `server/index.js`).

### Exceptions (No Frontmatter Required)

Generated files:
- `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html`
- `ruvector.db`, `.beads/_manifest.json`
- `node_modules/**`, `dist/**`, `build/**`, `.cache/**`

---

## Update Guidelines

### When to Update `last_updated`

- After any code change that affects the file's topic
- After verifying the information is still accurate
- When moving from `draft` → `active` or `active` → `complete`

### When NOT to Update

- For trivial changes (whitespace, formatting, typo fixes)
- When only adding examples that don't change core behavior

---

## Freshness SLO (Service Level Objective)

| File Type | Max Staleness |
|-----------|--------------|
| CLAUDE.md, ROADMAP.md | 2 weeks |
| Architecture docs | 1 month |
| API reference | 1 month |
| Agent/skill files | 2 months |
| Old investigations | Indefinite (marked `deprecated`) |

When `last_updated` exceeds SLO, a bead should be opened to review and update the file.

---

## Querying by Metadata

Because all files have YAML frontmatter, you can search by field:

**Find all Phase 1 files:**
```bash
grep -r "^phase: \"1\"" docs/ .claude/
```

**Find deprecated files:**
```bash
grep -r "^status: \"deprecated\"" .
```

**Find files last updated before 2 weeks ago:**
```bash
# (use your date command to compute cutoff)
grep -r "last_updated:" . | grep "2026-05-0[1-3]"
```

---

## Template for New Files

Copy this template when creating new markdown files:

```markdown
---
phase: "N"
status: "draft"
owner: "[your name or automation]"
last_updated: "2026-05-17T22:30:00Z"
beads: []
---

# [File Title]

## Overview
[One-sentence summary]

## Content
[Details...]
```

Then update `status` to `active` when the file is ready for use.

---

## Why YAML Frontmatter?

1. **Machine-readable**: Beads system can parse it
2. **Optional fields**: Can add more fields later (tags, priority, etc.)
3. **Standard format**: Used by many documentation systems (Jekyll, Hugo, Obsidian)
4. **Human-readable**: Easy to scan and edit
5. **Lightweight**: No database needed, just files
