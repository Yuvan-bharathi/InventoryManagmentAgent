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

  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.evaluate(tok => {
    localStorage.setItem('inv.token', tok);
  }, token);
  
  await page.goto('http://127.0.0.1:5173/digital-twin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Scroll 3D canvas into view
  const canvasContainer = page.locator('.retail-twin-scope');
  await canvasContainer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // 1. Ensure left panel is open
  await page.evaluate(() => {
    const store = window.__RETAIL_TWIN_STORE__;
    if (store) {
      if (!store.getState().leftOpen) store.getState().toggle('leftOpen');
      store.getState().setSection('locator');
    }
  });
  await page.waitForTimeout(1000);

  // Screenshot 1: Locator Panel default view with materials list & AGT-09 header
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'digital_twin_locator_tab.png'), fullPage: false });
  console.log('Saved digital_twin_locator_tab.png');

  // 2. Click "Spotlight Dead Stock in 3D"
  await page.evaluate(() => {
    const store = window.__RETAIL_TWIN_STORE__;
    if (store && !store.getState().deadStockHighlight) {
      store.getState().toggleDeadStockHighlight();
    }
  });
  await page.waitForTimeout(1200);

  // Screenshot 2: Dead stock spotlight active in 3D and panel
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'digital_twin_dead_stock_spotlight.png'), fullPage: false });
  console.log('Saved digital_twin_dead_stock_spotlight.png');

  // 3. Locate MAT-PCB-004 in 3D
  await page.evaluate(() => {
    const store = window.__RETAIL_TWIN_STORE__;
    if (store) {
      store.getState().locateMaterial('MAT-PCB-004');
    }
  });
  await page.waitForTimeout(1500);

  // Screenshot 3: Component located with 3D Inspector card showing "Issue / Take Material" button
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'digital_twin_component_located.png'), fullPage: false });
  console.log('Saved digital_twin_component_located.png');

  // 4. Open Material Issue Modal
  await page.evaluate(() => {
    const store = window.__RETAIL_TWIN_STORE__;
    if (store) {
      const selection = store.getState().selection;
      if (selection && selection.kind === 'bin') {
        store.getState().openIssueModal(selection.id);
      }
    }
  });
  await page.waitForTimeout(1000);

  // Screenshot 4: Material Requisition & Goods Issue Modal fully visible
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'digital_twin_material_issue_modal.png'), fullPage: false });
  console.log('Saved digital_twin_material_issue_modal.png');

  // 5. Confirm Goods Issue
  const confirmBtn = page.locator('button:has-text("Confirm Goods Issue")');
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click();
    await page.waitForTimeout(1500);
  }

  // Screenshot 5: Goods Issue Confirmed with updated stock and success toast
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'digital_twin_goods_issue_confirmed.png'), fullPage: false });
  console.log('Saved digital_twin_goods_issue_confirmed.png');

  await browser.close();
}

run().catch(e => {
  console.error('Error running verification:', e);
  process.exit(1);
});
