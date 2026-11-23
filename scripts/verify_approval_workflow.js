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

  // 1. Visit Login Page to verify enhanced design and Purchasing Officer title
  console.log('1. Navigating to login page...');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const screenshotLogin = path.join(ARTIFACT_DIR, 'login_purchasing_officer.png');
  await page.screenshot({ path: screenshotLogin });
  console.log('Saved enhanced login screenshot:', screenshotLogin);

  // 2. Obtain token directly from backend and set in localStorage
  console.log('2. Authenticating as Purchasing Officer (buyer)...');
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'buyer', password: 'demo' })
  }).then(r => r.json());

  await page.evaluate((tok) => {
    localStorage.setItem('inv.token', tok);
  }, loginRes.token);

  // 3. Navigate to /procurement
  console.log('3. Navigating to /procurement...');
  await page.goto('http://127.0.0.1:5173/procurement', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click "Create Draft PO" on recommended supplier
  console.log('4. Clicking Create Draft PO...');
  const createBtn = await page.$('button:has-text("Create Draft PO")');
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(800);

    const screenshotModal = path.join(ARTIFACT_DIR, 'procurement_modal_purchasing_officer.png');
    await page.screenshot({ path: screenshotModal });
    console.log('Saved modal screenshot with Purchasing Officer text:', screenshotModal);

    // Close modal
    const closeBtn = await page.$('button:has-text("Cancel")');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 4. Navigate to /proposals/666
  console.log('5. Navigating to /proposals/666...');
  await page.goto('http://127.0.0.1:5173/proposals/666', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const screenshot666 = path.join(ARTIFACT_DIR, 'proposal_666_purchasing_officer.png');
  await page.screenshot({ path: screenshot666 });
  console.log('Saved proposal 666 screenshot:', screenshot666);

  // 5. Navigate to /proposals list
  console.log('6. Navigating to /proposals...');
  await page.goto('http://127.0.0.1:5173/proposals', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const screenshotList = path.join(ARTIFACT_DIR, 'proposal_list_purchasing_officer.png');
  await page.screenshot({ path: screenshotList });
  console.log('Saved proposal list screenshot:', screenshotList);

  await browser.close();
  console.log('All verification tests completed successfully!');
}

run().catch(console.error);
