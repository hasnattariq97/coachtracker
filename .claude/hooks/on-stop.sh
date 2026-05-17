#!/bin/bash
# on-stop.sh - prompt to update session log
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
