# Fix Admin User Login — Railway Deployment

**Status:** Admin user missing from Railway PostgreSQL  
**Solution:** Two options below (Option A is fastest)

---

## Option A: Insert Admin User Directly via Railway Dashboard (5 min) ✅ FASTEST

### Step 1: Go to Railway Dashboard
1. Open https://railway.app
2. Select project: **"surprising-expression"**
3. Click **"Postgres"** database service
4. Click **"Database"** tab → **"Query Editor"**

### Step 2: Run SQL Insert

Copy-paste this SQL and click **Run**:

```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin');
```

### Step 3: Verify

Run this query to confirm:
```sql
SELECT * FROM users WHERE email = 'admin@tracker.com';
```

Should return 1 row with:
- email: `admin@tracker.com`
- role: `admin`

### Step 4: Test Login

```bash
curl -s -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}' 
```

Should return a JWT token (not "Invalid email or password")

---

## Option B: Trigger Deployment with /setup Endpoint (Once Deployed)

The `/setup` endpoint is already in the code (commit 553592c) but hasn't been deployed to Railway yet.

### Step 1: Manual Redeploy (if auto-deploy failed)

1. Go to https://railway.app → "surprising-expression" project
2. Click **"spectacular-connection"** service (backend)
3. Click **"Deployments"** tab
4. Click **"Redeploy"** button
5. Wait for deployment to complete (~2-3 minutes)

### Step 2: Call /setup Endpoint

Once deployed:
```bash
curl -s -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/setup
```

Should return:
```json
{
  "message": "Admin user created",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@tracker.com",
    "role": "admin",
    "created_at": "2026-06-07T..."
  }
}
```

---

## Option C: Use Seeding Script Locally (if you have DATABASE_URL)

A seeding script exists at `server/seed-admin.js`:

```bash
# Set your Railway DATABASE_URL
export DATABASE_URL="postgresql://..."

# Run seeding script
cd server && node seed-admin.js
```

---

## Once Admin User is Created ✅

Test the full flow:

```bash
# 1. Login and get JWT token
TOKEN=$(curl -s -X POST https://spectacular-connection-production-d07b.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"

# 2. Test getting coaches (requires auth)
curl -s -X GET https://spectacular-connection-production-d07b.up.railway.app/api/coaches \
  -H "Authorization: Bearer $TOKEN" | head -20

# 3. Open frontend and login
# https://coachtracker-theta.vercel.app
# admin@tracker.com / admin123
```

---

## Credentials Reference

- **Email:** `admin@tracker.com`
- **Password:** `admin123`
- **Password Hash:** `$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q`
- **Role:** `admin`

---

## Troubleshooting

### Login still returns "Invalid email or password"
- Verify user was inserted: `SELECT * FROM users WHERE email = 'admin@tracker.com';`
- Confirm password hash is exactly: `$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q`
- Check for duplicate users: `SELECT COUNT(*) FROM users;` (should be > 0)

### /setup endpoint returns 404
- Endpoint hasn't deployed yet
- Use **Option A** (direct insert) or trigger manual redeploy (**Option B**)

### Database query returns error
- Check DATABASE_URL is set: `echo $DATABASE_URL`
- Verify PostgreSQL is running
- Check Railway postgres service is active

---

## What's Next

Once admin login works:
1. ✅ Create coaches via admin dashboard
2. ✅ Assign tasks to coaches
3. ✅ Coaches login and see their tasks
4. ✅ Notifications and cron jobs start working

**Estimated time:** 5 minutes (Option A) → full app working
