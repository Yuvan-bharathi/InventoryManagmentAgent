const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  // 1. Authenticate as Planner / Purchasing Officer
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'planner', password: 'demo' })
  }).then(r => r.json());

  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate((tok) => {
    localStorage.setItem('inv.token', tok);
  }, loginRes.token);

  console.log('Navigating to http://127.0.0.1:5173/build-capacity ...');
  await page.goto('http://127.0.0.1:5173/build-capacity', { waitUntil: 'networkidle' });

  // Wait for calculator card
  await page.waitForSelector('text=Receipt-to-Capacity Calculator', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 2. Click preset "8 coils/box = 72k units"
  const btnPreset8 = page.locator('button:has-text("8 coils/box = 72k units")');
  console.log('Clicking preset: 8 coils/box = 72k units');
  await btnPreset8.click();
  await page.waitForTimeout(1500);

  // Verify that the UI reflects 72,727
  await page.waitForSelector('text=72,727', { timeout: 10000 });
  console.log('Verified 72,727 phones displayed for 8 coils/box!');

  // Take screenshot 1: 8 coils per box
  const screenshotPath1 = path.join(ARTIFACT_DIR, 'receipt_custom_8_coils.png');
  await page.screenshot({ path: screenshotPath1, fullPage: false });
  console.log(`Saved screenshot 1 to ${screenshotPath1}`);

  // 3. Test stepper: click + button to make it 9 coils, then calculate
  const plusBtn = page.locator('button:has-text("+")');
  await plusBtn.click();
  console.log('Clicked + button to increase inner count to 9');

  const calcBtn = page.locator('button:has-text("Calculate Capacity Impact")');
  await calcBtn.click();
  await page.waitForTimeout(1500);

  // 20 boxes * 9 coils * 0.1 kg = 18 kg. 18 / 0.00022 = 81,818 phones
  await page.waitForSelector('text=81,818', { timeout: 10000 });
  console.log('Verified 81,818 phones displayed for 9 coils/box!');

  const screenshotPath2 = path.join(ARTIFACT_DIR, 'receipt_stepper_9_coils.png');
  await page.screenshot({ path: screenshotPath2, fullPage: false });
  console.log(`Saved screenshot 2 to ${screenshotPath2}`);

  await browser.close();
  console.log('Done all UI validations successfully!');
})();
