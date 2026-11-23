const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Global We Connect/.gemini/antigravity/brain/e2e5a0a5-692f-4b81-9b06-ec7682d4c15c';

async function run() {
  console.log('Testing System Connectors & Connection String Configuration Flow...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Authenticate via login page UI
  console.log('Navigating to login page...');
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'networkidle' });
  await page.selectOption('select', 'planner');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('Signed in. Current URL:', page.url());

  // 2. Navigate to /connectors
  console.log('Navigating to /connectors ...');
  await page.goto('http://127.0.0.1:5173/connectors', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify elements on Connectors Grid
  await page.waitForSelector('text=Connected Databases & System Sources', { timeout: 15000 });
  await page.waitForSelector('text=ENTERPRISE INTEGRATION HUB');
  await page.waitForSelector('text=PostgreSQL / Neon Cloud Store');
  await page.waitForSelector('text=SAP S/4HANA (Enterprise ERP)');
  await page.waitForSelector('text=Siemens Opcenter MES');
  await page.waitForSelector('text=Add Another Connector');
  console.log('Connectors Grid view successfully loaded!');

  // Test Ping on PostgreSQL card
  const testPingBtn = page.locator('.card:has-text("PostgreSQL / Neon Cloud Store") button:has-text("Test Ping")');
  await testPingBtn.click();
  await page.waitForTimeout(1500);

  // Screenshot 1: Connectors Grid View (Matching Screenshots 1 & 2)
  const screenshotGrid = path.join(ARTIFACT_DIR, 'connectors_grid_view.png');
  await page.screenshot({ path: screenshotGrid, fullPage: false });
  console.log('Saved Connectors Grid screenshot:', screenshotGrid);

  // 3. Click "+ Add Connector" to open Selector Connector & Connection String Form
  console.log('Clicking "+ Add Connector" to open Selector Connector Form...');
  await page.click('button:has-text("+ Add Connector")');
  await page.waitForTimeout(2000);

  // Verify Form View (Matching Screenshot 3)
  await page.waitForSelector('text=System Connectors & Data Sync', { timeout: 15000 });
  await page.waitForSelector('text=1. Select Connector');
  await page.waitForSelector('text=Source Connector Type *');
  await page.waitForSelector('text=Connection String URI');
  await page.waitForSelector('text=Seed Manufacturing Datasets');
  await page.waitForSelector('text=Synchronize Current System');
  console.log('Selector Connector Form view successfully verified!');

  // Select PostgreSQL from dropdown
  const selectConnectorType = page.locator('.card:has-text("1. Select Connector") select').first();
  await selectConnectorType.selectOption('postgresql-neon');
  await page.waitForTimeout(1000);

  // Click Test Connection
  console.log('Clicking "⚡ Test Connection"...');
  await page.click('button:has-text("Test Connection")');
  await page.waitForTimeout(2000);

  // Verify test success banner
  await page.waitForSelector('text=Successfully connected to POSTGRESQL database', { timeout: 10000 });
  console.log('Verified database connection test response!');

  // Screenshot 2: Selector Connector & Connection String Form View (Matching Screenshot 3)
  const screenshotForm = path.join(ARTIFACT_DIR, 'connectors_form_view.png');
  await page.screenshot({ path: screenshotForm, fullPage: false });
  console.log('Saved Connectors Form screenshot:', screenshotForm);

  // 4. Test clicking Configure on a specific card
  console.log('Clicking "← Back to Connectors"...');
  await page.click('button:has-text("← Back to Connectors")');
  await page.waitForTimeout(1500);

  console.log('Clicking "Configure" on SAP S/4HANA card...');
  const cfgSapBtn = page.locator('.card:has-text("SAP S/4HANA") button:has-text("Configure")');
  await cfgSapBtn.click();
  await page.waitForTimeout(1500);

  // Verify it populated SAP S/4HANA
  await page.waitForSelector('text=SAP S/4HANA (Enterprise ERP)');
  const screenshotSap = path.join(ARTIFACT_DIR, 'connectors_configure_sap.png');
  await page.screenshot({ path: screenshotSap, fullPage: false });
  console.log('Saved SAP S/4HANA Configure screenshot:', screenshotSap);

  await browser.close();
  console.log('All Connectors validations passed with 100% success!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});

