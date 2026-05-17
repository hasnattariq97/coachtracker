#!/bin/bash
# post-tool-use.sh - audit log every tool call
INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name','unknown'))" 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")

echo "$TIMESTAMP | $TOOL" >> .claude/audit.log 2>/dev/null || true
