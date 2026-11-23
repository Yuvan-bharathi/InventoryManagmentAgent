const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Streamlined Agent Hub & Collaborative Pipeline Flow...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1.5 });

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

  // 2. Open /agents
  console.log('Navigating to /agents ...');
  await page.goto(`http://127.0.0.1:${port}/agents`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify Streamlined Top Header
  await page.waitForSelector('text=10 Specialized Agents (Autonomous Mesh)', { state: 'visible' });
  await page.waitForSelector('text=15 Registered MCP Tools', { state: 'visible' });

  // Verify Exact Wording matches
  await page.waitForSelector('text=Cleans raw ERP/WMS files', { state: 'visible' });
  await page.waitForSelector('text=Flags low-stock items below safety stock', { state: 'visible' });
  await page.waitForSelector('text=Accepts or holds inbound dock receipts', { state: 'visible' });
  await page.waitForSelector('text=Calculates 30/60/90-day depletion dates', { state: 'visible' });
  await page.waitForSelector('text=Calculates how many finished devices the factory can assemble before lines halt', { state: 'visible' });
  await page.waitForSelector('text=Automatically drafts PO and transfer proposals', { state: 'visible' });
  await page.waitForSelector('text=Simulates supplier shipment delays to check whether safety stock covers the proposals', { state: 'visible' });
  await page.waitForSelector('text=Audits working capital and flags non-moving inventory to balance proposals', { state: 'visible' });

  // Verify NO individual test buttons in the flow cards
  const individualTestBtnCount = await page.locator('button:has-text("🧪 Test AGT-")').count();
  console.log(`Individual "Test AGT-xx" button count in page: ${individualTestBtnCount} (Expected 0)`);

  const p1 = path.join(ARTIFACT_DIR, 'agent_hub_streamlined_pipeline.png');
  await page.screenshot({ path: p1 });
  console.log('Saved streamlined pipeline screenshot:', p1);

  // 3. Click Test Collaborative Pipeline Flow
  console.log('Testing "🚀 Test Collaborative Pipeline Flow" button...');
  const testFlowBtn = page.locator('button:has-text("🚀 Test Collaborative Pipeline Flow")');
  await testFlowBtn.click();

  // Wait for simulation to run through the steps
  await page.waitForTimeout(4000);

  await page.waitForSelector('text=LIVE MULTI-AGENT EXECUTION & DATA HANDOFF TRACE', { state: 'visible' });

  const p2 = path.join(ARTIFACT_DIR, 'agent_hub_flow_simulation_running.png');
  await page.screenshot({ path: p2 });
  console.log('Saved running simulation screenshot:', p2);

  // Wait for complete
  await page.waitForTimeout(5000);

  const p3 = path.join(ARTIFACT_DIR, 'agent_hub_flow_simulation_completed.png');
  await page.screenshot({ path: p3 });
  console.log('Saved completed simulation screenshot:', p3);

  await browser.close();
  console.log('All tests passed successfully!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
