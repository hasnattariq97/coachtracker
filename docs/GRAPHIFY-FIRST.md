---
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-06-07T00:00:00Z"
beads: []
---

# Graphify First: Query Pattern for Coach Task Tracker

**Rule: ALWAYS use graphify for queries and searches. Grep and file reading are last resorts.**

This document enforces the "graphify-first" principle to maximize efficiency and respect the knowledge graph.

---

## The Rule

### ✅ DO THIS (Graphify First)
```bash
# For ANY query, search, or question about the codebase:
cd d:/Cursor_new
python3 -m graphifyy query "Your question here?"

# Examples:
python3 -m graphifyy query "How do coaches get notified of overdue tasks?"
python3 -m graphifyy query "Where is the 3-agent swarm defined?"
python3 -m graphifyy query "Why is Phase Builder optional?"
python3 -m graphifyy path "coach_id" "notification"
python3 -m graphifyy explain "midpoint_nudge"
```

**Benefits:**
- Returns **scoped subgraph** (~30-50 tokens)
- Structured relationships (nodes, edges, paths)
- **10x more efficient** than grepping full files

---

### ❌ DON'T DO THIS (Unless graphify fails)
```bash
# Avoid grepping raw files first:
grep -r "notifications" server/
cat docs/API.md | less
find . -name "*coach*" -type f

# These are last resorts, not first approaches
```

**Problems:**
- Returns **full files** (5000+ tokens wasted)
- Unstructured text output
- Ignores the knowledge graph you built

---

## When to Use Each Tool

| Task | Tool | Example |
|------|------|---------|
| "How does X relate to Y?" | **graphify query** | `graphify query "How do tasks trigger notifications?"` |
| "Find all uses of function X" | **graphify path** | `graphify path "task_id" "notification"` |
| "Explain concept X" | **graphify explain** | `graphify explain "midpoint_nudge"` |
| "Find text matching pattern" | grep (fallback) | `grep -r "AGENT_TIMEOUT" server/` |
| "Find specific file" | Glob (fallback) | `ls client/src/**/*.jsx` |
| "Browse file contents" | Read tool (fallback) | Open in IDE or use `cat` |

---

## Workflow: When You Have a Question

### Step 1: Try Graphify
```bash
python3 -m graphifyy query "Your question?"
```

**If it answers your question → STOP.** You have the answer in ~50 tokens.

### Step 2: Refine the Query
If the result is unclear, ask more specifically:

```bash
# Bad query (too broad):
python3 -m graphifyy query "notifications"

# Better query (specific):
python3 -m graphifyy query "How does the 3-agent swarm create coaching insights?"
```

### Step 3: Use Relationships
If you need to understand connections:

```bash
# Find path between concepts
python3 -m graphifyy path "coach_id" "coaching_insights"

# Get detailed explanation
python3 -m graphifyy explain "callAgentSwarm"
```

### Step 4: Fallback to Grep
Only if graphify can't find it:

```bash
grep -r "SWARM_TIMEOUT_MS" server/  # Search for specific constants
grep -r "function.*Pattern.*Agent" . # Search for specific patterns
```

### Step 5: Read File Directly
Last resort, if you need full context:

```bash
# Open in IDE
open server/routes/coaching-insights.js

# Or use Read tool
```

---

## Common Queries & Examples

### Understanding Notifications
```bash
graphify query "How do midpoint nudges work?"
# Returns: nodes for cron.js, notification creation, task lifecycle

graphify query "What triggers coaching insights notifications?"
# Returns: task completion flow, agent swarm, notification creation
```

### Understanding Architecture
```bash
graphify query "Why did we choose PostgreSQL over SQLite?"
graphify query "How does multi-coach task assignment work?"
graphify query "What's the difference between Option A and Option B in RUFLO?"
```

### Finding Code
```bash
graphify query "Where is the authenticateToken function?"
graphify query "How is the Groq API initialized?"
graphify path "coach_id" "task_id" "notification"  # Find relationships
```

### Debugging
```bash
graphify query "What happens when a task is marked complete?"
graphify explain "callAgentSwarm"  # Get focused explanation
graphify path "queueCoachingInsights" "createNotification"  # Trace flow
```

---

## Performance Tips

### Fast Queries (under 5s)
```bash
graphify query "Single specific question?"
graphify path "concept1" "concept2"
```

### Slower Queries (5-15s)
```bash
graphify explain "detailed_concept"  # More thorough analysis
```

### After Code Changes
```bash
graphify update .  # Refresh graph (no API cost, AST-only)
```

---

## For Developers: Enforce This Pattern

### In Code Reviews
When someone asks about the codebase:
```
❌ "I grepped for notifications and found..."
✅ "I queried the graph: graphify query '...' and found..."
```

### In Session Notes
Always log graphify queries used:
```markdown
## Queries Used This Session
- graphify query "How does task assignment work?"  → Found 12 related nodes
- graphify path "coach" "notification"  → Found 5-step relationship
```

### Pre-Commit Hook (Optional)
Add to `.claude/hooks/pre-commit`:
```bash
# Encourage graphify usage in commit messages
if git diff --cached | grep -q "grep -r\|cat\|less"; then
  echo "⚠️  Tip: Use graphify query instead of grep for codebase searches"
fi
```

---

## Troubleshooting

### graphify command not found
```bash
# Use module invocation instead
python3 -m graphifyy query "Your question?"
```

### Graph returns empty results
1. Check if graph is fresh: `git rev-parse HEAD` vs. GRAPH_REPORT.md
2. Update graph: `graphify update .`
3. Try a different query phrasing

### Slow queries (>20s)
1. Make the query more specific
2. Use `graphify explain` for broad topics
3. Fall back to grep if urgent

---

## Impact

| Metric | Before | After |
|--------|--------|-------|
| Tokens per query | 5000+ | ~50 |
| Time to answer | 30+ sec | 5 sec |
| Context efficiency | 10% | 90%+ |
| Knowledge reuse | Manual | Automated |

**Bottom line:** Graphify respects your knowledge graph investment. Use it first.

---

## Examples of Good vs Bad

### Bad: Answered without graphify
```
User: "Why is Phase Builder optional?"
Assistant: "I read RUFLO.md, ROADMAP.md, and CLAUDE.md... [wasteful, 5000+ tokens]"
```

### Good: Answered with graphify
```
User: "Why is Phase Builder optional?"
Assistant: 
  graphify query "Why is Phase Builder optional?"
  → Found 7 Phase Builder nodes, marked as "optional"
  → Found Option B (Coaching Insights) marked as chosen
  → CONCLUSION: Phase Builder is optional for 100+ agent systems [efficient, ~50 tokens]
```

---

## Going Forward

**Every session, every question:**
1. **Graphify first** (2 seconds)
2. **If unclear, refine query** (5 seconds)
3. **If still stuck, grep** (30 seconds)
4. **If desperate, read file** (60+ seconds)

This maximizes efficiency and honors the knowledge graph you've built.

