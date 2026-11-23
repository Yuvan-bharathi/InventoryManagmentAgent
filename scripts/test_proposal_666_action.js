const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  // 1. Login as Buyer
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Sign in as buyer")');
  await page.waitForTimeout(1500);

  // 2. Open /proposals/666
  await page.goto('http://127.0.0.1:5173/proposals/666', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 3. Click Submit for approval
  const submitBtn = await page.$('button[data-testid="act-submit"], button:has-text("Submit for approval")');
  if (submitBtn) {
    console.log('Submitting proposal 666 for approval...');
    await submitBtn.click();
    await page.waitForTimeout(1500);
    const screenshotSubmitted = path.join(ARTIFACT_DIR, 'proposal_666_submitted.png');
    await page.screenshot({ path: screenshotSubmitted });
    console.log('Saved submitted screenshot:', screenshotSubmitted);

    // 4. Click Approve
    const approveBtn = await page.$('button[data-testid="act-approve"], button:has-text("Approve")');
    if (approveBtn) {
      console.log('Approving proposal 666...');
      await approveBtn.click();
      await page.waitForTimeout(1500);
      const screenshotApproved = path.join(ARTIFACT_DIR, 'proposal_666_approved.png');
      await page.screenshot({ path: screenshotApproved });
      console.log('Saved approved screenshot:', screenshotApproved);
    }
  }

  await browser.close();
  console.log('Done!');
}

run().catch(console.error);

