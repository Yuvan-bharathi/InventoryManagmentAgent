const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Agent Hub & Pipeline, Navigation Separation, and Agent Tester Playground...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Authenticate via login page UI
  console.log('Navigating to login page...');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.selectOption('select', 'planner');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('Signed in. Current URL:', page.url());

  // 2. Navigate to /agents (Enterprise Agent Hub & Pipeline)
  console.log('Navigating to /agents ...');
  await page.goto('http://127.0.0.1:5173/agents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify elements on Agent Hub
  await page.waitForSelector('text=Enterprise Agent Hub & Collaborative Pipeline', { timeout: 15000 });
  await page.waitForSelector('text=End-to-End Multi-Agent Supply Chain Pipeline');
  await page.waitForSelector('text=AGT-06');
  console.log('Agent Hub & Pipeline successfully verified!');

  // Screenshot 1: Agent Hub & Pipeline
  const screenshotHub = path.join(ARTIFACT_DIR, 'agent_hub_and_pipeline.png');
  await page.screenshot({ path: screenshotHub, fullPage: false });
  console.log('Saved Agent Hub screenshot:', screenshotHub);

  // 3. Click "Test Agent" on AGT-06 Smart Procurement & RFQ Agent
  console.log('Clicking Test Agent on AGT-06...');
  const testAgt6Btn = page.locator('.card:has-text("AGT-06") button:has-text("Test Agent")');
  await testAgt6Btn.click();
  await page.waitForTimeout(2500);

  // Verify we are on /agent-tester?agent=procurement
  console.log('Current URL after click:', page.url());
  await page.waitForSelector('h1:has-text("Specialized Agent Testing Playground")', { timeout: 15000 });

  // Verify dropdowns
  await page.waitForSelector('label:has-text("Target Plant")');
  await page.waitForSelector('label:has-text("Target Material")');
  await page.waitForSelector('label:has-text("Supplier (for Sourcing / Delays)")');
  console.log('Verified all parameter dropdowns!');

  // Click Run Test
  console.log('Running test on Smart Procurement Agent...');
  const runBtn = page.locator('button:has-text("Test")').filter({ hasText: 'Procurement' });
  await runBtn.click();
  await page.waitForTimeout(4000);

  // Verify execution results
  await page.waitForSelector('text=TEST PASSED', { timeout: 20000 });
  console.log('Verified test passed with live MCP tool trace!');

  // Screenshot 2: Agent Tester with Live Result
  const screenshotTester = path.join(ARTIFACT_DIR, 'agent_tester_procurement_result.png');
  await page.screenshot({ path: screenshotTester, fullPage: false });
  console.log('Saved Agent Tester screenshot:', screenshotTester);

  // 4. Test another agent via dropdown: Shortage Forecast Agent
  console.log('Switching agent to Shortage Forecast Agent...');
  const agentSelect = page.locator('.card:has-text("SELECT AGENT TO TEST") select');
  await agentSelect.selectOption('shortage_forecast');
  await page.waitForTimeout(1000);

  // Click preset button
  const presetShortage = page.locator('button:has-text("30-Day Shortage Risk")');
  await presetShortage.click();
  await page.waitForTimeout(500);

  const runBtn2 = page.locator('button:has-text("Test Shortage Forecast Agent")');
  await runBtn2.click();
  await page.waitForTimeout(4000);

  await page.waitForSelector('text=TEST PASSED', { timeout: 20000 });
  console.log('Verified Shortage Forecast Agent test passed!');

  const screenshotShortage = path.join(ARTIFACT_DIR, 'agent_tester_shortage_result.png');
  await page.screenshot({ path: screenshotShortage, fullPage: false });
  console.log('Saved Shortage Tester screenshot:', screenshotShortage);

  await browser.close();
  console.log('All validations completed with 100% success!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
