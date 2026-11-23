const { chromium } = require('../frontend/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Capturing Enhanced Home Page...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });

  const port = 5173;

  // 1. Authenticate via API
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'planner', password: 'demo' })
  }).then(r => r.json());

  await page.goto(`http://127.0.0.1:${port}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(tok => localStorage.setItem('inv.token', tok), loginRes.token);

  // 2. Open /home
  console.log('Navigating to /home ...');
  await page.goto(`http://127.0.0.1:${port}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot of Top Half
  await page.screenshot({ path: `${ARTIFACT_DIR}/home_page_enhanced.png`, fullPage: false });
  console.log('Saved home_page_enhanced.png');

  // Full page screenshot
  await page.screenshot({ path: `${ARTIFACT_DIR}/home_page_enhanced_full.png`, fullPage: true });
  console.log('Saved home_page_enhanced_full.png');

  await browser.close();
}

run().catch(console.error);
