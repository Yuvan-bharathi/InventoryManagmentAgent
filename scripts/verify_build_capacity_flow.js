const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Build Capacity & Receipt-to-Capacity Calculator Flow...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

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

  // 2. Navigate to /build-capacity
  console.log('Navigating to /build-capacity...');
  await page.goto('http://127.0.0.1:5173/build-capacity', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Screenshot 1: Top KPI Cards + Default Solder Wire Receipt-to-Capacity (90,909 vs 0 added)
  const screenshotOverview = path.join(ARTIFACT_DIR, 'receipt_to_capacity_solder_wire.png');
  await page.screenshot({ path: screenshotOverview, fullPage: false });
  console.log('Saved Solder Wire Receipt-to-Capacity screenshot:', screenshotOverview);

  // 3. Test PCB Replenishment Preset (Click "10 Boxes Main PCB")
  console.log('Clicking ⚡ 10 Boxes Main PCB preset button...');
  await page.click('button:has-text("10 Boxes Main PCB")');
  await page.waitForTimeout(1500);

  // Screenshot 2: PCB Replenishment simulation
  const screenshotPcb = path.join(ARTIFACT_DIR, 'receipt_to_capacity_pcb_replenish.png');
  await page.screenshot({ path: screenshotPcb, fullPage: false });
  console.log('Saved PCB Replenishment screenshot:', screenshotPcb);

  // 4. Scroll to 16-Part BOM Table
  console.log('Scrolling to BOM Component Analysis table...');
  const tableEl = await page.waitForSelector('table.table');
  await tableEl.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Screenshot 3: BOM Table with Safety Stock & Protected Capacity
  const screenshotBom = path.join(ARTIFACT_DIR, 'bom_table_safety_stock_view.png');
  await page.screenshot({ path: screenshotBom, fullPage: false });
  console.log('Saved BOM Table Safety Stock screenshot:', screenshotBom);

  await browser.close();
  console.log('✓ All Build Capacity & Receipt-to-Capacity tests completed successfully!');
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

