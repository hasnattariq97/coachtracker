#!/usr/bin/env node

/**
 * Debug script: Test notifications & Phase 7 coaching insights on LIVE deployed app
 * Runs against: https://coachtracker-theta.vercel.app
 */

import AgentBrowserHelper from './src/__tests__/e2e/agent-browser.helper.js';

const LIVE_URL = 'https://coachtracker-theta.vercel.app';
const API_BASE = 'https://spectacular-connection-production-d07b.up.railway.app';

async function debugDeployedApp() {
  const browser = new AgentBrowserHelper({
    baseUrl: LIVE_URL,
    headless: false,
    timeout: 60000,
  });

  try {
    console.log('\n🔍 Debugging Deployed App (LIVE)');
    console.log(`📱 Frontend: ${LIVE_URL}`);
    console.log(`🔧 Backend: ${API_BASE}\n`);

    // ============================================
    // STEP 1: Login as Admin
    // ============================================
    console.log('▶️  STEP 1: Admin Login');
    await browser.navigate('/login');
    await browser.screenshot('01-login-page.png');
    console.log('   ✓ Login page loaded');

    const emailRef = await browser.findByText('Email');
    const passwordRef = await browser.findByText('Password');
    const signInRef = await browser.findByText('Sign in');

    if (!emailRef || !passwordRef || !signInRef) {
      console.error('   ✗ Form elements not found. Page structure:');
      const snap = await browser.snapshot();
      console.error('   Elements:', snap.elements.slice(0, 10));
      throw new Error('Login form incomplete');
    }

    await browser.fill(emailRef, 'admin@tracker.com');
    await browser.fill(passwordRef, 'admin123');
    await browser.click(signInRef);
    await browser.wait('Coaches', 15000);
    console.log('   ✓ Admin logged in');
    await browser.screenshot('02-admin-dashboard.png');

    // ============================================
    // STEP 2: Check Notification Bell
    // ============================================
    console.log('\n▶️  STEP 2: Check Notification Bell (Admin)');
    const snap = await browser.snapshot();
    const bellIcon = await browser.findByText('notification') || await browser.findByText('bell');
    if (bellIcon) {
      console.log('   ✓ Notification bell found');
      await browser.click(bellIcon);
      await browser.screenshot('03-admin-notifications.png');
    } else {
      console.log('   ⚠️  Notification bell not found (may not be in text tree)');
    }

    // ============================================
    // STEP 3: Create Test Coach
    // ============================================
    console.log('\n▶️  STEP 3: Create Test Coach');
    const addCoachBtn = await browser.findByText('Add Coach') || await browser.findByText('+ Coach') || await browser.findByText('Create');
    if (addCoachBtn) {
      await browser.click(addCoachBtn);
      await browser.screenshot('04-add-coach-modal.png');
      console.log('   ✓ Add Coach modal opened');

      // Fill form
      const nameInput = snap.elements.find(e => e.text?.includes('Name'))?.ref;
      const emailInput = snap.elements.find(e => e.text?.includes('Email'))?.ref;
      const passwordInput = snap.elements.find(e => e.text?.includes('Password'))?.ref;

      if (nameInput && emailInput && passwordInput) {
        await browser.fill(nameInput, 'Test Coach');
        await browser.fill(emailInput, 'testcoach@example.com');
        await browser.fill(passwordInput, 'password123');

        const createBtn = await browser.findByText('Create Coach') || await browser.findByText('Create');
        if (createBtn) {
          await browser.click(createBtn);
          await browser.wait('Test Coach', 5000);
          console.log('   ✓ Coach created');
          await browser.screenshot('05-coach-created.png');
        }
      }
    } else {
      console.log('   ⚠️  Add Coach button not found');
    }

    // ============================================
    // STEP 4: Assign Task with Future Due Date
    // ============================================
    console.log('\n▶️  STEP 4: Assign Task to Coach');
    const assignTaskBtn = await browser.findByText('Assign Task') || await browser.findByText('+ Task');
    if (assignTaskBtn) {
      await browser.click(assignTaskBtn);
      await browser.screenshot('06-assign-task-modal.png');
      console.log('   ✓ Assign Task page opened');

      // Would fill form here, but just capturing state
    } else {
      console.log('   ⚠️  Assign Task button not found');
    }

    // ============================================
    // STEP 5: Check Backend Health
    // ============================================
    console.log('\n▶️  STEP 5: Backend Health Check');
    try {
      const healthUrl = `${API_BASE}/health`;
      console.log(`   Checking: ${healthUrl}`);
      // Note: This would require allowing external API calls
      console.log('   (Skipping direct API check to avoid CORS)');
    } catch (err) {
      console.error('   ✗ Backend health check failed:', err.message);
    }

    // ============================================
    // STEP 6: Check Console for Errors
    // ============================================
    console.log('\n▶️  STEP 6: Check Console Errors');
    try {
      const logs = await browser.eval(`
        (function() {
          // Capture any fetch/XHR errors
          const errors = window.__capturedErrors || [];
          const failedRequests = window.__failedRequests || [];
          return JSON.stringify({ errors, failedRequests });
        })()
      `);
      console.log('   Console state:', logs);
    } catch (err) {
      console.log('   (Console eval not available)');
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEBUGGING RESULTS:');
    console.log('='.repeat(60));
    console.log('Screenshots saved:');
    console.log('  - 01-login-page.png');
    console.log('  - 02-admin-dashboard.png');
    console.log('  - 03-admin-notifications.png');
    console.log('  - 04-add-coach-modal.png');
    console.log('  - 05-coach-created.png');
    console.log('  - 06-assign-task-modal.png');
    console.log('\n⚠️  NEXT STEPS:');
    console.log('1. Check screenshots for UI rendering issues');
    console.log('2. Verify notifications bell appears and responds');
    console.log('3. Check browser console (F12) for errors on live site');
    console.log('4. Check backend logs for Groq API failures');
    console.log('5. Verify DATABASE_URL env var on Railway\n');

    await browser.close();
  } catch (err) {
    console.error('\n❌ Error during debugging:', err.message);
    await browser.close();
    process.exit(1);
  }
}

debugDeployedApp();
