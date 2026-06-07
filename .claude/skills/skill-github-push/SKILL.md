---
name: skill-github-push
description: Commit and push to GitHub following Anthropic best practices
metadata:
  type: skill
---

# GitHub Push Skill

Commit and push to GitHub following **Anthropic best practices**: clear messages, atomic commits, no force-push, no bypassing hooks.

## When to Use

- After completing a feature or fix
- After all tests pass
- When code is ready for review

## Usage Pattern

**Agent asks ONLY 3 things:**
1. Files to commit: `server/routes/auth.js, client/src/Login.jsx`
2. Commit message: `Fix: Add JWT token refresh endpoint`
3. Confirm push?: `yes`

**Agent then executes** ← no more questions.

## Best Practices (Anthropic Standards)

### ✅ DO

- **Atomic commits** — one logical change per commit
- **Clear messages** — describe the WHY, not what
- **Test first** — verify tests pass before commit
- **New commits** — never amend published commits
- **Specific files** — `git add file1 file2` (not `-A`)
- **Respect hooks** — never use `--no-verify`
- **Include Co-Author** — tag Claude in commit message

### ❌ DON'T

- Force-push to main (warn if user requests)
- Skip hooks with `--no-verify`
- Bypass signing with `-c commit.gpgsign=false`
- Amend commits after pushing
- Use `git add .` (catch unwanted files like `.env`)
- Commit secrets (.env, credentials.json)

## Implementation

### Step 1: Check Status
```bash
git status --short
```
→ Shows what's staged and unstaged

### Step 2: Stage Files
```bash
git add server/routes/auth.js client/src/Login.jsx
```
→ Only specific files (not `.`)

### Step 3: Draft Message

**Format:**
```
[Phase #] Brief description (under 70 chars)

Optional body (1-3 sentences explaining WHY):
- What problem does this solve?
- Why this approach?
- Any trade-offs?

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

**Examples:**

✅ Good:
```
[Phase 6] Fix: Add email validation to coach signup

Coaches were creating accounts with invalid emails.
Added regex validation to prevent malformed addresses.
No breaking changes.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

❌ Bad:
```
fix bugs
```

### Step 4: Create Commit
```bash
git commit -m "$(cat <<'EOF'
[Phase 7] Improve: Generate meaningful coaching messages via Groq

Use 3-agent swarm analysis + detailed coaching prompt to generate
authentic, personalized messages. No generic praise, references
concrete data (on-time rate, streaks, task titles).

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
EOF
)"
```

### Step 5: Push
```bash
git push origin main
```

→ Runs hooks automatically (don't skip!)

### Step 6: Verify
```bash
git log --oneline | head -3
```

→ Confirms commit is on main

## Common Scenarios

| Scenario | Action |
|----------|--------|
| User asks to amend | ❌ Refuse. Create NEW commit instead. |
| User asks force-push | ⚠️ Warn: "Force-push to main can destroy work" |
| User asks --no-verify | ❌ Refuse. Fix the hook issue instead. |
| Tests failing | ❌ Don't commit. Fix tests first. |
| Mix of features | ⚠️ Split into multiple atomic commits |
| Secrets in commit | ❌ Stop. Don't push. Use `git reset` and stash. |

## Error Recovery

### Pre-commit hook failed
```bash
# 1. Fix the issue (usually lint/format)
# 2. Stage again
git add file
# 3. Create NEW commit (never amend)
git commit -m "..."
```

### Wrong file committed (before push)
```bash
# 1. Undo last commit (keep changes)
git reset --soft HEAD~1
# 2. Unstage wrong file
git reset HEAD wrong-file
# 3. Create new commit
git add right-files
git commit -m "..."
```

### Committed to wrong branch
```bash
# 1. Copy commit hash
git log --oneline | head -1  # e.g., abc123def

# 2. Create feature branch
git checkout -b feature/fix-name

# 3. Go back to main, undo
git checkout main
git reset --hard origin/main
```

## Never Ask User

- "Should I use `-A`?" (always use specific files)
- "Should I skip hooks?" (always respect them)
- "Should I force-push?" (always warn first)
- "Should I amend?" (always create new commit)
- "Which branch?" (always main)
- "Co-author?" (always include Claude)

## Always Report

After push completes:
- ✅ Commit hash
- Commit message (first line)
- Files changed
- Push status
- GitHub URL
- "Ready for review on GitHub"

## Key Facts

- **Commit message:** Why > What (future reader context)
- **Atomic:** One logical change = one commit
- **No force:** Respect the git history
- **Hooks matter:** They catch bugs before push
- **Co-Author:** Tag Claude in every commit
- **Tests first:** Green before commit

## Examples

### Feature
```
[Phase 4] Add: Coach dashboard with KPI cards

New dashboard shows: total tasks, active, completed, overdue.
KPI cards render progress bars with coaching language.
Frontend responds 80%+ tests pass.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

### Bug Fix
```
[Phase 6] Fix: JWT token expiration causing logout

Coach sessions expired after 24h even with valid token.
Updated token refresh endpoint to extend expiration on each API call.
Prevents unexpected logouts during active work.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

### Security
```
[Phase 6] Secure: Remove password_hash from API responses

Admin list endpoint was leaking password hashes in coach objects.
Filter response to exclude password_hash, delay_reason details.
No behavior change, zero data leaks.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```
