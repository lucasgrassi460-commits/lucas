const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    try {
      await page.goto('http://localhost:3000');
      
      // Test Unauthenticated Click
      await page.waitForSelector('.require-auth-btn');
      await page.click('.require-auth-btn');
      
      const isModalVisible = await page.evaluate(() => {
          const modal = document.getElementById('auth-modal');
          return modal && !modal.classList.contains('hidden');
      });
      
      console.log('Unauth click opens modal:', isModalVisible);
      
      // Mock Auth
      await page.evaluate(() => localStorage.setItem('token', 'mock_token'));
      // Reload to trigger checkAuth() with token
      await page.goto('http://localhost:3000');
      
      // Since it's an a href='/dashboard.html' after login, clicking it should navigate
      const navPromise = page.waitForNavigation();
      await page.click('.require-auth-btn');
      await navPromise;
      
      console.log('Auth click navigated to:', page.url());
      
    } catch(err) {
      console.log('Error testing auth flow:', err);
    } finally {
      await browser.close();
    }
})();
