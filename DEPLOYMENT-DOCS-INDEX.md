---
phase: "7+"
status: "active"
owner: "deployment-team"
last_updated: "2026-06-07T00:50:00Z"
beads: []
---

# Deployment Documentation Index

**Complete reference for all deployment-related documentation**

---

## Quick Navigation

### 🚀 Need to Deploy Right Now?
→ **[RAILWAY-CLI-DEPLOYMENT-GUIDE.md](docs/RAILWAY-CLI-DEPLOYMENT-GUIDE.md)** - Copy-paste commands, step-by-step instructions

### 🔧 Want to Understand What Went Wrong?
→ **[DEPLOYMENT-ISSUES-AND-FIXES.md](docs/DEPLOYMENT-ISSUES-AND-FIXES.md)** - Every problem we faced and how we fixed it

### ✅ Just Fixed Something & Want to Verify?
→ **[FIXES-COMPLETE-SUMMARY.md](FIXES-COMPLETE-SUMMARY.md)** - What was fixed and test results

---

## All Deployment Documents

| Document | Purpose | When to Use |
|----------|---------|------------|
| **[RAILWAY-CLI-DEPLOYMENT-GUIDE.md](docs/RAILWAY-CLI-DEPLOYMENT-GUIDE.md)** | Complete Railway CLI reference | Every deployment, troubleshooting |
| **[DEPLOYMENT-ISSUES-AND-FIXES.md](docs/DEPLOYMENT-ISSUES-AND-FIXES.md)** | Lessons learned from our deployment | Understanding what went wrong, prevention |
| **[FIXES-COMPLETE-SUMMARY.md](FIXES-COMPLETE-SUMMARY.md)** | Final verification of all fixes | Confirming everything works |
| **[FIX-VERIFICATION-PLAN.md](FIX-VERIFICATION-PLAN.md)** | Step-by-step testing procedures | Testing after deployment |
| **[ADMIN-USER-FIX-INSTRUCTIONS.md](ADMIN-USER-FIX-INSTRUCTIONS.md)** | How to manually fix admin user issue | If seeding fails in future |
| **[RAILWAY-DEPLOYMENT-SUMMARY-2026-06-07.md](docs/HANDOFF-RAILWAY-DEPLOYMENT-2026-06-07.md)** | Original handoff with full context | Background understanding |

---

## Common Scenarios

### Scenario 1: Regular Deployment (Code Changes)

**Steps:**

1. Make code changes
2. Test locally
3. Commit to git
4. **Deploy:** Follow [RAILWAY-CLI-DEPLOYMENT-GUIDE.md → Fresh Deploy](docs/RAILWAY-CLI-DEPLOYMENT-GUIDE.md#method-1-fresh-deploy-from-local-code-most-reliable)
5. Verify with health check
6. Check logs

**Key commands:**
```bash
cd server
railway deployment up --service spectacular-connection -y

# Check status
railway deployment list -s spectacular-connection

# View logs
railway logs -s spectacular-connection --tail 50
```

### Scenario 2: Something's Broken After Deployment

**Steps:**

1. Check logs: `railway logs -s spectacular-connection --tail 100`
2. Read [DEPLOYMENT-ISSUES-AND-FIXES.md](docs/DEPLOYMENT-ISSUES-AND-FIXES.md) for similar issues
3. Fix locally and redeploy
4. Or rollback to previous: `railway down`

### Scenario 3: Forgot How to Deploy

**Steps:**

1. Open [RAILWAY-CLI-DEPLOYMENT-GUIDE.md → Deployment Methods](docs/RAILWAY-CLI-DEPLOYMENT-GUIDE.md#deployment-methods)
2. Copy the command you need
3. Run it

### Scenario 4: Lost Database Admin User Access

**Steps:**

1. Read [ADMIN-USER-FIX-INSTRUCTIONS.md](ADMIN-USER-FIX-INSTRUCTIONS.md) - 3 options provided
2. Use Option A (direct insert) or Option B (redeploy /setup)
3. Test login

---

## Key Learnings (TL;DR)

### Issue 1: Admin User Missing
**What happened:** Database initialization seeding didn't verify actual creation  
**How we fixed it:** Added RETURNING clause to capture created user, log actual object  
**Prevention:** Always verify database operations with actual result data

### Issue 2: Cron Jobs SQLite Syntax
**What happened:** Database migrated to PostgreSQL, cron jobs weren't updated  
**How we fixed it:** Converted datetime/julianday to NOW() and interval math  
**Prevention:** Test all database queries after migrations

### Issue 3: GitHub ≠ Auto-Deploy to Railway
**What happened:** Assumed Railway auto-deploys from GitHub (it doesn't)  
**How we fixed it:** Used `railway deployment up` CLI for manual deployment  
**Prevention:** Know your platform's deployment model before starting

---

## Most Useful Commands

```bash
# DEPLOY
railway deployment up --service spectacular-connection -y

# CHECK STATUS
railway deployment list -s spectacular-connection

# VIEW LOGS (live)
railway logs -s spectacular-connection --tail 50

# SET ENVIRONMENT VARIABLE
railway env set KEY=value

# ROLLBACK TO PREVIOUS
railway down

# REDEPLOY (no code change)
railway deployment redeploy -s spectacular-connection -y

# VERIFY SERVICE HEALTH
curl https://spectacular-connection-production-d07b.up.railway.app/health
```

---

## Documentation Structure

```
docs/
├── RAILWAY-CLI-DEPLOYMENT-GUIDE.md      ← START HERE for deployments
├── DEPLOYMENT-ISSUES-AND-FIXES.md       ← Understand what went wrong
├── HANDOFF-RAILWAY-DEPLOYMENT-2026-06-07.md  ← Original context

DEPLOYMENT-DOCS-INDEX.md                 ← THIS FILE

FIXES-COMPLETE-SUMMARY.md                ← What we fixed
FIX-VERIFICATION-PLAN.md                 ← How we verified
ADMIN-USER-FIX-INSTRUCTIONS.md          ← Manual fixes if needed
```

---

## Deployment Checklist

Use this every time you deploy:

### Pre-Deployment
- [ ] Code tested locally
- [ ] All syntax valid: `node -c file.js`
- [ ] No TypeScript errors
- [ ] Committed to git
- [ ] Correct service linked: `railway link --check`

### Deployment
- [ ] Run: `railway deployment up --service spectacular-connection -y`
- [ ] Wait for: `SUCCESS` status
- [ ] Check health: `curl https://[url]/health`
- [ ] Review logs: `railway logs -s spectacular-connection --tail 20`

### Post-Deployment
- [ ] No errors in logs
- [ ] API responding correctly
- [ ] Frontend can reach backend
- [ ] All endpoints working

---

## Environment Variables

These are set in Railway dashboard (or via CLI):

```
JWT_SECRET=...              # Auth token secret (min 32 chars)
DATABASE_URL=...            # PostgreSQL connection string
GROQ_API_KEY=...           # LLM for coaching insights
CLIENT_ORIGIN=...          # Frontend URL (for CORS)
NODE_ENV=production        # Environment
```

**To set via CLI:**
```bash
railway env set JWT_SECRET=your-secret-key
railway env set GROQ_API_KEY=gsk_...
railway env list            # Verify
```

---

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Endpoint returns 404 | Check logs, might be old code. Redeploy. |
| "Function X not found" | Likely SQLite syntax in PostgreSQL. See Issues doc. |
| Admin user missing | Run /setup endpoint or manually insert (see Admin fix doc) |
| Service crashes on startup | Check `node -c index.js`, review logs |
| Port 3001 already in use | `railway down` or wait 2 min and redeploy |
| Forgot linked project | `railway link -p surprising-expression` |

---

## Getting Help

1. **For deployment commands:** [RAILWAY-CLI-DEPLOYMENT-GUIDE.md](docs/RAILWAY-CLI-DEPLOYMENT-GUIDE.md)
2. **For understanding errors:** [DEPLOYMENT-ISSUES-AND-FIXES.md](docs/DEPLOYMENT-ISSUES-AND-FIXES.md)
3. **For logs and debugging:** Railway CLI guide → [Checking Status & Logs](docs/RAILWAY-CLI-DEPLOYMENT-GUIDE.md#checking-status--logs)
4. **For manual fixes:** [ADMIN-USER-FIX-INSTRUCTIONS.md](ADMIN-USER-FIX-INSTRUCTIONS.md)

---

## Important URLs

| Resource | URL |
|----------|-----|
| App | https://coachtracker-theta.vercel.app |
| API | https://spectacular-connection-production-d07b.up.railway.app |
| Health Check | https://spectacular-connection-production-d07b.up.railway.app/health |
| Railway Dashboard | https://railway.app/project/surprising-expression |
| GitHub Repo | https://github.com/hasnattariq97/coachtracker |

---

## Version History

| Date | What | Commit |
|------|------|--------|
| 2026-06-07 | Fixed admin user, cron jobs, deployed via CLI | dd0624a |
| 2026-06-07 | Created comprehensive deployment docs | 48cb929 |

---

## For Next Agent

If you're reading this in a future session:

1. **Quick Deploy:** Use [RAILWAY-CLI-DEPLOYMENT-GUIDE.md](docs/RAILWAY-CLI-DEPLOYMENT-GUIDE.md)
2. **Understand Issues:** Read [DEPLOYMENT-ISSUES-AND-FIXES.md](docs/DEPLOYMENT-ISSUES-AND-FIXES.md)
3. **Use the checklist** above before every deployment
4. **Check logs** first when something breaks
5. **Reference this index** when lost

---

**All deployment documentation is now centralized and ready to use! 🚀**

