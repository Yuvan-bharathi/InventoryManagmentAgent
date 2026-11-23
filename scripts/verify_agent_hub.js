const { chromium } = require('../frontend/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Exact Agent Hub UI against Mockup...');
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

  // Screenshot of Exact UI
  await page.screenshot({ path: `${ARTIFACT_DIR}/agent_hub_exact_ui_match.png`, fullPage: false });
  console.log('Saved agent_hub_exact_ui_match.png');

  // Click on "View execution trace" to verify modal opens
  const traceBtn = await page.$('button:has-text("View execution trace")');
  if (traceBtn) {
    await traceBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${ARTIFACT_DIR}/agent_hub_trace_modal.png` });
    console.log('Saved agent_hub_trace_modal.png');
  }

  await browser.close();
}

run().catch(console.error);
