const { chromium } = require('../frontend/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Capturing Home Page Architecture Visual Representation...');
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

  await page.goto(`http://127.0.0.1:${port}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Step 1 screenshot
  await page.screenshot({ path: `${ARTIFACT_DIR}/home_architecture_step1_sanitization.png` });
  console.log('Saved home_architecture_step1_sanitization.png');

  // Click on Step 2 (Stock Health & Depletion Curves)
  const step2Btn = await page.$('text=Stock Health & Depletion Curves');
  if (step2Btn) {
    await step2Btn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${ARTIFACT_DIR}/home_architecture_step2_depletion.png` });
    console.log('Saved home_architecture_step2_depletion.png');
  }

  // Click on Step 3 (BOM Twin & Build Limits)
  const step3Btn = await page.$('text=BOM Twin & Build Limits');
  if (step3Btn) {
    await step3Btn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${ARTIFACT_DIR}/home_architecture_step3_bom_twin.png` });
    console.log('Saved home_architecture_step3_bom_twin.png');
  }

  // Click on Step 4 (Replenishment & Delay ML)
  const step4Btn = await page.$('text=Replenishment & Delay ML');
  if (step4Btn) {
    await step4Btn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${ARTIFACT_DIR}/home_architecture_step4_replenishment.png` });
    console.log('Saved home_architecture_step4_replenishment.png');
  }

  await browser.close();
}

run().catch(console.error);
