const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Warehouse Goods Receiving and Cycle Counts pages...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  const port = 5173;

  // 1. Authenticate via API
  console.log('Logging in...');
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'planner', password: 'demo' })
  }).then(r => r.json());

  await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(tok => localStorage.setItem('inv.token', tok), loginRes.token);

  // 2. Test /receiving
  console.log('Navigating to /receiving ...');
  await page.goto(`http://127.0.0.1:${port}/receiving`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'debug_receiving_page.png') });

  // Verify KPIs
  await page.waitForSelector('h1:has-text("Goods Receiving & Dock Inbound Log")', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('text=TOTAL INBOUND RECEIPTS', { state: 'visible' });
  await page.waitForSelector('text=ON-TIME DOCK ARRIVAL', { state: 'visible' });

  const p1 = path.join(ARTIFACT_DIR, 'warehouse_goods_receiving.png');
  await page.screenshot({ path: p1 });
  console.log('Saved Goods Receiving screenshot:', p1);

  // Open Receive Inbound Delivery modal
  console.log('Opening Receive Inbound Delivery modal...');
  const receiveBtn = page.locator('button:has-text("+ Receive Inbound Delivery")');
  await receiveBtn.click();
  await page.waitForTimeout(1000);

  const p2 = path.join(ARTIFACT_DIR, 'warehouse_receive_modal.png');
  await page.screenshot({ path: p2 });
  console.log('Saved Receive Inbound Modal screenshot:', p2);

  // Submit intake form
  const intakeSubmit = page.locator('button:has-text("Confirm Dock Receipt")');
  await intakeSubmit.click();
  await page.waitForTimeout(1500);

  // 3. Test /cycle-counts
  console.log('Navigating to /cycle-counts ...');
  await page.goto(`http://127.0.0.1:${port}/cycle-counts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify KPIs & ABC policy cards
  await page.waitForSelector('h1:has-text("Cycle Counts & Inventory Record Accuracy (IRA)")', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('text=RECORD ACCURACY (IRA)', { state: 'visible' });
  await page.waitForSelector('text=AUDITS PERFORMED', { state: 'visible' });
  await page.waitForSelector('text=Class A · High Value', { state: 'visible' });
  await page.waitForSelector('text=Class B · Semi-Critical', { state: 'visible' });

  const p3 = path.join(ARTIFACT_DIR, 'warehouse_cycle_counts.png');
  await page.screenshot({ path: p3 });
  console.log('Saved Cycle Counts screenshot:', p3);

  // Open Record Physical Count modal
  console.log('Opening Record Physical Count modal...');
  const countBtn = page.locator('button:has-text("+ Record Physical Count")');
  await countBtn.click();
  await page.waitForTimeout(1000);

  const p4 = path.join(ARTIFACT_DIR, 'warehouse_cycle_count_modal.png');
  await page.screenshot({ path: p4 });
  console.log('Saved Cycle Count Modal screenshot:', p4);

  // Submit count audit form
  const countSubmit = page.locator('button:has-text("Submit Physical Count")');
  await countSubmit.click();
  await page.waitForTimeout(1500);

  await browser.close();
  console.log('All warehouse pages verified successfully!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
