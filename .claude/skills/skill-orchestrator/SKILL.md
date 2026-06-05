---
name: skill-orchestrator
description: How Claude self-orchestrates work on the Coach Task Tracker project
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-06-04T00:00:00Z"
beads: []
---

# skill-orchestrator — How Claude Self-Orchestrates This Project

## Start of Every Session
1. Read CLAUDE.md for project overview and file map
2. Read PLANNING.md — find the first unchecked [ ] task
3. Read the skill/*.md file relevant to that phase
4. Implement, checking off [ ] boxes as each subtask completes
5. Update MEMORY.md if any new persistent facts emerge
6. Before stopping: append SESSION_LOG.md entry

## If Stuck
- Read DECISION.md to understand why constraints exist
- Read the relevant skill/*.md for patterns
- Ask the user rather than guessing

## Sub-Agent Use
Spawn a sub-agent when: a task is long and self-contained (e.g., "build all Phase 3 routes")
Pass: the skill/*.md content + relevant PLANNING.md section as context
After sub-agent returns: verify output against checklist, check off completed items

## Quality Gates (before marking phase complete)
- All [ ] boxes in the phase are checked
- Verify steps from PLANNING.md phase section pass
- No password_hash in API responses
- No cross-role data leakage
