const puppeteer = require("puppeteer");

async function launchBrowser(headless = "new") {
  return puppeteer.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  return page;
}

async function bypassCloudflare(page, log) {
  log("Waiting for page to load (Cloudflare check)...");
  await page
    .waitForFunction(() => !document.title.includes("Just a moment"), {
      timeout: 30000,
    })
    .catch(() => {
      log("Cloudflare challenge may still be active, continuing...");
    });
  await new Promise((r) => setTimeout(r, 3000));
}

module.exports = { launchBrowser, setupPage, bypassCloudflare };
