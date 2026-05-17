---
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-05-17T23:30:00Z"
beads: []
---

# Master Capabilities Reference

Universal inventory of Claude's core powers, tools, frameworks, and methodologies. Use this document to understand all available capabilities and best practices, independent of project, tech stack, or domain.

---

## Table of Contents

1. [Claude Core Capabilities](#claude-core-capabilities)
2. [Available Tools](#available-tools)
3. [Integrated Frameworks](#integrated-frameworks)
4. [Agent Capabilities](#agent-capabilities)
5. [Memory & Learning Systems](#memory--learning-systems)
6. [Development Methodologies](#development-methodologies)
7. [Patterns & Workflows](#patterns--workflows)
8. [Quick Command Reference](#quick-command-reference)
9. [Best Practices](#best-practices)

---

## Claude Core Capabilities

### Reasoning Powers
- **Multi-step problem solving** — Break complex problems into manageable steps
- **Code generation** — Write, fix, refactor code in 50+ languages (JavaScript, Python, Go, Rust, etc.)
- **Analysis & debugging** — Root-cause analysis, pattern detection, anomaly finding
- **Architecture & design** — System design, trade-off analysis, pattern selection
- **Documentation** — Write specs, guides, tutorials, READMEs, API references
- **Code review** — Security audit, performance analysis, best practices verification
- **Test generation** — Unit tests, integration tests, edge case identification
- **Refactoring** — Extract functions, improve naming, optimize algorithms
- **Translation** — Convert between languages, frameworks, paradigms
- **Explanation** — Clarify code, teach concepts, explain decisions

### Guarantees & Constraints
- ✅ Can read any file in the project
- ✅ Can write/edit files in designated areas (checked in settings.json)
- ✅ Can execute shell commands (npm, git, python, docker, etc.)
- ✅ Cannot make destructive decisions alone (asks for approval on sensitive actions)
- ✅ Cannot hallucinate — will ask for clarification if uncertain
- ✅ Cannot override user intent — respects configuration and permissions

---

## Available Tools

### 1. File Operations

#### Read
Read any file to understand context.
```bash
Read(file_path)
Read(file_path, offset, limit)  # For large files, read specific lines

# Returns file contents with line numbers
```

#### Write
Create new files.
```bash
Write(file_path, content)

# Creates new file; fails if file exists (use Edit for modifications)
```

#### Edit
Modify existing files with surgical precision.
```bash
Edit(file_path, old_string, new_string)
Edit(file_path, old_string, new_string, replace_all=true)

# Changes only the specified old_string to new_string
# Use replace_all=true to replace all occurrences
```

#### Glob
Find files by pattern (fast, no context cost).
```bash
Glob(pattern)
Glob(pattern, path)

# Examples
Glob("**/*.test.js")          # All test files
Glob("src/**/*.ts")           # TypeScript files in src
Glob("docs/*.md")             # Markdown in docs
```

#### Grep
Search file contents with regex and context.
```bash
Grep(pattern)
Grep(pattern, glob="*.js")           # Filter by glob
Grep(pattern, type="js")             # Filter by file type
Grep(pattern, output_mode="content") # Show matching lines
Grep(pattern, output_mode="files_with_matches")  # Show just file paths

# Returns matching lines with context
```

### 2. Shell Operations

#### Bash
Execute shell commands.
```bash
Bash(command)
Bash(command, timeout=120000)  # Timeout in milliseconds

# Examples
Bash("npm test")              # Run tests
Bash("git log --oneline")     # View commit history
Bash("python3 migrate.py")    # Run scripts
Bash("docker build .")        # Container operations
```

**Useful patterns:**
```bash
# Check if tool is installed
which npm && npm --version

# Run multiple commands
npm install && npm test && npm run build

# Pipe output
git log --oneline | head -20
grep "TODO" src/**/*.js | wc -l

# Background processes
npm run dev &
npm test &

# Conditional execution
npm test && git commit -m "..." || echo "Tests failed"
```

### 3. Code Understanding

#### Grep (for code search)
Find functions, classes, imports, patterns.
```bash
Grep("^const authenticate = ")     # Function definitions
Grep("^import|^require")            # Imports/requires
Grep("app\.(get|post|put|delete)")  # API routes
Grep("class.*extends")              # Class definitions
Grep("export")                      # Exports
```

#### Glob (for codebase mapping)
Understand project structure by file type.
```bash
Glob("src/components/**/*.jsx")     # React components
Glob("server/routes/**/*.js")       # API routes
Glob("**/__tests__/**")             # Test files
Glob("docs/**/*.md")                # Documentation
Glob("**/*.json")                   # Config files
```

---

## Integrated Frameworks

### 1. Superpowers Methodology (Brainstorm → Design → Plan → Execute → Review)

A universal 5-phase development workflow ensuring quality and alignment.

#### Phase 1: Brainstorm
Ask clarifying questions before proceeding.
```
User: "Add email notifications"
Claude: "Questions:
- What events trigger email? (assignment, completion, overdue?)
- Retry logic? (yes, 3x?)
- Template format? (HTML or plain text?)
- Rate limiting? (per user, per hour?)
- Who sends? (admin, system, no-reply?)
"
```

#### Phase 2: Design
Propose 2-3 approaches with trade-offs.
```
Option A: Nodemailer + SMTP (free, self-hosted, config required)
Option B: SendGrid API (simple, requires API key, $ at scale)
Option C: AWS SES (reliable, complex setup, integrates with infra)

Recommendation: Option B (good balance of simplicity + reliability)
```

#### Phase 3: Plan (/plan)
Use `/plan` for non-trivial tasks to design architecture.
```bash
/plan
→ Research: What files need to change?
→ Design: Architecture diagram
→ Identify: Edge cases, dependencies, testing strategy
→ Get approval before implementation
```

#### Phase 4: Execute (RED-GREEN-REFACTOR)
Test-first development cycle.
```
RED:      Write failing test (specify what should happen)
GREEN:    Write minimal code to pass test
REFACTOR: Improve code without breaking tests
```

#### Phase 5: Review
Audit code before merging.
```bash
/security-reviewer
→ Check for security vulnerabilities
→ Review error handling and input validation
→ Verify API contracts and integration
```

**21 Superpowers Skills:**
- `/using-superpowers` — Framework guide
- `/brainstorming` — Explore requirements
- `/writing-plans` — Design implementation
- `/test-driven-development` — RED-GREEN-REFACTOR patterns
- `/subagent-driven-development` — Execute with agents
- `/dispatching-parallel-agents` — Run agents in parallel
- `/systematic-debugging` — Root-cause analysis
- `/verification-before-completion` — Verify before claiming done
- `/requesting-code-review` — Request structured review
- `/receiving-code-review` — Handle feedback rigorously
- `/using-git-worktrees` — Isolated workspaces
- `/finishing-a-development-branch` — Branch completion
- `/executing-plans` — Execute written plans
- `/writing-skills` — Create custom skills
- Plus 7 domain-specific skills per project

---

### 2. Ruflo: Multi-Agent AI Orchestration

100+ specialized agents for parallel development with quality gates.

#### Phase Builder Pattern
Orchestrates parallel agent teams with evaluation and consensus voting.

```
/phase-builder
or
Build Phase 1

→ Spawns N agents in parallel (independent domains)
→ M Quality Evaluators assess outputs
→ K Directors vote with rationale
→ Results stored (AgentDB, beads, or project system)
```

#### Agent Types (by Domain)
```
Domain Agents (customizable per project):
- Auth Agent (security, credentials, identity)
- Data Agent (database, schema, migrations)
- Frontend Agent (UI, components, routing)
- API Agent (endpoints, contracts, validation)
- Notification Agent (messaging, alerts, delivery)
- Infra Agent (deployment, containers, scaling)
- Testing Agent (test generation, coverage, quality)
```

#### Quality Evaluation Gates (SupaConductor Pattern)
```
1. Architecture Evaluator
   ✓ Design patterns match domain
   ✓ No circular dependencies
   ✓ Scalability considered

2. Code Quality Evaluator
   ✓ No console.logs, commented-out code
   ✓ Type safety (TypeScript/JSDoc)
   ✓ No hardcoded secrets

3. Integration Evaluator
   ✓ API contracts correct
   ✓ Auth guards enforced
   ✓ Data validation in place

4. Compliance/Business Evaluator
   ✓ Requirements met
   ✓ Tests written and passing
   ✓ No scope creep
```

#### Board of Directors (Consensus Voting)
```
Chief Architect          → Technical correctness & patterns
Chief Product Officer    → Feature completeness & UX
Chief Security Officer   → Auth, data protection, secrets
Chief Operating Officer  → Code quality, maintainability
Chief Experience Officer → Usability, accessibility, tone

Voting Rules:
  APPROVE:   4/5 or 5/5 vote yes → proceed
  REMEDIATE: 3/5 or more vote remediate → fix & re-evaluate (max 5 retries)
  ESCALATE:  Tied or 2+ vote escalate → human review
```

#### AgentDB Namespaces (Shared Agent Memory)
```
phase-{N}              → Agents working on phase N
phase-{N}-eval         → Evaluator assessments
phase-{N}-board        → Director votes + rationale
phase-{N}-approved     → Approved, ready for next phase
phase-{N}-issues       → Issues requiring remediation
phase-{N}-retry-{x}    → Retry attempt tracking
claude-memories        → Auto-synced from local memory
patterns               → SONA neural learning trajectories
reserved               → Do NOT shadow (pattern, default)
```

---

### 3. Graphify: Knowledge Graph

Semantic code understanding with queryable relationships.

#### Commands
```bash
graphify query "<question>"      # Semantic search → scoped subgraph
graphify path "<A>" "<B>"        # Find relationships between concepts
graphify explain "<concept>"     # Focused explanation
graphify update .                # Rebuild after code changes
```

#### Usage Pattern
```
Before grepping raw files, use graphify for focused results:

graphify query "How do users authenticate?"
→ Returns scoped subgraph (30-50 tokens vs. full GRAPH_REPORT)

graphify path "user_id" "authentication"
→ Shows relationship chain

graphify explain "session_management"
→ Explains that specific concept
```

**Benefits:**
- Reduced token waste (scoped results instead of full files)
- Auto-rebuilds on commit (git hooks)
- Queryable relationships and concepts

---

### 4. Beads: Cross-Session Work Tracking

Append-only JSONL event log for durability across context resets.

#### Three Files Track Everything
```
.beads/status.jsonl     → Work items (open → in_progress → closed)
.beads/decisions.jsonl  → Phase decisions (board votes, rationale)
.beads/failures.jsonl   → Evaluation failures, blockers, escalations
```

#### Bead Format (One JSON per line)
```json
{
  "id": "unique_id",
  "timestamp": "2026-05-17T22:30:00Z",
  "session_id": "session_20260517_claude_code",
  "type": "status|decision|failure|note",
  "status": "open|in_progress|closed",
  "phase": "0|1|2|...|N",
  "agent": "phase-builder|user|hook|automation",
  "title": "Brief one-line description",
  "body": "Detailed notes (markdown support)",
  "metadata": {
    "priority": "low|medium|high|critical",
    "tag": "auth|frontend|database",
    "file_path": "path/to/file.js",
    "line_number": 42
  },
  "relationships": ["bead_id_1", "bead_id_2"]
}
```

#### SessionStart Auto-Injection
Every session, the SessionStart hook reads `.beads/status.jsonl`:
```
If open beads exist → injects as context:

"Open Work Items from Previous Session:
 - Auth Agent: Implement authentication
 - Data Agent: Implement schema migration"

Silent if no open beads (no context pollution)
```

#### Querying Beads
```bash
grep '"status":"open"' .beads/status.jsonl           # All open work
grep '"type":"decision"' .beads/decisions.jsonl       # All decisions
grep '"phase":"1"' .beads/failures.jsonl              # Phase 1 failures
grep '"priority":"critical"' .beads/status.jsonl      # Critical items
```

---

## Agent Capabilities

### How to Spawn an Agent

```bash
Agent(
  description: "Brief 3-5 word summary",
  prompt: "Detailed task for the agent",
  subagent_type: "Explore|Plan|general-purpose|security-reviewer|claude-code-guide"
)
```

### Available Agent Types

#### 1. Explore Agent
Fast codebase search and analysis.
```bash
Agent(
  description: "Find all API endpoints",
  subagent_type: "Explore",
  prompt: "Search for all HTTP endpoints (GET, POST, PUT, DELETE). 
           List files, methods, paths, and line numbers."
)
```
**Use for:** Finding code by pattern, locating symbols, exploring components

#### 2. Plan Agent
Architecture and design planning.
```bash
Agent(
  description: "Design authentication system",
  subagent_type: "Plan",
  prompt: "Design authentication system supporting JWT, bcrypt, refresh tokens.
           Consider: token storage, revocation, role-based access. 
           Provide architecture and SQL schema."
)
```
**Use for:** Architecture review, multi-step design, edge cases, trade-offs

#### 3. General-Purpose Agent
Multi-step task execution.
```bash
Agent(
  description: "Implement user CRUD endpoints",
  subagent_type: "general-purpose",
  prompt: "Implement user CRUD: 1) POST endpoint, 2) Database migration, 
           3) Tests, 4) API docs. Follow RED-GREEN-REFACTOR pattern."
)
```
**Use for:** Complex multi-file changes, research + implementation, coordination

#### 4. Security Reviewer Agent
Code security audit.
```bash
Agent(
  description: "Audit authentication code",
  subagent_type: "security-reviewer",
  prompt: "Review authentication for vulnerabilities: SQL injection, XSS, CSRF,
           secrets management, password hashing. Report findings with severity."
)
```
**Use for:** Security audit before merge, vulnerability scanning, compliance

#### 5. Claude Code Guide Agent
Answer questions about Claude Code features.
```bash
Agent(
  description: "Help with MCP configuration",
  subagent_type: "claude-code-guide",
  prompt: "How do I set up custom MCP servers? What's the settings.json format?"
)
```
**Use for:** Tool questions, configuration help, feature exploration

### Agent Patterns

#### Pattern 1: Parallel Independent Agents
Run multiple agents simultaneously (same message, multiple Agent calls).
```
Agent 1: Search for all database queries
Agent 2: Find all API endpoints
Agent 3: Locate all UI components

→ All run simultaneously, results combined
```

#### Pattern 2: Sequential Dependent Agents
Run agents sequentially (output of one informs next).
```
Step 1: Explore agent finds all references to concept X
Step 2: Plan agent designs refactoring based on exploration
Step 3: General-purpose agent implements the plan
Step 4: Security-reviewer agent audits before merge
```

#### Pattern 3: Subagent-Driven Development
Complex task split across multiple agents with checkpoints.
```
1. Explore: Understand current state
2. Plan: Design architecture
3. General-purpose: Implement all files
4. Security-reviewer: Audit before merge
```

---

## Memory & Learning Systems

### 1. Local Memory (.claude/projects/*/memory/)

Persistent memories across sessions in your workspace.

```
.claude/projects/{project_name}/memory/
├── MEMORY.md              # Index of all memories
├── user_*.md              # About the user
├── feedback_*.md          # How to approach work
├── project_*.md           # Ongoing initiatives
└── reference_*.md         # External system pointers
```

#### Memory Types

**User Memory:**
```markdown
---
name: user_role
description: User is a senior engineer, focused on performance optimization
metadata:
  type: user
---

User is a senior backend engineer with 15 years Go experience, new to Rust.
Ask about performance trade-offs and ask for Go comparisons before suggesting Rust idioms.
```

**Feedback Memory:**
```markdown
---
name: feedback_testing
description: Always use real database in tests, not mocks
metadata:
  type: feedback
---

**Rule:** Use real database (in-memory), not mocks.

**Why:** Previous incident where mocked tests passed but production migration failed.

**How to apply:** When writing tests, use real DB instance, not jest.mock().
```

**Project Memory:**
```markdown
---
name: project_migration_deadline
description: Database migration deadline 2026-05-25
metadata:
  type: project
---

Database migration deadline: 2026-05-25 (one week).
Blocked on: Schema review from infra team.
Related: Microservices deployment depends on migration.
```

**Reference Memory:**
```markdown
---
name: reference_issue_tracker
description: Bugs tracked in Linear project "BACKEND"
metadata:
  type: reference
---

Performance bugs tracked in Linear project "BACKEND".
Check there for context on slow API endpoints.
```

### 2. AgentDB (Ruflo Vector Database)

Shared agent memory via semantic vector search.

```bash
# Search agent knowledge
/agentdb search "How do we handle rate limiting?"
/agentdb search "What authentication strategy did we choose?"

# Store insights
/memory save-result --question "Q" --answer "A" --type query --nodes node1 node2
```

**Namespaces:** phase-{N}, claude-memories, patterns, reserved namespaces

### 3. SONA Learning (Neural Trajectories)

Agents learn from past decisions and patterns.

**Examples of learned insights:**
```
"When task deadline < 1 week, add hourly reminders"
"Dependencies usually cause 3-day delays"
"Users prefer email over in-app for critical alerts"
"Schema migrations need 2-day staging period"
```

---

## Development Methodologies

### Test-First Development (RED-GREEN-REFACTOR)

```javascript
// RED: Write failing test first
test('POST /api/users creates user with hashed password', async () => {
  const res = await request(app)
    .post('/api/users')
    .send({ email: 'user@example.com', password: 'secret123' });
  
  expect(res.status).toBe(201);
  expect(res.body.email).toBe('user@example.com');
  expect(res.body.password).toBeUndefined(); // Never return hashed password
});
// npm test → FAIL ✗

// GREEN: Write minimal code to pass
app.post('/api/users', async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const user = db.query(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    [req.body.email, hashedPassword]
  );
  res.status(201).json({ id: user.id, email: user.email });
});
// npm test → PASS ✓

// REFACTOR: Improve without breaking tests
const createUser = async (db, email, password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return db.query('INSERT INTO users ...', [email, hashedPassword]);
};

app.post('/api/users', async (req, res) => {
  try {
    const user = await createUser(db, req.body.email, req.body.password);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    res.status(400).json({ error: 'Invalid email or password' });
  }
});
// npm test → PASS ✓
```

### Code Review (Two-Stage)

**Stage 1: Spec Compliance**
- Does it match the plan?
- All subtasks completed?
- Tests passing?

**Stage 2: Code Quality** (use `/security-reviewer`)
- Follows conventions?
- Security vulnerabilities?
- Performance acceptable?
- Error handling correct?

### Commit Message Format

```
[Phase #] Brief description

RED-GREEN-REFACTOR:
- RED: What test you wrote first
- GREEN: How you made it pass
- REFACTOR: How you improved it

Closes #123 (if applicable)
```

Example:
```
[Phase 2] Add user authentication with JWT

RED-GREEN-REFACTOR:
- RED: Test POST /api/auth/login returns JWT token
- GREEN: Implement login route with bcrypt password hashing
- REFACTOR: Extract JWT verify to middleware, add error handling

Closes #42
```

---

## Patterns & Workflows

### Building a Feature (Superpowers Cycle)

```
1. BRAINSTORM
   - What problem does this solve?
   - Who uses it?
   - What are the requirements?

2. DESIGN
   - Option A: [approach with trade-offs]
   - Option B: [approach with trade-offs]
   - Recommendation: Option A because [reasons]

3. PLAN (/plan)
   - Files to create/modify
   - Dependencies to consider
   - Testing strategy
   - Edge cases

4. EXECUTE (RED-GREEN-REFACTOR)
   - RED: Write failing test
   - GREEN: Implement to pass test
   - REFACTOR: Improve code

5. REVIEW (/security-reviewer)
   - Security check
   - Code quality check
   - Performance check
```

### Debugging a Bug (Systematic Approach)

```
1. REPRODUCE
   - Gather error message, stack trace, user action
   - Write failing test that reproduces bug

2. INVESTIGATE
   - Search for related code
   - Read execution path
   - Add logging, test hypothesis

3. ROOT CAUSE
   - Narrow down: logic? API? data? configuration?
   - Confirm with additional tests

4. FIX
   - Write test with correct behavior
   - Implement fix
   - Refactor if needed

5. VERIFY
   - Original test now passes
   - No regressions (run full test suite)
```

### Parallel Agent Development

```
Task: Build multi-user system

Spawn in parallel:
- Auth Agent: authentication, sessions, tokens
- Data Agent: users table, schema, migrations
- API Agent: user endpoints, validation
- Frontend Agent: login form, user profile UI

All coordinate via AgentDB namespace `feature-auth`

Quality gates:
→ Architecture Evaluator (design patterns?)
→ Code Quality Evaluator (no console.logs?)
→ Integration Evaluator (contracts match?)
→ Compliance Evaluator (requirements met?)

Board votes:
→ APPROVE: merge to main
→ REMEDIATE: fix and re-evaluate
→ ESCALATE: human review
```

---

## Quick Command Reference

### Invoke Skills
```bash
/using-superpowers          # Framework guide
/brainstorming              # Explore requirements
/writing-plans              # Design implementation
/test-driven-development    # RED-GREEN-REFACTOR patterns
/subagent-driven-development # Execute with agents
/skill-auth                 # Domain-specific skills
/skill-db
/skill-api
/skill-frontend
/skill-testing
```

### Spawn Agents
```bash
Agent(description: "...", subagent_type: "Explore")
Agent(description: "...", subagent_type: "Plan")
Agent(description: "...", subagent_type: "general-purpose")
Agent(description: "...", subagent_type: "security-reviewer")
```

### Search & Navigation
```bash
graphify query "question?"
graphify path "A" "B"
graphify explain "concept"
graphify update .

Grep("pattern")
Glob("**/*.js")

/agentdb search "question?"
/phase-builder             # Trigger parallel agents
```

### Git Workflow (Universal)
```bash
git status
git diff
git add .
git commit -m "[Phase #] Description"
git push origin feature-name

git log --oneline
git branch -a
git checkout -b feature/new-feature
```

### Development (Language-Agnostic)
```bash
# Install dependencies
npm install       # Node.js/JavaScript
pip install -r requirements.txt  # Python
cargo build       # Rust
go mod download   # Go

# Run tests
npm test
python -m pytest
cargo test
go test ./...

# Run development server
npm run dev
python manage.py runserver
cargo run
go run main.go

# Lint & format
npm run lint
black .
rustfmt --check .
gofmt -l .
```

---

## Best Practices

### Code Conventions (Language-Neutral)
- ✅ No comments unless WHY is non-obvious
- ✅ Validate only at system boundaries (user input, external APIs)
- ✅ All protected routes: authentication guard
- ✅ All user-scoped operations: verify ownership
- ✅ Never expose sensitive data in responses (passwords, tokens, secrets)
- ✅ Test-first (RED-GREEN-REFACTOR)
- ✅ Use real databases in tests, not mocks
- ✅ No console.logs, commented-out code, or debug statements

### Agent Best Practices
- ✅ Use Explore for finding code by pattern
- ✅ Use Plan for architecture design
- ✅ Use general-purpose for multi-file implementation
- ✅ Use security-reviewer before merging sensitive code
- ✅ Run agents in parallel when independent
- ✅ Open beads before starting work
- ✅ Close beads when work completes
- ✅ Save learnings to memory at session end

### Documentation Best Practices
- ✅ All `.md` files have YAML frontmatter (phase, status, owner, last_updated)
- ✅ Main docs (CLAUDE.md) < 150 lines (route detail to L2/L3 docs)
- ✅ Reference docs < 300 lines (split if longer)
- ✅ Runbooks < 200 lines (step-by-step only)
- ✅ Update `last_updated` when verifying content

---

## When to Use Each Tool/Framework

| Need | Tool | When to Use |
|------|------|------------|
| Find a file | Glob | Need files by pattern |
| Search code | Grep | Need text/pattern search |
| Understand concept | graphify explain | Need semantic understanding |
| Find relationships | graphify path | Need to map dependencies |
| Understand a file | Read | Need full context |
| Create file | Write | Building new file |
| Modify file | Edit | Surgical changes only |
| Run command | Bash | Execute any CLI tool |
| Find code broadly | Explore Agent | Need to understand codebase |
| Design architecture | Plan Agent | Need multi-step design |
| Implement large feature | General Agent | Multi-file implementation |
| Audit security | Security Agent | Before merging sensitive code |
| Brainstorm ideas | Use Brainstorming skill | Explore requirements |
| Test-first code | Use RED-GREEN-REFACTOR | Writing quality code |

---

## Installation & Setup

### Superpowers Framework

**Install superpowers skills in your project:**

```bash
# Install the superpowers framework
npx skills add superpowers

# Install individual domain-specific skills
npx skills add superpowers/auth       # JWT, bcrypt, sessions
npx skills add superpowers/database   # SQL, migrations, schemas
npx skills add superpowers/api        # REST, gRPC, contracts
npx skills add superpowers/frontend   # React, Vue, Angular patterns
npx skills add superpowers/testing    # Jest, pytest, testing patterns
```

**Repository:** https://github.com/obra/superpowers

**Quick Start:**
```bash
/using-superpowers
```

---

### Graphify Knowledge Graph

**Install graphify CLI:**

```bash
# Via pip
pip install graphify

# Via npm (if available)
npm install -g graphify

# Or build from source
git clone https://github.com/safishamsi/graphify
cd graphify
pip install -e .
```

**Repository:** https://github.com/safishamsi/graphify

**First-time setup in your project:**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# OR
export OPENAI_API_KEY="sk-..."
# OR
export GEMINI_API_KEY="..."

graphify extract . --out graphify-out
```

**Git hook integration (auto-rebuild on commit):**

```bash
# Already set up if .git/hooks/post-commit exists
# Otherwise:
git hooks install  # If graphify provides it
```

---

### Ruflo Multi-Agent Orchestration

**Install Ruflo and plugins:**

```bash
# Core orchestration
npx ruflo init

# Install MCP servers
npx mcp install @supabase/supabase-mcp
npx mcp install @anthropic-ai/resources-mcp

# Or via MCP server directory
~/.mcp/servers/
├── ruflo-core
├── ruv-swarm
├── flow-nexus
└── [custom servers]
```

**Repositories:**
- Core: https://github.com/anthropics/ruflo
- Supabase MCP: https://github.com/supabase/supabase-mcp
- Custom agent skills: `.claude/skills/` (project-local)

**Invoke Phase Builder:**

```bash
/phase-builder
# or
Build Phase 1
```

---

### Beads Work-Tracking System

**What Beads Are:**

Append-only JSONL event log for tracking work across context resets. When Claude Code sessions end and restart, work-in-progress is automatically re-injected as context.

**Bootstrap beads in your project:**

```bash
# Create .beads/ directory structure
mkdir -p .beads

# Initialize beads files
echo '{"id":"bootstrap","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","type":"note","status":"open","phase":"0","agent":"automation","title":"Bootstrap beads system","body":"Initial session","metadata":{},"relationships":[]}' > .beads/status.jsonl

echo '{}' > .beads/_manifest.json
touch .beads/decisions.jsonl
touch .beads/failures.jsonl

# Create .beads/README.md with documentation
cat > .beads/README.md << 'EOF'
---
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-05-17T22:30:00Z"
beads: []
---

# Beads Work-Tracking System

Append-only JSONL event log for cross-session durability.

See parent project MASTER_CAPABILITIES.md → Integrated Frameworks → Beads.
EOF
```

**Or use bootstrap script:**

```bash
# Create helper script at .claude/hooks/bootstrap-beads.sh
mkdir -p .claude/hooks
cat > .claude/hooks/bootstrap-beads.sh << 'EOF'
#!/bin/bash
set -e

echo "Bootstrapping beads system..."
mkdir -p .beads

# Initialize JSONL files if they don't exist
[ -f .beads/status.jsonl ] || echo '{"id":"bootstrap","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","type":"note","status":"open","phase":"0","agent":"automation","title":"Bootstrap beads","body":"","metadata":{},"relationships":[]}' > .beads/status.jsonl

[ -f .beads/decisions.jsonl ] || touch .beads/decisions.jsonl
[ -f .beads/failures.jsonl ] || touch .beads/failures.jsonl
[ -f .beads/_manifest.json ] || echo '{"version":"1.0","created_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","session_count":0,"bead_count":1}' > .beads/_manifest.json

echo "✓ Beads bootstrap complete"
chmod +x .claude/hooks/bootstrap-beads.sh
EOF

# Run bootstrap
bash .claude/hooks/bootstrap-beads.sh
```

**Wire hooks into settings.json:**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/session-start"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/on-stop.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/pre-tool-use-write-guard.sh"
          }
        ]
      }
    ]
  }
}
```

**Create SessionStart hook (at .claude/hooks/session-start):**

```bash
#!/bin/bash
# Inject open beads from previous session

if [ -f .beads/status.jsonl ]; then
  OPEN_COUNT=$(grep -c '"status":"open"' .beads/status.jsonl 2>/dev/null || echo 0)
  if [ "$OPEN_COUNT" -gt 0 ]; then
    echo ""
    echo "📌 Open Work Items from Previous Session:"
    grep '"status":"open"' .beads/status.jsonl | jq -r '.title' | sed 's/^/  - /'
    echo ""
  fi
fi
```

**Create Stop hook (at .claude/hooks/on-stop.sh):**

```bash
#!/bin/bash
# Remind about unclosed beads

if [ -f .beads/status.jsonl ]; then
  UNCLOSED=$(grep -c '"status":\s*"open\|in_progress"' .beads/status.jsonl 2>/dev/null || echo 0)
  if [ "$UNCLOSED" -gt 0 ]; then
    echo ""
    echo "⚠️  Note: $UNCLOSED unclosed beads in .beads/status.jsonl"
    echo "Consider closing them before next session:"
    grep '"status":\s*"open\|in_progress"' .beads/status.jsonl | jq -r '.title' | sed 's/^/  - /' | head -5
  fi
fi
```

**Create write guard hook (at .claude/hooks/pre-tool-use-write-guard.sh):**

```bash
#!/bin/bash
# Validate YAML frontmatter on markdown writes

FILE_PATH="$1"
CONTENT="$2"

# Skip generated files
if [[ "$FILE_PATH" =~ (graph.json|GRAPH_REPORT|manifest.json|cache/) ]]; then
  exit 0
fi

# Check markdown files for YAML frontmatter
if [[ "$FILE_PATH" =~ \.(md)$ ]]; then
  if ! echo "$CONTENT" | grep -q "^---\nphase:"; then
    # Log violation (soft enforcement - don't block)
    echo "{\"id\":\"guard_$(date +%s)\",\"type\":\"failure\",\"status\":\"open\",\"title\":\"Missing YAML frontmatter\",\"body\":\"$FILE_PATH\",\"metadata\":{},\"relationships\":[]}" >> .beads/failures.jsonl 2>/dev/null || true
  fi
fi

exit 0
```

**Add metadata contract to all markdown files:**

```yaml
---
phase: "0"
status: "active"
owner: "automation"
last_updated: "2026-05-17T22:30:00Z"
beads: []
---

# Your Content Here
```

**Read & query beads:**

```bash
# Show all open work items
grep '"status":"open"' .beads/status.jsonl

# Show all phase decisions
grep '"type":"decision"' .beads/decisions.jsonl | jq '.'

# Show all failures/issues
grep '"type":"failure"' .beads/failures.jsonl

# Pretty-print one bead
grep 'specific_id' .beads/status.jsonl | jq '.'

# Count by phase
grep '"phase":"1"' .beads/status.jsonl | wc -l

# Close a bead (append new status)
echo '{"id":"xyz","status":"closed","timestamp":"2026-05-17T..."}' >> .beads/status.jsonl
```

**How beads integrate with agents:**

When you spawn agents, they should:
1. **Open** a bead when starting work: `{"id":"agent_name_task","status":"open",...}`
2. **Update** to in_progress: `{"id":"agent_name_task","status":"in_progress",...}`
3. **Close** when done: `{"id":"agent_name_task","status":"closed",...}`

SessionStart hook auto-injects open beads, so agents see: "Here's what was being worked on."
Stop hook reminds: "Close your beads before ending session."

**Example workflow:**

```bash
# Session 1: Start work
/phase-builder
→ Spawns agents
→ Auth Agent creates: {"id":"auth_p1","status":"open",...}
→ Task Manager Agent creates: {"id":"tm_p1","status":"open",...}

# Session 1 ends
Stop hook reminds: "⚠️ 2 unclosed beads"

# Session 2: Work resumes
SessionStart hook injects: "Open Work Items:
  - Auth Agent: Implement authentication
  - Task Manager Agent: Implement schema"

Auth Agent sees previous work, updates:
{"id":"auth_p1","status":"in_progress",...}

# Session 2 ends
Auth Agent closes: {"id":"auth_p1","status":"closed",...}

# Session 3 starts
SessionStart hook silent (no open beads)
```

---

### Claude Code CLI

**Install Claude Code:**

```bash
# macOS
brew install anthropics/tap/claude-code

# Windows
# Download from https://claude.ai/code

# Linux
curl -O https://release.claude-code.io/claude-code-linux.tar.gz
tar xzf claude-code-linux.tar.gz
./install.sh
```

**Repository:** https://github.com/anthropics/claude-code

**Verify installation:**

```bash
claude-code --version
```

---

### IDE Extensions

**VS Code:**

```bash
# Install from VS Code Marketplace
# Search: "Claude Code" or "Anthropic"

# Or install via CLI
code --install-extension anthropic.claude-code
```

**JetBrains (IntelliJ, PyCharm, etc.):**

```bash
# Install from JetBrains Marketplace
# Settings → Plugins → Search "Claude Code"
```

**Links:**
- VS Code: https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code
- JetBrains: https://plugins.jetbrains.com/plugin/claude-code

---

### MCP Servers (Model Context Protocol)

**Install and configure MCP servers:**

```bash
# Create MCP config file
~/.claude/mcp.json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["node_modules/@supabase/supabase-mcp/build/index.js"]
    },
    "git": {
      "command": "npx",
      "args": ["git-mcp"]
    }
  }
}
```

**Available MCP Servers:**
- **Supabase:** https://github.com/supabase/supabase-mcp — Database operations
- **GitHub:** https://github.com/anthropics/github-mcp — Issue/PR management
- **Google Drive:** https://github.com/anthropics/google-drive-mcp — File access
- **Gmail:** https://github.com/anthropics/gmail-mcp — Email operations
- **Notion:** https://github.com/anthropics/notion-mcp — Database sync
- **Slack:** https://github.com/anthropics/slack-mcp — Chat integration

**Configure in Claude Code settings.json:**

```json
{
  "mcpServers": [
    {
      "name": "supabase",
      "enabled": true,
      "config": {
        "projectId": "your-project-id",
        "apiKey": "your-api-key"
      }
    }
  ]
}
```

---

### Custom Skills & Agents

**Create custom skills in your project:**

```bash
# Structure
.claude/skills/
├── skill-auth/
│   ├── SKILL.md          # Skill definition
│   ├── examples/
│   └── MANIFEST.json     # Metadata
├── skill-database/
└── [project-specific skills]

# Invoke custom skill
/skill-auth
/skill-database
```

**Skill template:**

```markdown
---
name: skill-auth
description: JWT + bcrypt authentication patterns
metadata:
  type: skill
  tags: [security, authentication]
---

# Authentication Skill

Use this skill for JWT + bcrypt patterns...
```

**Register in settings.json:**

```json
{
  "skills": [
    {
      "name": "skill-auth",
      "path": ".claude/skills/skill-auth/SKILL.md",
      "enabled": true
    }
  ]
}
```

---

### Testing Frameworks

**Install testing tools per language:**

```bash
# JavaScript/Node.js
npm install --save-dev jest @testing-library/react supertest

# Python
pip install pytest pytest-cov pytest-mock

# Go
go get github.com/stretchr/testify/assert

# Rust
cargo add --dev criterion tokio
```

**Configure in project:**

```bash
# Jest config (package.json or jest.config.js)
{
  "jest": {
    "testEnvironment": "node",
    "collectCoverage": true,
    "coveragePathIgnorePatterns": ["node_modules"]
  }
}

# Pytest config (pytest.ini)
[pytest]
testpaths = tests
python_files = test_*.py
```

---

### Security & Linting

**Install linters and security tools:**

```bash
# JavaScript
npm install --save-dev eslint prettier @typescript-eslint/eslint-plugin

# Python
pip install flake8 black isort bandit

# Go
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Rust
cargo install clippy
```

**Configure:**

```bash
# .eslintrc.json
{
  "extends": ["eslint:recommended"],
  "rules": {
    "no-console": "warn",
    "no-var": "error"
  }
}

# .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5"
}
```

---

## Plugin Checklist for New Projects

```bash
# Step 1: Initialize Claude Code
claude-code init [project-path]

# Step 2: Install Superpowers
npx skills add superpowers

# Step 3: Install Graphify
pip install graphify

# Step 4: Bootstrap Beads
mkdir -p .beads
./.claude/hooks/bootstrap-beads.sh

# Step 5: Install testing framework
npm install --save-dev jest  # or pytest/go test/cargo

# Step 6: Install linters
npm install --save-dev eslint prettier

# Step 7: Set up IDE extension
# VS Code: Install from Marketplace
# JetBrains: Settings → Plugins

# Step 8: Configure .claude/settings.json
cp MASTER_CAPABILITIES.md .claude/
# Add your custom hooks, skills, permissions

# Step 9: Test everything
/using-superpowers
graphify query "test"
Agent(description: "test", subagent_type: "Explore")
```

---



### For Agents
Give this document when:
- Spawning agents for a new feature/project
- Starting complex refactors
- Building new services/codebases
- Onboarding to a new team/project

### For Projects
Place in `.claude/MASTER_CAPABILITIES.md` and reference in:
- `.claude/agents/[agent-name].md` — Link to capabilities
- `CLAUDE.md` — Link in development section
- `docs/CONTRIBUTING.md` — Link in workflow section
- `README.md` — Link in development section

### For Teams
Update when:
- New agent types available
- New framework integrated
- New pattern discovered
- Best practices change

---

**Last Updated:** 2026-05-17  
**Status:** Universal, project-agnostic  
**Distribution:** All agents, all projects, all tech stacks  
