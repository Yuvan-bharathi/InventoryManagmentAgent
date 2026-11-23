const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Dynamic Agent Prompts & Scenario Presets...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });

  const port = 5174;

  // 1. Authenticate via API
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'planner', password: 'demo' })
  }).then(r => r.json());

  await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(tok => localStorage.setItem('inv.token', tok), loginRes.token);

  // 2. Open /agent-tester (starts on shortage_forecast)
  console.log('Navigating to /agent-tester ...');
  await page.goto(`http://127.0.0.1:${port}/agent-tester`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify Shortage Forecast prompt
  await page.waitForSelector('text=Specialized Agent Testing Playground');
  await page.waitForSelector('text=30-Day Critical Shortages', { timeout: 15000 });
  await page.waitForSelector('text=Component Stockout Gap');

  const p1 = path.join(ARTIFACT_DIR, 'agent_tester_shortage_adapted.png');
  await page.screenshot({ path: p1 });
  console.log('Saved Shortage Forecast screenshot:', p1);

  // 3. Select AGT-04 Build Capacity & BOM Twin Agent
  console.log('Selecting AGT-04 Build Capacity Agent...');
  const agentSelect = page.locator('.card select').first();
  await agentSelect.selectOption('build_capacity');
  await page.waitForTimeout(1500);

  await page.waitForSelector('text=Gross vs Protected Capacity', { timeout: 15000 });
  await page.waitForSelector('text=Packaging Pack Exploder');
  const p2 = path.join(ARTIFACT_DIR, 'agent_tester_capacity_adapted.png');
  await page.screenshot({ path: p2 });
  console.log('Saved Build Capacity screenshot:', p2);

  // 4. Select AGT-07 Supplier Delay & ML Predictor Agent
  console.log('Selecting AGT-07 Supplier Delay Agent...');
  await agentSelect.selectOption('supplier_delay');
  await page.waitForTimeout(1500);

  await page.waitForSelector('text=7-Day Supplier Disruption', { timeout: 15000 });
  await page.waitForSelector('text=14-Day Logistics Risk');
  const p3 = path.join(ARTIFACT_DIR, 'agent_tester_supplier_delay_adapted.png');
  await page.screenshot({ path: p3 });
  console.log('Saved Supplier Delay screenshot:', p3);

  await browser.close();
  console.log('All dynamic prompt verifications passed successfully!');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
