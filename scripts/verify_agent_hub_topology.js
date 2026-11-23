const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Visual Multi-Agent Architecture Topology in /agent-hub ...');
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

  // 2. Open /agent-hub
  console.log('Navigating to /agent-hub ...');
  await page.goto(`http://127.0.0.1:${port}/agent-hub`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify visual topology elements
  await page.waitForSelector('text=Multi-Agent Architecture & Collaborative Pipeline', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('text=AGT-10', { state: 'visible' });
  await page.waitForSelector('text=Inventory Copilot Coordinator (Central Orchestrator)', { state: 'visible' });
  await page.waitForSelector('text=1. Ingest & Audit', { state: 'visible' });
  await page.waitForSelector('text=2. Predict & Plan', { state: 'visible' });
  await page.waitForSelector('text=3. Execute & Govern', { state: 'visible' });
  await page.waitForSelector('text=AGT-01 · STAGE 1', { state: 'visible' });
  await page.waitForSelector('text=AGT-02 · STAGE 2', { state: 'visible' });
  await page.waitForSelector('text=AGT-03 · STAGE 3', { state: 'visible' });
  await page.waitForSelector('text=AGT-04 · STAGE 4', { state: 'visible' });
  await page.waitForSelector('text=AGT-05 · STAGE 5', { state: 'visible' });
  await page.waitForSelector('text=AGT-07 · STAGE 7', { state: 'visible' });
  await page.waitForSelector('text=AGT-08 · STAGE 8', { state: 'visible' });
  await page.waitForSelector('text=AGT-09 · STAGE 9', { state: 'visible' });

  const p1 = path.join(ARTIFACT_DIR, 'agent_hub_visual_topology.png');
  await page.screenshot({ path: p1 });
  console.log('Saved visual topology screenshot:', p1);

  // Test toggling to linear view
  console.log('Testing toggle to Linear Pipeline view...');
  const linearBtn = page.locator('button:has-text("📋 Linear Pipeline (9 Stages)")');
  await linearBtn.click();
  await page.waitForTimeout(1000);

  const p2 = path.join(ARTIFACT_DIR, 'agent_hub_linear_pipeline_toggle.png');
  await page.screenshot({ path: p2 });
  console.log('Saved linear pipeline toggle screenshot:', p2);

  await browser.close();
  console.log('Agent Hub Visual Topology verified successfully!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
