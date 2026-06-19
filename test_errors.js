const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({headless: "new"});
        const page = await browser.newPage();
        
        const errors = [];
        page.on('pageerror', error => { errors.push("PAGE ERROR: " + error.message) });
        page.on('console', msg => { 
            if (msg.type() === 'error') errors.push("CONSOLE ERROR: " + msg.text()); 
        });
        
        console.log("Navigating to http://localhost:5173 ...");
        await page.goto('http://localhost:5173/login', {waitUntil: 'networkidle2', timeout: 30000});
        
        await page.screenshot({path: 'debug_screenshot.png'});
        console.log("=== ERRORS DETECTED ===");
        console.log(JSON.stringify(errors, null, 2));
        
        await browser.close();
    } catch (e) {
        console.error("Script failed:", e.message);
    }
})();
