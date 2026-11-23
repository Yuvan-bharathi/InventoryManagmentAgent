const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  let token = 'demo';
  try {
    const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'planner', password: 'demo' })
    }).then(r => r.json());
    if (loginRes.token) token = loginRes.token;
  } catch (e) {
    console.log('Login fetch error:', e.message);
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate(tok => {
    localStorage.setItem('inv.token', tok);
    localStorage.removeItem('picktwin.inbound.v3');
    localStorage.removeItem('picktwin.inbound.v4');
  }, token);
  
  await page.goto('http://127.0.0.1:5173/digital-twin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Switch to "Dock view" preset
  const dockBtn = page.locator('button:has-text("Dock view")');
  if (await dockBtn.count() > 0) {
    await dockBtn.click();
    await page.waitForTimeout(1000);
  } else {
    await page.evaluate(() => {
      const store = window.__RETAIL_TWIN_STORE__;
      if (store) store.getState().setCameraPreset?.('dock');
    });
    await page.waitForTimeout(1000);
  }

  // Select Dock 04
  await page.evaluate(() => {
    const store = window.__RETAIL_TWIN_STORE__;
    if (store) {
      const state = store.getState();
      const docks = state.model?.facilities.filter(f => f.kind === 'dock');
      const dock = docks?.[3] || docks?.[0]; // Dock 04
      if (dock) {
        state.setSelection({ kind: 'dock', id: dock.id });
      }
    }
  });
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'digital_twin_dock_view_contained.png'),
    fullPage: false
  });
  console.log('Saved digital_twin_dock_view_contained.png');

  await browser.close();
}

run().catch(console.error);
