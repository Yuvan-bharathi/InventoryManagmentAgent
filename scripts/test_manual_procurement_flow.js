const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Manual Procurement & AI Dealer Recommendation Flow...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Authenticate as Purchasing Officer (buyer)
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'buyer', password: 'demo' })
  }).then(r => r.json());

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate((tok) => {
    localStorage.setItem('inv.token', tok);
  }, loginRes.token);

  // 2. Navigate to /procurement
  console.log('Navigating to /procurement...');
  await page.goto('http://127.0.0.1:5173/procurement', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 3. Click "+ Create Manual PO" button
  console.log('Clicking + Create Manual PO button...');
  await page.waitForSelector('button:has-text("+ Create Manual PO")');
  await page.click('button:has-text("+ Create Manual PO")');
  await page.waitForTimeout(800);

  // Step 1 Screenshot
  const screenshotStep1 = path.join(ARTIFACT_DIR, 'manual_po_step1_demand.png');
  await page.screenshot({ path: screenshotStep1 });
  console.log('Saved Step 1 screenshot:', screenshotStep1);

  // 4. Trigger AI Recommendation
  console.log('Clicking ✨ Ask Agent to Recommend Best Supplier button...');
  await page.click('button:has-text("Ask Agent to Recommend Best Supplier")');
  await page.waitForTimeout(2000);

  // Step 2 Screenshot
  const screenshotStep2 = path.join(ARTIFACT_DIR, 'manual_po_step2_ai_recommendation.png');
  await page.screenshot({ path: screenshotStep2 });
  console.log('Saved Step 2 screenshot:', screenshotStep2);

  // 5. Click Proceed to Commercial Terms
  console.log('Clicking Proceed to Commercial Terms...');
  await page.click('button:has-text("Proceed to Commercial Terms")');
  await page.waitForTimeout(800);

  // Step 3 Screenshot
  const screenshotStep3 = path.join(ARTIFACT_DIR, 'manual_po_step3_commercials.png');
  await page.screenshot({ path: screenshotStep3 });
  console.log('Saved Step 3 screenshot:', screenshotStep3);

  // 6. Click Confirm & Route Manual PO
  console.log('Clicking Confirm & Route Manual PO...');
  await page.click('button:has-text("Confirm & Route Manual PO")');
  await page.waitForTimeout(1500);

  // Step 4 Screenshot with Floating Toast
  const screenshotStep4 = path.join(ARTIFACT_DIR, 'manual_po_step4_toast_created.png');
  await page.screenshot({ path: screenshotStep4 });
  console.log('Saved Step 4 screenshot:', screenshotStep4);

  // 7. Verify Proposals page has "+ Create Manual PO" button
  console.log('Navigating to /proposals to verify header button...');
  await page.goto('http://127.0.0.1:5173/proposals', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const screenshotProposalsBtn = path.join(ARTIFACT_DIR, 'proposals_manual_btn_verified.png');
  await page.screenshot({ path: screenshotProposalsBtn });
  console.log('Saved Proposals manual button screenshot:', screenshotProposalsBtn);

  await browser.close();
  console.log('Manual Procurement testing completed successfully!');
}

run().catch(console.error);

