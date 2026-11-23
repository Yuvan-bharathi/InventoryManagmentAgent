const { chromium } = require('../frontend/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing Collaborative Pipeline Run simulation...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1.5 });

  const port = 5173;

  // 1. Authenticate via API
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'planner', password: 'demo' })
  }).then(r => r.json());

  await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(tok => localStorage.setItem('inv.token', tok), loginRes.token);

  await page.goto(`http://127.0.0.1:${port}/agents`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click Run Collaborative Pipeline
  const runBtn = await page.$('button:has-text("Run collaborative pipeline")');
  if (runBtn) {
    await runBtn.click();
    console.log('Clicked Run collaborative pipeline');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/agent_hub_pipeline_active_run.png` });
    console.log('Saved agent_hub_pipeline_active_run.png');

    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${ARTIFACT_DIR}/agent_hub_pipeline_completed_run.png` });
    console.log('Saved agent_hub_pipeline_completed_run.png');
  }

  await browser.close();
}

run().catch(console.error);
