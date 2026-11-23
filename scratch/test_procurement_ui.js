const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  // 1. Login
  console.log('Navigating to login...');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });

  // Fill in demo credentials
  await page.fill('input[name="username"]', 'buyer');
  await page.fill('input[name="password"]', 'demo');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // 2. Navigate to Smart Procurement page
  console.log('Navigating to /procurement...');
  await page.goto('http://127.0.0.1:5173/procurement', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of Procurement Overview & Comparison Matrix
  const screenshotProcurement = path.join(ARTIFACT_DIR, 'walkthrough_8_procurement.png');
  await page.screenshot({ path: screenshotProcurement, fullPage: false });
  console.log('Saved Procurement Page Screenshot:', screenshotProcurement);

  // 3. Test Clicking "Create Draft PO" button
  console.log('Checking for Create Draft PO button...');
  const createPoBtn = await page.$('button:has-text("Create Draft PO")');
  if (createPoBtn) {
    await createPoBtn.click();
    await page.waitForTimeout(800);
    const screenshotModal = path.join(ARTIFACT_DIR, 'walkthrough_8_po_modal.png');
    await page.screenshot({ path: screenshotModal });
    console.log('Saved Draft PO Modal Screenshot:', screenshotModal);

    // Click confirm in modal
    const confirmBtn = await page.$('button:has-text("Confirm & Create Draft PO")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);
      const screenshotSuccess = path.join(ARTIFACT_DIR, 'walkthrough_8_po_success.png');
      await page.screenshot({ path: screenshotSuccess });
      console.log('Saved PO Success Screenshot:', screenshotSuccess);
    }
  }

  // 4. Test Agent Procurement Query
  console.log('Navigating to /agent to test procurement query...');
  await page.goto('http://127.0.0.1:5173/agent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Type question in chat composer
  const composer = await page.$('textarea, input[placeholder*="Ask"]');
  if (composer) {
    await composer.fill('Compare supplier quotes for MAT-CAM-007 camera module');
    const sendBtn = await page.$('button[type="submit"], button.send-btn, button:has(svg)');
    if (sendBtn) {
      await sendBtn.click();
      console.log('Question submitted, awaiting response...');
      await page.waitForTimeout(6000);
      const screenshotAgentProcurement = path.join(ARTIFACT_DIR, 'walkthrough_9_agent_procurement_query.png');
      await page.screenshot({ path: screenshotAgentProcurement, fullPage: false });
      console.log('Saved agent response screenshot:', screenshotAgentProcurement);
    }
  }

  await browser.close();
  console.log('Playwright UI verification finished cleanly!');
})();
