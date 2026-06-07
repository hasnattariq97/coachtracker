#!/usr/bin/env node

/**
 * Agent-Browser Test: Verify Coaching Insights on Live Deployed App
 * Tests: Create task → Complete task → Verify coaching insights notification
 */

import AgentBrowserHelper from './src/__tests__/e2e/agent-browser.helper.js';

async function testCoachingInsights() {
  const browser = new AgentBrowserHelper({
    baseUrl: 'https://coachtracker-theta.vercel.app',
    headless: false,
    timeout: 60000,
  });

  try {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 COACHING INSIGHTS E2E TEST (Live Deployed App)');
    console.log('='.repeat(70) + '\n');

    // ============================================
    // STEP 1: Admin Login
    // ============================================
    console.log('▶️  STEP 1: Admin Login');
    await browser.navigate('/login');
    await browser.screenshot('01-live-login.png');

    const emailInput = await browser.findByText('Email');
    const passwordInput = await browser.findByText('Password');
    const loginBtn = await browser.findByText('Sign in');

    if (!emailInput || !passwordInput || !loginBtn) {
      throw new Error('Login form not found');
    }

    await browser.fill(emailInput, 'admin@tracker.com');
    await browser.fill(passwordInput, 'admin123');
    await browser.click(loginBtn);
    await browser.wait('Coaches', 15000);
    console.log('   ✅ Admin logged in');
    await browser.screenshot('02-live-admin-dashboard.png');

    // ============================================
    // STEP 2: Assign Task
    // ============================================
    console.log('\n▶️  STEP 2: Assign Task to Coach');

    // Find and click "Assign Task" button
    const assignBtn = await browser.findByText('Assign Task') ||
                      await browser.findByText('+ Task') ||
                      await browser.findByText('Create Task');

    if (!assignBtn) {
      console.log('   ⚠️  Could not find Assign Task button, checking page structure');
      const snap = await browser.snapshot();
      console.log('   Page elements:', snap.elements.slice(0, 10).map(e => e.text).join(', '));
      throw new Error('Assign Task button not found');
    }

    await browser.click(assignBtn);
    await browser.wait('Task', 5000);
    console.log('   ✅ Task assignment page opened');
    await browser.screenshot('03-live-assign-task-page.png');

    // Fill task form (approximate - exact refs vary by page)
    const snap = await browser.snapshot();
    console.log('   Page structure:', snap.elements.slice(0, 5).map(e => e.text).join(', '));

    // Try to find and fill form fields
    const titleInput = snap.elements.find(e => e.text?.toLowerCase().includes('title'))?.ref ||
                       snap.elements[0]?.ref;

    if (titleInput) {
      await browser.fill(titleInput, `Coaching Insights Test - ${new Date().getTime()}`);
      console.log('   ✅ Title filled');
    }

    // Find due date input
    const dueInput = snap.elements.find(e => e.text?.toLowerCase().includes('due'))?.ref;
    if (dueInput) {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const dateStr = futureDate.toISOString().split('T')[0];
      await browser.fill(dueInput, dateStr);
      console.log('   ✅ Due date filled');
    }

    // Find and click create/submit button
    const createBtn = await browser.findByText('Create') ||
                      await browser.findByText('Assign') ||
                      await browser.findByText('Save');

    if (createBtn) {
      await browser.click(createBtn);
      await browser.wait('success', 5000);
      console.log('   ✅ Task created');
    }

    await browser.screenshot('04-live-task-created.png');

    // ============================================
    // STEP 3: Logout and Login as Coach
    // ============================================
    console.log('\n▶️  STEP 3: Logout and Login as Coach');

    // Find logout button/menu
    const menuBtn = await browser.findByText('Menu') ||
                    await browser.findByText('Settings') ||
                    await browser.findByText('Profile');

    if (menuBtn) {
      await browser.click(menuBtn);
      const logoutBtn = await browser.findByText('Logout') ||
                        await browser.findByText('Sign out');
      if (logoutBtn) {
        await browser.click(logoutBtn);
        await browser.wait('Sign in', 5000);
      }
    } else {
      console.log('   ℹ️  Could not find logout button, navigating to login');
      await browser.navigate('/login');
    }

    await browser.screenshot('05-live-logout.png');

    // Login as coach
    const coachEmailInput = await browser.findByText('Email');
    const coachPasswordInput = await browser.findByText('Password');
    const coachLoginBtn = await browser.findByText('Sign in');

    await browser.fill(coachEmailInput, 'saima.jabeen@niete.edu.pk');
    await browser.fill(coachPasswordInput, 'coach123');
    await browser.click(coachLoginBtn);

    try {
      await browser.wait('My Tasks', 10000);
      console.log('   ✅ Coach logged in');
    } catch (e) {
      console.log('   ⚠️  Coach login may have failed, trying to continue');
    }

    await browser.screenshot('06-live-coach-dashboard.png');

    // ============================================
    // STEP 4: Check Notifications Bell
    // ============================================
    console.log('\n▶️  STEP 4: Check Notification Bell');
    const snap2 = await browser.snapshot();
    const bellOrNotif = snap2.elements.find(e =>
      e.text?.toLowerCase().includes('notification') ||
      e.text?.toLowerCase().includes('bell') ||
      e.text === '1' || e.text === '2'
    );

    if (bellOrNotif) {
      console.log('   ✅ Found notification indicator');
      await browser.click(bellOrNotif.ref);
      await browser.screenshot('07-live-notifications-bell.png');
    } else {
      console.log('   ℹ️  Notification bell not clearly identified');
    }

    // ============================================
    // STEP 5: Find and Complete Task
    // ============================================
    console.log('\n▶️  STEP 5: Complete the Task');
    const taskCard = await browser.findByText('Coaching Insights Test') ||
                     await browser.findByText('Test Task') ||
                     snap2.elements.find(e => e.text?.includes('Task'))?.ref;

    if (taskCard) {
      await browser.click(taskCard);
      await browser.screenshot('08-live-task-detail.png');

      const completeBtn = await browser.findByText('Mark Complete') ||
                          await browser.findByText('Complete') ||
                          await browser.findByText('Done');

      if (completeBtn) {
        await browser.click(completeBtn);
        console.log('   ✅ Task marked complete');
        await browser.screenshot('09-live-task-completed.png');
      } else {
        console.log('   ⚠️  Could not find Complete button');
      }
    } else {
      console.log('   ⚠️  Could not find task card');
    }

    // ============================================
    // STEP 6: Wait and Check for Coaching Insights
    // ============================================
    console.log('\n▶️  STEP 6: Wait for Coaching Insights (2-3 seconds)');
    await new Promise(r => setTimeout(r, 3000));

    const snap3 = await browser.snapshot();
    console.log('   Checking for "coaching_insights" in page...');

    const hasCoachingInsights = snap3.elements.some(e =>
      e.text?.toLowerCase().includes('coaching') ||
      e.text?.toLowerCase().includes('insight') ||
      e.text?.toLowerCase().includes('momentum') ||
      e.text?.toLowerCase().includes('pattern') ||
      e.text?.toLowerCase().includes('growth')
    );

    if (hasCoachingInsights) {
      console.log('   ✅ COACHING INSIGHTS FOUND!');
      snap3.elements.forEach(e => {
        if (e.text?.toLowerCase().includes('coaching') ||
            e.text?.toLowerCase().includes('insight') ||
            e.text?.toLowerCase().includes('momentum')) {
          console.log(`      "${e.text}"`);
        }
      });
    } else {
      console.log('   ❌ NO COACHING INSIGHTS DETECTED');
      console.log('   This could mean:');
      console.log('     1. Coaching insights are still processing');
      console.log('     2. COACHING_INSIGHTS_ENABLED not deployed yet');
      console.log('     3. Groq API failed silently');
    }

    await browser.screenshot('10-live-coaching-insights-result.png');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('Screenshots saved to client/screenshots/:');
    console.log('  01-live-login.png');
    console.log('  02-live-admin-dashboard.png');
    console.log('  03-live-assign-task-page.png');
    console.log('  04-live-task-created.png');
    console.log('  05-live-logout.png');
    console.log('  06-live-coach-dashboard.png');
    console.log('  07-live-notifications-bell.png');
    console.log('  08-live-task-detail.png');
    console.log('  09-live-task-completed.png');
    console.log('  10-live-coaching-insights-result.png');
    console.log('\n✅ If coaching insights appeared → Feature is WORKING!');
    console.log('❌ If not → Check Railway deployment status');
    console.log('='.repeat(70) + '\n');

    await browser.close();
  } catch (err) {
    console.error('\n❌ Test error:', err.message);
    try {
      await browser.close();
    } catch (e) {}
    process.exit(1);
  }
}

testCoachingInsights();
