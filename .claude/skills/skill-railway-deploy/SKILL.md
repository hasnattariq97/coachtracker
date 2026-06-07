---
name: skill-railway-deploy
description: Deploy to Railway via CLI with zero context required
metadata:
  type: skill
---

# Railway Deployment Skill

Deploy backend to Railway using CLI. **Zero context required** — agent asks only for: (1) git message, (2) deployment confirmation.

## When to Use

- After commits to backend code
- When `git push origin main` is done
- When you need to deploy immediately

## Usage Pattern

```javascript
// Agent behavior
if (needsRailwayDeploy) {
  1. Ask user: "Commit message?" (get string)
  2. Ask user: "Deploy to Railway?" (confirm)
  3. Run deployment (no more questions)
  4. Report status (success/failure + URL)
}
```

## Implementation

### Step 1: Commit & Push
```bash
git add <files>
git commit -m "<message>"
git push origin main
```

### Step 2: Link Project (One-Time)
```bash
cd server
railway link --workspace "Rumi Deployments" --project "surprising-expression"
```

### Step 3: Deploy
```bash
cd server
railway deployment up
```

### Step 4: Verify
```bash
# Check status
railway deployment list | head -2

# Verify live
curl https://spectacular-connection-production-d07b.up.railway.app/health
```

## Config Reference

**Project:** `surprising-expression`  
**Workspace:** `Rumi Deployments`  
**Environment:** `production`  
**Service:** `spectacular-connection`  
**Health Check URL:** `https://spectacular-connection-production-d07b.up.railway.app/health`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "No linked project" | Run `railway link ...` (see Step 2) |
| "Project not found" | Check workspace + project name spelling |
| Deployment stuck | Wait 2-3 min, then `railway deployment list` |
| Health check fails | Wait 30s (server warmup), retry |

## Expected Output

```
✓ Indexing...
✓ Uploading...
Build Logs: https://railway.com/...
✓ SUCCESS | timestamp
✓ Backend healthy: {"status":"ok","timestamp":"..."}
```

## Key Facts

- **Wait time:** 20-30 seconds build + deployment
- **No human intervention needed** after `railway deployment up`
- **Automatic:** New commit → push → deploy (one command chain)
- **URL never changes:** Always `spectacular-connection-production-d07b.up.railway.app`
- **Data persists:** PostgreSQL on Railway (not lost on redeploy)

## Never Ask User

- Which Railway project? (always `surprising-expression`)
- Which workspace? (always `Rumi Deployments`)
- What service? (always `spectacular-connection`)
- Confirmation after `railway deployment up`? (it's automatic)

## Always Report

After deploy completes:
- ✅ or ❌ status
- Build ID (e.g., `b99316aa...`)
- Deployment timestamp
- Health check result
- Live URL
