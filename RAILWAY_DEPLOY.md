# Railway Deployment — Coach Tracker

**Follow these exact steps.** Copy-paste commands, don't type them.

---

## Step 1: Open PowerShell as Administrator

Press `Win + X` → select **"Windows PowerShell (Admin)"**

Navigate to your project:
```powershell
cd d:\Cursor_new
```

---

## Step 2: Install Railway CLI

```powershell
npm install -g @railway/cli
```

Wait for it to finish. You should see:
```
✅ added X packages
```

---

## Step 3: Login to Railway

```powershell
npx railway login
```

A browser window opens → **Click "Authorize"** → closes automatically

---

## Step 4: Link to Your Project

```powershell
npx railway link
```

Railway shows your projects. **Select:** `surprising-expression`

You'll see: `✅ Linked to project surprising-expression`

---

## Step 5: Navigate to Server Folder

```powershell
cd server
```

---

## Step 6: Add Node.js Service

```powershell
npx railway service add
```

When prompted: Select **Node.js**

When prompted for root directory: Type `server` (or just press Enter if it's already detected)

---

## Step 7: Deploy Your Backend

```powershell
npx railway up
```

This uploads your code to Railway and starts deploying.

**You'll see:**
```
Building...
Deploying...
✅ Deployment successful
```

**Keep this terminal open** and wait for it to finish (2-3 minutes).

---

## Step 8: Go to Railway Dashboard & Add PostgreSQL

1. Open https://railway.app
2. Click on your `surprising-expression` project
3. Click **"+ Add Service"** (or **"Add"**)
4. Select **"Database"** → **"PostgreSQL"**
5. Wait for it to say "PostgreSQL created"

---

## Step 9: Set Environment Variables

In Railway dashboard:

1. Click on the **Node.js service** (your backend)
2. Click **"Variables"** tab
3. Click **"New Variable"** and add each one:

```
CLIENT_ORIGIN = https://coachtracker-theta.vercel.app
GROQ_API_KEY = [YOUR_GROQ_API_KEY]
JWT_SECRET = test-secret-key-minimum-32-characters-requirement
NODE_ENV = production
ADMIN_SEED_PASSWORD = admin123
```

**DO NOT add `DATABASE_URL`** — Railway auto-injects it ✅

---

## Step 10: Generate Domain

1. Click Node.js service → **"Settings"** tab
2. Scroll to **"Domain"** section
3. Click **"Generate Domain"**
4. Railway gives you a URL like: `https://coachtracker-XXXXX.railway.app`
5. **Copy this URL**

---

## Step 11: Update Vercel Frontend

1. Go to https://vercel.com
2. Click your **coachtracker** project
3. Go to **Settings** → **Environment Variables**
4. Find `VITE_API_URL` (or create it)
5. Change the value to your Railway domain from Step 10
6. Click **"Save"**
7. Go to **Deployments** → click **"Redeploy"** on the latest deployment

---

## Step 12: Test

Wait 2 minutes for Vercel to redeploy, then:

1. Open https://coachtracker-theta.vercel.app
2. Login with:
   - Email: `admin@tracker.com`
   - Password: `admin123`
3. Should see **Admin Dashboard** ✅

If login fails, check:
- Railway Node.js logs (click service → Console tab)
- Vercel logs (Deployments → View logs)

---

## Done! 🚀

Your app is now on Railway:
- **Frontend:** Vercel
- **Backend:** Railway
- **Database:** Railway PostgreSQL

All set for production.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npx railway not found` | Run `npm install -g @railway/cli` again |
| Login opens wrong browser | Copy URL from terminal, paste in your main browser |
| "Project not found" | Make sure you're in the `surprising-expression` project |
| Deployment fails | Check Railway Console tab for error messages |
| Login still fails after deploy | Wait 5 min, then try again (caches need to clear) |

