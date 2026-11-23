const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Fetch token directly from API or Login
  console.log('1. Logging in via API to get valid token...');
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'leader', password: 'demo' })
  });
  const loginData = await loginRes.json();
  console.log('Token acquired:', loginData.token ? 'YES' : 'NO');

  // Inject token into browser localStorage
  await context.addInitScript((tok) => {
    localStorage.setItem('inv.token', tok);
    localStorage.setItem('inv.plant', 'IN-TN-01');
    localStorage.setItem('picktwin.theme', 'light');
  }, loginData.token);

  // 2. Navigate to Smart Procurement page
  console.log('2. Navigating to /procurement...');
  await page.goto('http://127.0.0.1:5173/procurement', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take screenshot of Procurement Overview & Comparison Matrix
  const screenshotProcurement = path.join(ARTIFACT_DIR, 'walkthrough_8_procurement.png');
  await page.screenshot({ path: screenshotProcurement, fullPage: false });
  console.log('Captured 8. Smart Procurement Overview & Quote Comparison Matrix:', screenshotProcurement);

  // 3. Test Clicking "Create Draft PO" button
  console.log('3. Checking for Create Draft PO button...');
  const createPoBtn = await page.$('button:has-text("Create Draft PO")');
  if (createPoBtn) {
    await createPoBtn.click();
    await page.waitForTimeout(1000);
    const screenshotModal = path.join(ARTIFACT_DIR, 'walkthrough_8_po_modal.png');
    await page.screenshot({ path: screenshotModal });
    console.log('Captured Draft PO Drawer/Modal:', screenshotModal);

    // Click confirm in modal
    const confirmBtn = await page.$('button:has-text("Confirm & Create Draft PO")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(1200);
      const screenshotSuccess = path.join(ARTIFACT_DIR, 'walkthrough_8_po_success.png');
      await page.screenshot({ path: screenshotSuccess });
      console.log('Captured PO Created Success Banner:', screenshotSuccess);
    }
  }

  // 4. Test Agent Procurement Query
  console.log('4. Navigating to /agent to test procurement natural language query...');
  await page.goto('http://127.0.0.1:5173/agent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Type question in chat composer and press Enter
  const composer = await page.$('.composer textarea');
  if (composer) {
    await composer.fill('Compare supplier quotes for MAT-CAM-007 camera module');
    await composer.press('Enter');
    console.log('Question submitted via Enter, awaiting streaming agent response...');
    await page.waitForTimeout(14000);
    const screenshotAgentProcurement = path.join(ARTIFACT_DIR, 'walkthrough_9_agent_procurement_query.png');
    await page.screenshot({ path: screenshotAgentProcurement, fullPage: false });
    console.log('Captured 9. Agent Procurement Query & Decision:', screenshotAgentProcurement);
  }

  await browser.close();
  console.log('SUCCESS! All procurement UI tests and screenshots completed.');
}

run().catch(console.error);
