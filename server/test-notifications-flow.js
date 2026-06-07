#!/usr/bin/env node

/**
 * Test script: Verify notifications flow end-to-end
 * 1. Admin login
 * 2. Create task
 * 3. Verify "assigned" notification
 * 4. Coach login
 * 5. Complete task
 * 6. Verify "completed" notification
 * 7. Verify "coaching_insights" notification (if enabled)
 */

const http = require('http');
const querystring = require('querystring');

const API_BASE = 'http://localhost:3001';

let adminToken = null;
let coachToken = null;
let coachId = 5;  // Default coach ID

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 NOTIFICATION FLOW TEST');
  console.log('='.repeat(70));
  console.log('Testing: Admin → Task → Coach → Complete → Notifications\n');

  try {
    // ============================================
    // STEP 1: Admin Login
    // ============================================
    console.log('▶️  STEP 1: Admin Login');
    let res = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@tracker.com',
      password: 'admin123'
    });

    if (res.status !== 200 || !res.data.token) {
      throw new Error(`Login failed: ${res.status} - ${JSON.stringify(res.data)}`);
    }

    adminToken = res.data.token;
    console.log('   ✅ Admin logged in');

    // ============================================
    // STEP 2: Create Task
    // ============================================
    console.log('\n▶️  STEP 2: Create Task');
    res = await makeRequest('POST', '/api/tasks', {
      coach_ids: [coachId],
      title: 'Notification Test Task',
      description: 'Testing notification flow',
      priority: 'high',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()  // 3 days from now
    }, adminToken);

    if (res.status !== 200) {
      throw new Error(`Task creation failed: ${res.status} - ${JSON.stringify(res.data)}`);
    }

    let taskId = res.data.id || res.data.tasks?.[0]?.id;
    console.log(`   ✅ Task created (ID: ${taskId})`);

    // ============================================
    // STEP 3: Check Admin Notifications (task assigned)
    // ============================================
    console.log('\n▶️  STEP 3: Check Notifications After Assignment');
    await new Promise(r => setTimeout(r, 500));  // Small delay

    res = await makeRequest('GET', '/api/notifications', null, adminToken);

    if (res.status !== 200) {
      throw new Error(`Get notifications failed: ${res.status}`);
    }

    console.log(`   Found ${res.data.length} notification(s)`);

    if (res.data.length === 0) {
      console.log('   ⚠️  WARNING: No notifications found after task creation!');
      console.log('   Expected: "assigned" notification for coach');
      console.log('   Debugging: Check server logs for errors in createNotification()');
    } else {
      res.data.forEach(n => {
        console.log(`   - [${n.type}] ${n.message?.slice(0, 60)}...`);
      });
    }

    // ============================================
    // STEP 4: Coach Login
    // ============================================
    console.log('\n▶️  STEP 4: Coach Login');
    res = await makeRequest('POST', '/api/auth/login', {
      email: 'saima.jabeen@niete.edu.pk',
      password: 'coach123'  // Default password, may need adjustment
    });

    if (res.status !== 200) {
      console.log(`   ⚠️  Coach login failed (trying default password)`);
      console.log('   Skip to completion step...');
    } else {
      coachToken = res.data.token;
      console.log('   ✅ Coach logged in');
    }

    // ============================================
    // STEP 5: Complete Task (if we have token)
    // ============================================
    if (coachToken) {
      console.log('\n▶️  STEP 5: Coach Completes Task');
      res = await makeRequest('PUT', `/api/tasks/${taskId}/complete`, {}, coachToken);

      if (res.status !== 200) {
        throw new Error(`Task completion failed: ${res.status} - ${JSON.stringify(res.data)}`);
      }

      console.log('   ✅ Task marked complete');

      // ============================================
      // STEP 6: Check Admin Notifications After Completion
      // ============================================
      console.log('\n▶️  STEP 6: Check Notifications After Completion');
      await new Promise(r => setTimeout(r, 2000));  // Wait for coaching insights

      res = await makeRequest('GET', '/api/notifications', null, adminToken);

      if (res.status !== 200) {
        throw new Error(`Get notifications failed: ${res.status}`);
      }

      console.log(`   Found ${res.data.length} notification(s):`);

      let hasCompletion = false;
      let hasCoachingInsights = false;

      res.data.forEach(n => {
        if (n.type === 'completed') {
          hasCompletion = true;
          console.log(`   ✅ [completed] ${n.message}`);
        } else if (n.type === 'coaching_insights') {
          hasCoachingInsights = true;
          console.log(`   ✅ [coaching_insights] ${n.message}`);
          if (n.metadata) {
            try {
              const meta = JSON.parse(n.metadata);
              console.log(`      Status: ${n.insights_status}`);
              if (meta.pattern_agent) {
                console.log(`      Pattern: ${meta.pattern_agent.summary}`);
              }
            } catch (e) {
              // Metadata parse error
            }
          }
        } else {
          console.log(`   - [${n.type}] ${n.message?.slice(0, 50)}...`);
        }
      });

      if (!hasCompletion) {
        console.log('   ⚠️  No "completed" notification found');
        console.log('   Expected: Admin should see task completion notification');
      }

      if (!hasCoachingInsights) {
        console.log('   ℹ️  No "coaching_insights" notification');
        console.log('   Check: Is COACHING_INSIGHTS_ENABLED=true?');
        console.log('   Check: Is GROQ_API_KEY set?');
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('✅ If all above shows success:');
    console.log('   - Notifications are working locally');
    console.log('   - Issue is specific to Railway deployment');
    console.log('   - Add env vars: GROQ_API_KEY, COACHING_INSIGHTS_ENABLED');
    console.log('\n❌ If notifications are missing:');
    console.log('   - Check: Is backend running on :3001?');
    console.log('   - Check: Are env vars set in .env?');
    console.log('   - Check: Server console for errors');
    console.log('\nℹ️  Coaching Insights requires:');
    console.log('   - GROQ_API_KEY environment variable');
    console.log('   - COACHING_INSIGHTS_ENABLED=true');
    console.log('   - Get free key at: https://console.groq.com\n');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

test().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
});
