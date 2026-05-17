#!/bin/bash
# pre-tool-use.sh - block dangerous commands
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Block rm -rf on non-temp paths
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+/[a-z]'; then
  echo '{"action":"block","message":"Blocked: rm -rf on non-temp path. Destructive operation not allowed."}'
  exit 0
fi

# Block git push --force
if echo "$COMMAND" | grep -qE 'git\s+push\s+--force'; then
  echo '{"action":"block","message":"Blocked: git push --force not allowed in this project"}'
  exit 0
fi

echo '{"action":"allow"}'
