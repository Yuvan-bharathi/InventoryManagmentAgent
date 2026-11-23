const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Verifying All Proposals and Approved PO view for Priya (Planner)...');
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

  // 2. Open Proposals page
  console.log('Navigating to /proposals...');
  await page.goto('http://127.0.0.1:5173/proposals', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 3. Click "All Proposals" Tab
  console.log('Clicking All Proposals tab...');
  const allTab = await page.$('button[data-testid="tab-all"]');
  if (allTab) {
    await allTab.click();
    await page.waitForTimeout(1000);
  }

  // Type PO-2611-0034 in search
  const searchInput = await page.$('input[placeholder*="Search proposal or material"]');
  if (searchInput) {
    await searchInput.fill('PO-2611-0034');
    await page.waitForTimeout(1000);
  }

  const screenshotAllTab = path.join(ARTIFACT_DIR, 'proposals_all_tab.png');
  await page.screenshot({ path: screenshotAllTab });
  console.log('Saved All Proposals tab screenshot:', screenshotAllTab);

  // 4. Click Approved Tab
  console.log('Clicking Approved tab...');
  if (searchInput) await searchInput.fill('');
  const approvedTab = await page.$('button[data-testid="tab-approved"]');
  if (approvedTab) {
    await approvedTab.click();
    await page.waitForTimeout(1000);
  }

  const screenshotApprovedTab = path.join(ARTIFACT_DIR, 'proposals_approved_tab_planner.png');
  await page.screenshot({ path: screenshotApprovedTab });
  console.log('Saved Approved tab screenshot for Priya:', screenshotApprovedTab);

  // 5. Click the row for PO-2611-0034
  console.log('Drilling into PO-2611-0034 detail page...');
  const poRow = await page.$('tr:has-text("PO-2611-0034")');
  if (poRow) {
    await poRow.click();
    await page.waitForTimeout(1500);

    const screenshotDetail = path.join(ARTIFACT_DIR, 'proposal_detail_approved_banner.png');
    await page.screenshot({ path: screenshotDetail });
    console.log('Saved proposal detail approved screenshot:', screenshotDetail);
  }

  await browser.close();
  console.log('Verification script completed!');
}

run().catch(console.error);

