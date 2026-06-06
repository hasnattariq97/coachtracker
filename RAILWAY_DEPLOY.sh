#!/bin/bash
set -e

echo "=========================================="
echo "Railway Deployment Script - Coach Tracker"
echo "=========================================="
echo ""

# Step 1: Install Railway CLI
echo "📦 Installing Railway CLI..."
npm install -g @railway/cli
echo "✅ Railway CLI installed"
echo ""

# Step 2: Login
echo "🔐 Logging into Railway..."
echo "A browser window will open. Log in with your Railway account."
npx railway login
echo "✅ Logged in"
echo ""

# Step 3: Link to project
echo "🔗 Linking to Railway project..."
echo "Select 'surprising-expression' when prompted"
npx railway link
echo "✅ Linked to project"
echo ""

# Step 4: Add Node.js service
echo "🚀 Adding Node.js service..."
cd d:\Cursor_new\server
npx railway service add
echo "✅ Node.js service added"
echo ""

# Step 5: Deploy
echo "📤 Deploying to Railway..."
npx railway up
echo "✅ Deployed!"
echo ""

echo "=========================================="
echo "Next Steps:"
echo "1. Go to Railway Dashboard"
echo "2. Add PostgreSQL: Click '+ Add Service' -> 'PostgreSQL'"
echo "3. Set Variables in Node.js service:"
echo "   CLIENT_ORIGIN=https://coachtracker-theta.vercel.app"
echo "   GROQ_API_KEY=[YOUR_GROQ_API_KEY]"
echo "   JWT_SECRET=test-secret-key-minimum-32-characters-requirement"
echo "   NODE_ENV=production"
echo "   ADMIN_SEED_PASSWORD=admin123"
echo "4. Generate Domain and test"
echo "=========================================="
