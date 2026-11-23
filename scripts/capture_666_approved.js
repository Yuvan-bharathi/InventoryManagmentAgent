const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  // 1. Login as Buyer
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Sign in as buyer")');
  await page.waitForURL('**/home', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // 2. Open /proposals/666
  await page.goto('http://127.0.0.1:5173/proposals/666', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const screenshotApproved = path.join(ARTIFACT_DIR, 'proposal_666_approved_final.png');
  await page.screenshot({ path: screenshotApproved });
  console.log('Saved approved 666 screenshot:', screenshotApproved);

  await browser.close();
}

run().catch(console.error);
