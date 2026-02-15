const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

function downloadFile(fileUrl, dest) {
  return new Promise((resolve, reject) => {
    const protocol = fileUrl.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    protocol
      .get(fileUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function scrapePhotos(url, outputDir, onProgress) {
  const log = onProgress || console.log;

  log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    log("Waiting for page to load (Cloudflare check)...");
    await page.waitForFunction(
      () => !document.title.includes("Just a moment"),
      { timeout: 30000 }
    ).catch(() => {
      log("Cloudflare challenge may still be active, continuing...");
    });

    await new Promise((r) => setTimeout(r, 3000));

    const title = await page.title();
    log(`Page title: ${title}`);

    // Activate the #st gallery tab
    log("Opening gallery tab (#st)...");
    await page.evaluate(() => {
      window.location.hash = "st";
    });
    await new Promise((r) => setTimeout(r, 1500));

    // Collect image URLs from the #st gallery grid (fancybox links)
    const cleanUrls = await page.evaluate(() => {
      const container = document.querySelector(".gallery-tab-content#st, .w-tab-pane.gallery-tab-content");
      if (!container) return [];

      const urls = [];
      // Fancybox links have href pointing to property_wm images
      container.querySelectorAll('a.fancybox-link[data-fancybox]').forEach((a) => {
        if (a.href) urls.push(a.href);
      });

      // Fallback: if no fancybox links, grab img src from the grid
      if (urls.length === 0) {
        container.querySelectorAll("img").forEach((img) => {
          const src = img.src || img.dataset.src;
          if (src && src.includes("101evler")) urls.push(src);
        });
      }

      return [...new Set(urls)];
    });

    // Replace property_wm with property_thumb for non-watermarked images
    const finalUrls = cleanUrls.map((u) =>
      u.replace("/property_wm/", "/property_thumb/")
    );

    log(`Found ${finalUrls.length} gallery images`);

    if (finalUrls.length === 0) {
      log("No images found in #st gallery.");
      await browser.close();
      return { total: 0, downloaded: 0 };
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log(`Created directory: ${outputDir}`);
    }

    log(`Downloading ${finalUrls.length} images to ${outputDir}...`);
    let downloaded = 0;

    for (let i = 0; i < finalUrls.length; i++) {
      const imageUrl = finalUrls[i];
      const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
      const filename = `photo_${String(i + 1).padStart(2, "0")}${ext}`;
      const dest = path.join(outputDir, filename);

      try {
        await downloadFile(imageUrl, dest);
        const stats = fs.statSync(dest);
        log(`Downloaded: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        downloaded++;
      } catch (err) {
        log(`Failed: ${filename} - ${err.message}`);
      }
    }

    log("Done!");
    return { total: finalUrls.length, downloaded };
  } finally {
    await browser.close();
  }
}

// CLI usage
if (require.main === module) {
  const url = process.argv[2];
  const outputDir = process.argv[3];

  if (!url || !outputDir) {
    console.error("Usage: node scrape.js <url> <output-dir>");
    process.exit(1);
  }

  scrapePhotos(url, outputDir).catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}

module.exports = { scrapePhotos };
