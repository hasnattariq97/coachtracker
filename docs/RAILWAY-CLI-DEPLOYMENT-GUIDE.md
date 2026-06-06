---
phase: "7+"
status: "active"
owner: "deployment-team"
last_updated: "2026-06-07T00:45:00Z"
beads: []
---

# Railway CLI Deployment Guide

**Complete reference for deploying Coach Task Tracker to Railway using the CLI**

---

## Table of Contents

1. [Installation](#installation)
2. [Initial Setup](#initial-setup)
3. [Deployment Methods](#deployment-methods)
4. [Checking Status & Logs](#checking-status--logs)
5. [Rollback & Troubleshooting](#rollback--troubleshooting)
6. [Automation & Scripts](#automation--scripts)

---

## Installation

### Prerequisites

- Node.js 16+ installed
- npm or yarn
- Railway account (sign up at https://railway.app)

### Install Railway CLI

```bash
# Using npm (recommended)
npm install -g @railway/cli

# Using yarn
yarn global add @railway/cli

# Or download binary from GitHub
# https://github.com/railwayapp/cli/releases
```

### Verify Installation

```bash
railway --version
# Output: railway 3.x.x

railway --help
# Shows all available commands
```

---

## Initial Setup

### Step 1: Login to Railway

```bash
railway login
```

This opens your browser to authenticate. You'll see:
- Account options (GitHub, email, etc.)
- Workspace selection
- Confirmation when done

After authentication, you're ready to use the CLI.

### Step 2: Link Project to Current Directory

**Option A: Interactive (Recommended)**

```bash
railway link
```

You'll be prompted to select:
```
> Select a workspace
  → [Your Workspace]

> Select a project
  → surprising-expression

> Select an environment
  → production

> Multiple services available — use --service <name> to link one
  Available: Postgres, spectacular-connection
```

**Option B: Direct with Flags**

```bash
railway link -p surprising-expression -e production -s spectacular-connection
```

**Option C: Specify Project ID**

```bash
railway link -p <PROJECT_ID>
```

### Step 3: Verify Link

```bash
# Check which project is linked
railway project list
# or
railway link --check
```

Expected output:
```
Project: surprising-expression (68da207e-8229...)
Environment: production
Service: spectacular-connection
```

---

## Deployment Methods

### Method 1: Fresh Deploy from Local Code (MOST RELIABLE)

**Use this when:**
- Pushing new features
- Fixing bugs
- Want guaranteed latest code deployed

**Command:**

```bash
# From server directory
cd server

# Upload and deploy
railway deployment up --service spectacular-connection -y

# Or detached (returns immediately, deployment continues in background)
railway deployment up --service spectacular-connection -y --detach
```

**What happens:**
1. Compresses current directory
2. Uploads to Railway
3. Railway builds Docker image
4. Deploys container
5. Restarts service

**Full output example:**
```
Indexing...
Uploading...
  Build Logs: https://railway.com/project/.../service/...
  
[Attached to deployment - logs stream here]
```

**Time to deploy:** 1-3 minutes

### Method 2: Redeploy Latest Deployment

**Use this when:**
- Latest code is already on Railway
- Just want to restart service
- Fixed environment variables
- Want quick redeploy (no code change)

**Command:**

```bash
railway deployment redeploy -s spectacular-connection -y

# With options
railway deployment redeploy \
  -s spectacular-connection \
  -e production \
  -y
```

**What happens:**
1. Takes previous deployment
2. Restarts without rebuilding
3. Reuses Docker image

**Time to redeploy:** 30 seconds - 1 minute

### Method 3: Redeploy from GitHub Source

**Use this when:**
- GitHub integration is configured
- Want to pull latest from main branch
- Trust GitHub as source of truth

**Command:**

```bash
railway deployment redeploy \
  -s spectacular-connection \
  --from-source \
  -y
```

**What happens:**
1. Pulls latest code from GitHub
2. Rebuilds Docker image
3. Deploys new container

**Requirements:**
- GitHub integration must be set up in Railway
- Service must have GitHub source configured

**Note:** As we learned, this can be slow/unreliable. Prefer Method 1.

### Method 4: Deploy Specific Directory

**Use this when:**
- Have monorepo
- Want to deploy specific service
- Path is not `./server`

**Command:**

```bash
railway deployment up ./apps/api --path-as-root -y
```

---

## Pre-Deployment Checklist

Before deploying, run these checks:

```bash
# 1. Verify syntax
cd server
node -c index.js
node -c db.js
node -c routes/*.js
node -c auth.js

# 2. Check for build errors
npm install  # If deps changed
npm run build  # If build script exists

# 3. Verify git status
git status
git log --oneline -5

# 4. Confirm linked project
railway link --check

# 5. Check environment variables (optional)
railway env list
```

---

## Checking Status & Logs

### List Recent Deployments

```bash
# Show latest deployments
railway deployment list -s spectacular-connection

# Output:
# Recent Deployments
#   62b7ed67-c493... | SUCCESS    | 2026-06-07 00:14:58
#   7123cb87-099a... | REMOVED    | 2026-06-07 00:11:33
#   76412316-e33d... | FAILED     | 2026-06-06 23:56:56
```

**Status meanings:**
- **SUCCESS** ✅ - Deployed and running
- **FAILED** ❌ - Build or startup failed
- **REMOVED** 🗑️ - Replaced by newer deployment
- **BUILDING** ⏳ - Currently building
- **CRASHED** 💥 - Deployed but then crashed

### View Live Logs

**Real-time logs (last 50 lines and streaming):**

```bash
railway logs -s spectacular-connection --tail 50

# Output:
# [2026-06-07T00:14:58.858Z] ◇ injected env (4) from .env
# [2026-06-07T00:14:59.231Z] ✓ Server running on http://localhost:3001
# [2026-06-07T00:14:59.321Z] ✓ Cron jobs scheduled (hourly)
```

**Specific number of lines:**

```bash
railway logs -s spectacular-connection --tail 100
```

**Last 10 lines only:**

```bash
railway logs -s spectacular-connection --tail 10
```

**View build logs (during deployment):**

```bash
railway logs -s spectacular-connection --service-logs
```

**Filter logs by keyword:**

```bash
# Show error logs
railway logs -s spectacular-connection | grep -i error

# Show specific endpoint logs
railway logs -s spectacular-connection | grep "POST /api/auth"

# Show database logs
railway logs -s spectacular-connection | grep -i database
```

### Check Service Health

```bash
# Via curl (external)
curl https://spectacular-connection-production-d07b.up.railway.app/health
# Output: {"status":"ok","timestamp":"2026-06-07T00:20:00.000Z"}

# Via Railway logs (internal)
railway logs -s spectacular-connection --tail 20 | grep "health\|listening\|error"
```

### Get Service Info

```bash
railway service list
# Shows: ID, name, status, memory, CPU

# Detailed info
railway service get --service spectacular-connection --json
```

---

## Deployment Workflow

### Standard Deployment Flow

```bash
# Step 1: Make code changes
code server/routes/auth.js
code server/cron.js
# ... etc

# Step 2: Test locally (optional but recommended)
cd server
npm test  # If tests exist
node index.js  # Manual testing

# Step 3: Commit to git (for backup)
git add .
git commit -m "fix: Improve admin user seeding"
git push origin main

# Step 4: Verify linked to correct project
railway link -p surprising-expression

# Step 5: Deploy to Railway
cd server
railway deployment up --service spectacular-connection -y

# Or detached if you want to do other things
railway deployment up --service spectacular-connection -y --detach

# Step 6: Check deployment status
railway deployment list -s spectacular-connection | head -2

# Step 7: Wait for SUCCESS status
# (If using --detach, check periodically)
for i in {1..30}; do
  STATUS=$(railway deployment list -s spectacular-connection | head -2 | tail -1 | awk '{print $2}')
  echo "[$i] Status: $STATUS"
  if [ "$STATUS" = "SUCCESS" ]; then
    echo "✅ Deployment complete!"
    break
  fi
  sleep 2
done

# Step 8: Verify deployment
curl https://spectacular-connection-production-d07b.up.railway.app/health

# Step 9: Check logs for errors
railway logs -s spectacular-connection --tail 20
```

---

## Rollback & Troubleshooting

### Quick Rollback to Previous Deployment

```bash
# View previous deployments
railway deployment list -s spectacular-connection

# Remove current deployment (rollback to previous)
railway down
# or
railway deployment remove <deployment-id>

# This automatically activates the previous deployment
```

### If Deployment Fails

**Check build logs:**

```bash
railway logs -s spectacular-connection --service-logs | tail -100
```

**Common errors:**

```
❌ "No such file or directory: package.json"
→ Are you in the right directory? cd server/

❌ "npm ERR! code ERESOLVE"
→ Dependencies conflict. Fix locally: npm install, then deploy

❌ "Build failed: port 3001 is already in use"
→ Old process still running. Wait 1-2 min or redeploy

❌ "SyntaxError: Unexpected token"
→ JavaScript syntax error. Check: node -c file.js
```

**Restart service:**

```bash
# Redeploy last successful version
railway deployment redeploy -s spectacular-connection -y

# Or remove and auto-rollback to previous
railway down
```

### Manual Debugging in Railway

```bash
# Connect to service shell (if available)
railway connect

# View environment variables
railway env list

# View resource usage
railway metrics -s spectacular-connection
```

---

## Automation & Scripts

### Bash Script: Auto-Deploy with Monitoring

**Save as `scripts/deploy.sh`:**

```bash
#!/bin/bash
set -e

SERVICE="spectacular-connection"
MAX_WAIT=300  # 5 minutes max wait

echo "🚀 Deploying $SERVICE to Railway..."

# Step 1: Verify linked
echo "Verifying project link..."
railway link --check || {
  echo "❌ Project not linked. Run: railway link"
  exit 1
}

# Step 2: Deploy
echo "Uploading code..."
cd server
railway deployment up --service $SERVICE -y --detach

# Step 3: Wait for deployment
echo "Waiting for deployment to complete (max ${MAX_WAIT}s)..."
START_TIME=$(date +%s)
while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ $ELAPSED -gt $MAX_WAIT ]; then
    echo "⏱️  Timeout after ${MAX_WAIT}s. Check: railway logs -s $SERVICE"
    exit 1
  fi

  STATUS=$(railway deployment list -s $SERVICE --json 2>/dev/null | head -1 | jq -r '.status' 2>/dev/null || echo "CHECKING")
  
  case "$STATUS" in
    SUCCESS)
      echo "✅ Deployment successful!"
      break
      ;;
    FAILED)
      echo "❌ Deployment failed!"
      railway logs -s $SERVICE --tail 50
      exit 1
      ;;
    *)
      echo "⏳ Status: $STATUS (${ELAPSED}s elapsed)"
      sleep 3
      ;;
  esac
done

# Step 4: Test deployment
echo "Testing deployment..."
sleep 2
if curl -s https://spectacular-connection-production-d07b.up.railway.app/health | grep -q "ok"; then
  echo "✅ Health check passed!"
else
  echo "⚠️  Health check failed"
fi

echo ""
echo "📝 Deployment logs:"
railway logs -s $SERVICE --tail 10

echo ""
echo "✅ Deployment complete!"
```

**Usage:**

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Bash Script: Rollback to Previous

**Save as `scripts/rollback.sh`:**

```bash
#!/bin/bash

SERVICE="spectacular-connection"

echo "🔙 Rolling back $SERVICE..."

# Show last 3 deployments
echo ""
echo "Recent deployments:"
railway deployment list -s $SERVICE | head -5

echo ""
echo "Rolling back..."
railway down -s $SERVICE || railway deployment remove $(railway deployment list -s $SERVICE | head -3 | tail -1 | awk '{print $1}')

echo "✅ Rolled back!"

# Wait for new deployment
sleep 5

echo "Current status:"
railway deployment list -s $SERVICE | head -2

echo "Latest logs:"
railway logs -s $SERVICE --tail 10
```

**Usage:**

```bash
chmod +x scripts/rollback.sh
./scripts/rollback.sh
```

### GitHub Actions: Auto-Deploy on Push

**Save as `.github/workflows/deploy.yml`:**

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]
    paths:
      - 'server/**'
      - '.github/workflows/deploy.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          npm install -g @railway/cli
          railway link -p ${{ secrets.RAILWAY_PROJECT_ID }} --yes
          cd server
          railway deployment up --service spectacular-connection -y
```

**Setup:**

1. Get Railway token: https://railway.app/account/tokens
2. Add GitHub secrets:
   - `RAILWAY_TOKEN` = your token
   - `RAILWAY_PROJECT_ID` = project ID from Railway

---

## Useful Commands Reference

### Navigation & Project Management

```bash
railway login                              # Authenticate
railway logout                             # Sign out
railway link [options]                     # Link current dir to project
railway project list                       # List your projects
railway service list                       # List services in linked project
railway env list                           # Show environment variables
railway env set KEY=value                  # Set environment variable
```

### Deployment

```bash
railway deployment up [options]            # Deploy from current directory
railway deployment redeploy [options]      # Redeploy latest
railway deployment list                    # Show recent deployments
railway deployment remove <id>             # Delete deployment
railway down                               # Remove latest deployment (rollback)
```

### Debugging

```bash
railway logs [options]                     # View logs
railway logs --tail 50                     # Last 50 lines
railway logs -s <service> --tail 100       # Specific service, 100 lines
railway metrics                            # View CPU/memory usage
railway connect                            # SSH into service (if available)
```

### Miscellaneous

```bash
railway docs                               # Open Railway docs in browser
railway --version                          # Show CLI version
railway --help                             # Show all commands
railway <command> --help                   # Help for specific command
```

---

## Environment Variables

### Setting Variables (for secrets)

```bash
# Set one variable
railway env set JWT_SECRET=your-secret-key-here

# Set multiple
railway env set \
  JWT_SECRET=your-secret \
  GROQ_API_KEY=gsk_... \
  DATABASE_URL=postgresql://...

# List all
railway env list

# Remove variable
railway env delete JWT_SECRET
```

### Best Practices

✅ Use Railway dashboard for sensitive values:
1. Go to https://railway.app
2. Project → Service → Variables tab
3. Add/edit variables there

❌ Don't put secrets in code or git

✅ Use `.env.local` locally (not committed)

✅ Use `railway env` for safe variable management

---

## Performance Tips

### Faster Deployments

```bash
# Use --detach to not wait for logs
railway deployment up --service spectacular-connection -y --detach

# Check status periodically instead
railway deployment list -s spectacular-connection
```

### Reduce Upload Size

Before deploying, clean up:
```bash
rm -rf node_modules .next dist build
npm install --production  # Only install prod deps
railway deployment up ...
```

### Monitor Resource Usage

```bash
# Check CPU/memory
railway metrics -s spectacular-connection

# If hitting limits:
# 1. Optimize code
# 2. Check for memory leaks in logs
# 3. Upgrade Railway plan
```

---

## Troubleshooting Checklist

When something goes wrong:

- [ ] Check status: `railway deployment list -s spectacular-connection`
- [ ] View logs: `railway logs -s spectacular-connection --tail 50`
- [ ] Verify linked: `railway link --check`
- [ ] Check env vars: `railway env list`
- [ ] Look for errors: `railway logs | grep -i error`
- [ ] Verify code changes: `git log --oneline -5`
- [ ] Test health: `curl https://[url]/health`
- [ ] Check Railway status: https://railway.app/status
- [ ] Try rollback: `railway down`

---

## Additional Resources

- **Railway Docs:** https://docs.railway.app
- **Railway CLI Docs:** https://docs.railway.app/reference/cli
- **Railway Status:** https://railway.app/status
- **GitHub Issues:** https://github.com/railwayapp/cli/issues

---

## Quick Command Summary

```bash
# Deploy
railway deployment up --service spectacular-connection -y

# Check status
railway deployment list -s spectacular-connection

# View logs
railway logs -s spectacular-connection --tail 50

# Rollback
railway down

# Set env variable
railway env set KEY=value

# Verify health
curl https://spectacular-connection-production-d07b.up.railway.app/health
```

Copy and paste these as needed! 🚀

