const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Floating Toast Notification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Authenticate as Priya (Planner)
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'planner', password: 'demo' })
  }).then(r => r.json());

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate((tok) => {
    localStorage.setItem('inv.token', tok);
  }, loginRes.token);

  await page.goto('http://127.0.0.1:5173/procurement', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 2. Click Create Draft PO
  console.log('Waiting for and clicking Create Draft PO button...');
  await page.waitForSelector('button:has-text("Create Draft PO")');
  await page.click('button:has-text("Create Draft PO")');
  await page.waitForTimeout(800);

  // 3. Click Confirm & Route Draft PO
  console.log('Clicking Confirm & Route Draft PO button...');
  await page.waitForSelector('button:has-text("Confirm & Route Draft PO")');
  await page.click('button:has-text("Confirm & Route Draft PO")');

  // Wait for the floating toast notification to appear
  console.log('Waiting for floating toast notification to appear...');
  await page.waitForSelector('div[role="status"]');
  await page.waitForTimeout(500);

  // 4. Take screenshot with the floating toast visible
  const toastScreenshot = path.join(ARTIFACT_DIR, 'floating_toast_success.png');
  await page.screenshot({ path: toastScreenshot });
  console.log('Saved floating toast screenshot:', toastScreenshot);

  await browser.close();
}

run().catch(console.error);
