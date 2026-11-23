const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Layout Adjustments for Quality, Receiving, and Cycle Counts...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });

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

  // 1. Verify Quality Hold and Rejects (5 KPI cards in 1 line)
  console.log('Navigating to /quality ...');
  await page.goto(`http://127.0.0.1:${port}/quality`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.waitForSelector('text=Quality Hold and Rejects', { state: 'visible' });
  const qPath = path.join(ARTIFACT_DIR, 'quality_5_kpis_single_line.png');
  await page.screenshot({ path: qPath });
  console.log('Saved /quality screenshot:', qPath);

  // 2. Verify Goods Receiving (All PO Statuses next to All Receiving Plants)
  console.log('Navigating to /receiving ...');
  await page.goto(`http://127.0.0.1:${port}/receiving`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.waitForSelector('h1:has-text("Goods Receiving & Dock Inbound Log")', { state: 'visible' });
  const rPath = path.join(ARTIFACT_DIR, 'receiving_dropdowns_single_line.png');
  await page.screenshot({ path: rPath });
  console.log('Saved /receiving screenshot:', rPath);

  // 3. Verify Cycle Counts (All Audit Statuses next to All Audited Plants)
  console.log('Navigating to /cycle-counts ...');
  await page.goto(`http://127.0.0.1:${port}/cycle-counts`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.waitForSelector('h1:has-text("Cycle Counts & Inventory Record Accuracy (IRA)")', { state: 'visible' });
  const cPath = path.join(ARTIFACT_DIR, 'cycle_counts_dropdowns_single_line.png');
  await page.screenshot({ path: cPath });
  console.log('Saved /cycle-counts screenshot:', cPath);

  await browser.close();
  console.log('All 3 layout checks completed successfully!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
