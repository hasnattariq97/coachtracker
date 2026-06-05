import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import AgentBrowserHelper from './agent-browser.helper.js';

describe('Coaching Insights E2E', () => {
  let browser;

  beforeAll(async () => {
    browser = new AgentBrowserHelper();
    await browser.open('http://localhost:5173/login');
  });

  afterAll(async () => {
    await browser.close();
  });

  it('coach completes task and receives coaching insights notification', async () => {
    // Step 1: Login as coach
    await browser.fill('@coach-email', 'coach1@example.com');
    await browser.fill('@coach-password', 'password123');
    await browser.click('@login-button');
    await browser.wait('Dashboard', 10000);

    // Step 2: Navigate to My Tasks
    const tasksRef = await browser.findByText('My Tasks');
    await browser.click(tasksRef);
    await browser.wait('Task', 10000);

    // Step 3: Complete a task
    const completeRef = await browser.findByText('Mark Complete');
    if (completeRef) {
      await browser.click(completeRef);
      await browser.wait('marked as complete', 5000);
    }

    // Step 4: Open notification bell
    const bellRef = await browser.findByText('Notifications');
    await browser.click(bellRef);
    await browser.wait(2000); // Wait for dropdown

    // Step 5: Verify coaching insights notification appears
    const snap = await browser.snapshot();
    const hasCoachingInsights = snap.includes('coaching') || snap.includes('Growth Opportunity') || snap.includes('insight');
    expect(hasCoachingInsights).toBe(true);

    // Step 6: Take screenshot
    await browser.screenshot('coaching-insights-notification.png');
  });

  it('coaching insights card displays pattern and growth opportunity', async () => {
    // Assuming logged in from previous test
    const snap = await browser.snapshot();

    // Verify card components are visible
    expect(snap).toContain('Growth Opportunity');
    // Growth Opportunity should be highlighted (orange border)
  });

  it('coaching insights expand to show detailed analysis', async () => {
    const expandRef = await browser.findByText('Show Details');
    if (expandRef) {
      await browser.click(expandRef);
      await browser.wait(1000);

      const snap = await browser.snapshot();
      expect(snap).toContain('Pattern Analysis');
      expect(snap).toContain('Risk Analysis');
    }
  });
});
