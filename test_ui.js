const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    try {
      await page.goto('http://localhost:3000/dashboard.html');
      await page.evaluate(() => localStorage.setItem('token', 'mock_token'));
      await page.goto('http://localhost:3000/dashboard.html');
      await page.waitForSelector('#nav-documents', {visible: true});
      await page.click('#nav-documents');
      const isDocsActive = await page.evaluate(() => document.getElementById('documents').classList.contains('active'));
      await page.click('#nav-robots');
      const isRobotsActive = await page.evaluate(() => document.getElementById('robots').classList.contains('active'));
      await page.click('#nav-devices');
      const isDevicesActive = await page.evaluate(() => document.getElementById('devices').classList.contains('active'));
      await page.click('#nav-settings');
      const isSettingsActive = await page.evaluate(() => document.getElementById('settings').classList.contains('active'));
      
      console.log('Docs Interactive:', isDocsActive);
      console.log('Robots Interactive:', isRobotsActive);
      console.log('Devices Interactive:', isDevicesActive);
      console.log('Settings Interactive:', isSettingsActive);
    } catch(err) {
      console.log('Error testing UI:', err);
    } finally {
      await browser.close();
    }
})();
