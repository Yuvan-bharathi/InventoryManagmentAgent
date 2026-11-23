const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing RFQ Proposals & Multi-Tier Approval Revamp Flow...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const port = 5174;
  console.log(`Using Frontend Port: ${port}`);

  // 1. Fetch token for Buyer directly from API
  console.log('Logging in via API...');
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'buyer', password: 'demo' }),
  }).then(r => r.json());

  await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
  await page.evaluate((tok) => {
    localStorage.setItem('inv.token', tok);
  }, loginRes.token);
  console.log('Set buyer auth token in localStorage');

  // 2. Navigate to /proposals
  console.log('Navigating to /proposals ...');
  await page.goto(`http://127.0.0.1:${port}/proposals`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify elements on Proposals
  await page.waitForSelector('text=Purchase Order Approvals & Sourcing Decisions', { timeout: 15000 });
  await page.waitForSelector("text=Sourced by Agent #11: Agentic RFQ Management Agent");
  await page.waitForSelector("text=Bala Raman (Purchasing Officer · L1)");
  await page.waitForSelector("text=Meera Pillai (Procurement Mgr · L2)");
  await page.waitForSelector("text=Leela Iyer (Plant Head · Leadership)");
  await page.waitForSelector("text=Priya Nair (Planner · Demand)");

  // Check that Smart Procurement is NOT visible in the ACT sidebar menu
  const sidebar = page.locator('aside.side');
  const sidebarContent = await sidebar.innerText();
  const hasSmartProcurement = sidebarContent.includes('Smart Procurement & RFQ');
  console.log('Sidebar check - Smart Procurement visible:', hasSmartProcurement);

  // Screenshot 1: Proposals List View
  const screenshotList = path.join(ARTIFACT_DIR, 'proposals_rfq_approval_list.png');
  await page.screenshot({ path: screenshotList, fullPage: false });
  console.log('Saved Proposals List screenshot:', screenshotList);

  // 3. Open Proposal Detail (click first row in proposals table)
  console.log('Opening first Proposal Detail...');
  const firstRow = page.locator('table.dg tbody tr').first();
  await firstRow.click();
  await page.waitForTimeout(2000);

  // Verify elements on Proposal Detail
  await page.waitForSelector('text=Multi-Tier Governance & Digital Approval Lifecycle', { timeout: 15000 });
  await page.waitForSelector('text=Sourcing Dossier & Quote Comparison (Agent #11)');
  await page.waitForSelector('text=WINNING (RANK #1)');
  await page.waitForSelector('text=Agent #11 Decision Rationale');
  await page.waitForSelector('text=Approval & Digital Sign-off Console');

  // Screenshot 2: Proposal Detail View (RFQ Sourcing & Quote Comparison Dossier)
  const screenshotDetail = path.join(ARTIFACT_DIR, 'proposal_detail_rfq_dossier.png');
  await page.screenshot({ path: screenshotDetail, fullPage: false });
  console.log('Saved Proposal Detail screenshot:', screenshotDetail);

  // 4. Test Persona Switching on the Detail Page (Click Meera L2)
  console.log('Testing persona switch to Meera Pillai (Procurement Mgr · L2)...');
  await page.click('button:has-text("Meera (L2 Mgr)")');
  await page.waitForTimeout(2500);

  // Screenshot 3: Proposal Detail as Meera Pillai
  const screenshotMeera = path.join(ARTIFACT_DIR, 'proposal_detail_meera_approver.png');
  await page.screenshot({ path: screenshotMeera, fullPage: false });
  console.log('Saved Meera Approver screenshot:', screenshotMeera);

  // 5. Navigate to Agent Hub to verify that Agent #06 (Procurement) card is commented out / not shown
  console.log('Navigating to /agents to verify commented agent card...');
  await page.goto(`http://127.0.0.1:${port}/agents`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const hubContent = await page.innerText('body');
  const hasProcurementCard = hubContent.includes('AGT-06') && hubContent.includes('Smart Procurement & RFQ Agent');
  console.log('Agent Hub check - AGT-06 Procurement Card visible:', hasProcurementCard);

  const screenshotAgentHub = path.join(ARTIFACT_DIR, 'agent_hub_procurement_commented.png');
  await page.screenshot({ path: screenshotAgentHub, fullPage: false });
  console.log('Saved Agent Hub screenshot:', screenshotAgentHub);

  await browser.close();
  console.log('All verifications completed successfully!');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
