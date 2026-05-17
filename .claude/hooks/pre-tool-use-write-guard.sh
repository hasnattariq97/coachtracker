#!/bin/bash
# Metadata contract guard — enforces YAML frontmatter on markdown/code writes
# Logs violations to .beads/failures.jsonl (soft enforcement, non-blocking)

set -euo pipefail

# Read tool input from stdin (JSON)
TOOL=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || echo "")
FILEPATH=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('file_path',''))" 2>/dev/null || echo "")
CONTENT=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('new_string',''))" 2>/dev/null || echo "")

# Skip if not a write-like operation or file path is empty
if [ -z "$FILEPATH" ] || ! [[ "$TOOL" =~ ^(Write|Edit)$ ]]; then
  echo '{"action":"allow"}'
  exit 0
fi

# Skip generated files (no metadata contract enforced on these)
if [[ "$FILEPATH" =~ (graph\.json|GRAPH_REPORT\.md|manifest\.json|cache/|\.graphify|node_modules|dist) ]]; then
  echo '{"action":"allow"}'
  exit 0
fi

# Only check markdown files (not all code files, to avoid bloat)
if ! [[ "$FILEPATH" =~ \.md$ ]]; then
  echo '{"action":"allow"}'
  exit 0
fi

# Check if file has YAML frontmatter with required fields
has_phase=$(echo "$CONTENT" | head -20 | grep -E '^phase:' 2>/dev/null || true)
has_status=$(echo "$CONTENT" | head -20 | grep -E '^status:' 2>/dev/null || true)

if [ -z "$has_phase" ] || [ -z "$has_status" ]; then
  # Log violation to failures.jsonl (soft enforcement)
  timestamp=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
  bead_id="guard_$(date +%s)"

  # Append to .beads/failures.jsonl if directory exists
  if [ -d ".beads" ]; then
    python3 << 'PYTHON_EOF' 2>/dev/null || true
import json
import sys
from datetime import datetime

bead = {
  "id": sys.argv[1],
  "timestamp": sys.argv[2],
  "session_id": "",
  "type": "failure",
  "status": "open",
  "phase": "0",
  "agent": "hook",
  "title": "Missing YAML frontmatter on markdown file",
  "body": f"File {sys.argv[3]} written without metadata contract (phase:, status:, owner:, last_updated:)",
  "metadata": {
    "file_path": sys.argv[3],
    "priority": "low",
    "tag": "metadata-contract"
  },
  "relationships": []
}

try:
  with open(".beads/failures.jsonl", "a") as f:
    f.write(json.dumps(bead) + "\n")
except:
  pass
PYTHON_EOF
  fi
fi

# Always allow (soft enforcement, non-blocking)
echo '{"action":"allow"}'
exit 0
