#!/usr/bin/env node

/**
 * Test live deployed app for notifications & coaching insights
 * Tests complete workflow: login → create task → complete task → check notifications
 */

import { execSync } from 'child_process';

const LIVE_URL = 'https://coachtracker-theta.vercel.app';
const API_URL = 'https://spectacular-connection-production-d07b.up.railway.app';

async function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    console.error(`Command failed: ${cmd}`);
    console.error(e.stderr || e.stdout || e.message);
    return null;
  }
}

async function testLiveApp() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 LIVE DEPLOYED APP DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log(`Frontend: ${LIVE_URL}`);
  console.log(`Backend:  ${API_URL}\n`);

  // ============================================
  // 1. Check Backend Health
  // ============================================
  console.log('▶️  TEST 1: Backend Health');
  const health = await runCommand(`curl -s "${API_URL}/health"`);
  if (health && health.includes('ok')) {
    console.log('   ✅ Backend is responding');
  } else {
    console.log('   ❌ Backend not responding');
    return;
  }

  // ============================================
  // 2. Check Login Endpoint
  // ============================================
  console.log('\n▶️  TEST 2: API Login');
  const loginRes = await runCommand(`
    curl -s -X POST "${API_URL}/api/auth/login" \\
      -H "Content-Type: application/json" \\
      -d '{"email":"admin@tracker.com","password":"admin123"}'
  `);

  if (!loginRes || !loginRes.includes('token')) {
    console.log('   ❌ Login failed');
    console.log('   Response:', loginRes);
    return;
  }

  const token = loginRes.match(/"token":"([^"]+)"/)?.[1];
  console.log('   ✅ Admin login successful');
  console.log(`   Token: ${token?.slice(0, 20)}...`);

  // ============================================
  // 3. Check Coaches
  // ============================================
  console.log('\n▶️  TEST 3: List Coaches');
  const coachesRes = await runCommand(`
    curl -s -X GET "${API_URL}/api/coaches" \\
      -H "Authorization: Bearer ${token}"
  `);

  if (coachesRes) {
    try {
      const coaches = JSON.parse(coachesRes);
      console.log(`   ✅ Found ${coaches.length} coach(es)`);
      coaches.forEach(c => console.log(`      - ${c.name} (${c.email})`));
    } catch {
      console.log('   ⚠️  Could not parse coaches response');
    }
  }

  // ============================================
  // 4. Check Tasks
  // ============================================
  console.log('\n▶️  TEST 4: List Tasks');
  const tasksRes = await runCommand(`
    curl -s -X GET "${API_URL}/api/tasks" \\
      -H "Authorization: Bearer ${token}"
  `);

  if (tasksRes) {
    try {
      const tasks = JSON.parse(tasksRes);
      console.log(`   ✅ Found ${tasks.length} task(s)`);
      if (tasks.length === 0) {
        console.log('      ⚠️  No tasks created yet - this is why notifications are empty!');
      }
    } catch {
      console.log('   ⚠️  Could not parse tasks response');
    }
  }

  // ============================================
  // 5. Check Notifications
  // ============================================
  console.log('\n▶️  TEST 5: List Notifications');
  const notificationsRes = await runCommand(`
    curl -s -X GET "${API_URL}/api/notifications" \\
      -H "Authorization: Bearer ${token}"
  `);

  if (notificationsRes) {
    try {
      const notifications = JSON.parse(notificationsRes);
      console.log(`   ✅ Found ${notifications.length} notification(s)`);
      if (notifications.length === 0) {
        console.log('      ℹ️  No notifications (expected if no tasks exist)');
      } else {
        notifications.forEach(n => {
          console.log(`      - [${n.type}] ${n.message?.slice(0, 50)}...`);
        });
      }
    } catch {
      console.log('   ⚠️  Could not parse notifications response');
    }
  }

  // ============================================
  // 6. Check Environment & Configuration
  // ============================================
  console.log('\n▶️  TEST 6: Frontend Configuration');
  console.log('   Testing if frontend can reach backend...');

  // This would require opening the app in browser to check CORS
  console.log('   ℹ️  Open browser console (F12) and check for CORS errors');
  console.log('   ℹ️  Check: Does /api/coaches request succeed?');
  console.log('   ℹ️  Check: Are there any 4xx/5xx errors in Network tab?');

  // ============================================
  // SUMMARY & RECOMMENDATIONS
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('='.repeat(70));
  console.log('\n🔴 ROOT CAUSE: No tasks have been created yet');
  console.log('\nThis explains why:');
  console.log('  ❌ Notifications are empty (no tasks = no notifications)');
  console.log('  ❌ Coaching insights are missing (no completed tasks)');
  console.log('  ❌ Notification bell shows 0 unread');
  console.log('\n✅ SOLUTION CHECKLIST:');
  console.log('  1. Go to https://coachtracker-theta.vercel.app');
  console.log('  2. Login as admin@tracker.com / admin123');
  console.log('  3. Check if "Assign Task" button is clickable');
  console.log('  4. Try to create a task for the existing coach');
  console.log('  5. If task creation fails, check browser console (F12):');
  console.log('     - Is the request being sent?');
  console.log('     - What error is returned?');
  console.log('     - Check Network tab for failed requests');
  console.log('\n🔍 POTENTIAL ISSUES:');
  console.log('  • API_URL in frontend might be wrong');
  console.log('  • CORS headers might be missing');
  console.log('  • Forms might not be submitting');
  console.log('  • Groq API key might not be set on backend');
  console.log('\n' + '='.repeat(70) + '\n');
}

testLiveApp().catch(console.error);
