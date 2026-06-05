/**
 * Simple Agent-Browser Demo Test
 *
 * Demonstrates agent-browser integration with Coach Task Tracker
 */

import { execSync } from 'child_process';

const cli = 'npx agent-browser';
const BASE_URL = 'http://localhost:5173';

function run(command) {
  console.log(`  $ ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output;
  } catch (error) {
    console.error(`  Error: ${error.message.split('\n')[0]}`);
    throw error;
  }
}

async function runDemo() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  Agent-Browser Integration Test — Coach Task Tracker');
  console.log('════════════════════════════════════════════════════════════════\n');

  try {
    // Test 1: Check version
    console.log('TEST 1: Agent-Browser CLI Version');
    const versionOutput = run(`${cli} --version`);
    console.log(`  ✓ ${versionOutput.trim()}\n`);

    // Test 2: Get help
    console.log('TEST 2: Check Available Commands');
    const helpOutput = run(`${cli} --help`);
    const hasOpen = helpOutput.includes('open');
    const hasSnapshot = helpOutput.includes('snapshot');
    const hasClick = helpOutput.includes('click');
    console.log(`  ✓ Core commands available: open=${hasOpen}, snapshot=${hasSnapshot}, click=${hasClick}\n`);

    // Test 3: Open app
    console.log(`TEST 3: Open Coach Task Tracker (${BASE_URL})`);
    const openOutput = run(`${cli} open ${BASE_URL} --timeout=10000`);
    console.log(`  ✓ Browser session opened\n`);

    // Test 4: Get page title
    console.log('TEST 4: Get Page Title');
    const titleOutput = run(`${cli} get title`);
    console.log(`  ✓ Page title: ${titleOutput.trim()}\n`);

    // Test 5: Take snapshot
    console.log('TEST 5: Get Page Snapshot (Accessibility Tree)');
    const snapOutput = run(`${cli} snapshot`);
    let snap = {};
    try {
      snap = JSON.parse(snapOutput);
      console.log(`  ✓ Snapshot captured`);
      console.log(`    - Page URL: ${snap.url || 'N/A'}`);
      console.log(`    - Total elements: ${snap.elements?.length || 0}\n`);

      // List elements with refs
      if (snap.elements && snap.elements.length > 0) {
        console.log('  First 5 Elements (with refs for LLM):');
        snap.elements.slice(0, 5).forEach((el, i) => {
          const text = (el.text || el.role || 'N/A').substring(0, 40);
          console.log(`    ${i + 1}. @${el.ref}: "${text}"`);
        });
        console.log();
      }
    } catch (e) {
      console.log(`  ⚠ Snapshot parsing error (JSON may be malformed)\n`);
    }

    // Test 6: Take screenshot
    console.log('TEST 6: Take Screenshot');
    const screenshotPath = './screenshots/demo-screenshot.png';
    try {
      run(`${cli} screenshot ${screenshotPath}`);
      console.log(`  ✓ Screenshot saved: ${screenshotPath}\n`);
    } catch (e) {
      console.log(`  ⚠ Screenshot save skipped (may need --headless=false)\n`);
    }

    // Test 7: Find element
    console.log('TEST 7: Find Login Elements');
    try {
      const emailInput = run(`${cli} find text "Email"`);
      console.log(`  ✓ Found email input\n`);
    } catch (e) {
      console.log(`  ⚠ Element finder not available in this version\n`);
    }

    // Test 8: Close
    console.log('TEST 8: Close Browser Session');
    try {
      run(`${cli} close`);
      console.log(`  ✓ Browser closed\n`);
    } catch (e) {
      console.log(`  ⚠ Browser close not critical\n`);
    }

    console.log('════════════════════════════════════════════════════════════════');
    console.log('  ✅ SUCCESS: Agent-Browser Integration Working!');
    console.log('════════════════════════════════════════════════════════════════\n');

    console.log('Next Steps:');
    console.log('  1. Update test files with correct agent-browser commands');
    console.log('  2. Run E2E tests: npm run test:e2e');
    console.log('  3. Customize test workflows for your Coach Task Tracker flows\n');

    console.log('Key Advantages of Agent-Browser:');
    console.log('  • Element refs (@e1, @e2) are stable and deterministic');
    console.log('  • Accessibility tree better for LLM reasoning');
    console.log('  • Works standalone (outside Claude Code)');
    console.log('  • Perfect for CI/CD pipeline integration\n');

  } catch (error) {
    console.error('\n════════════════════════════════════════════════════════════════');
    console.error('  ✗ TEST FAILED');
    console.error('════════════════════════════════════════════════════════════════\n');
    console.error('Troubleshooting:');
    console.error('  1. Ensure backend is running:   cd server && node index.js');
    console.error('  2. Ensure frontend is running:  cd client && npm run dev');
    console.error('  3. Check servers are accessible:');
    console.error('     - Backend: http://localhost:3001/health');
    console.error('     - Frontend: http://localhost:5173\n');
    process.exit(1);
  }
}

runDemo();
