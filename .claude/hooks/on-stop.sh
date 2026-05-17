#!/bin/bash
# on-stop.sh - prompt to update session log + remind about unclosed beads
echo ""
echo "=========================================="
echo "Session ended. Please append an entry to SESSION_LOG.md:"
echo ""
echo "## Session $(date -u +%Y-%m-%d)"
echo "### Completed"
echo "- [task 1]"
echo "- [task 2]"
echo ""
echo "### Next Session Should Start With"
echo "- [first unchecked [ ] in PLANNING.md]"
echo "=========================================="

# Remind about unclosed beads (if any exist)
if [ -f ".beads/status.jsonl" ]; then
  unclosed=$(grep -c '"status":\s*"open\|in_progress"' .beads/status.jsonl 2>/dev/null || echo 0)
  if [ "$unclosed" -gt 0 ]; then
    echo ""
    echo "⚠️  Note: $unclosed unclosed bead(s) in .beads/status.jsonl"
    echo "Consider closing them before next session:"
    grep '"status":\s*"open\|in_progress"' .beads/status.jsonl 2>/dev/null | tail -3 | jq -r '"  - \(.title) (id: \(.id))"' 2>/dev/null || true
    echo ""
  fi
fi
