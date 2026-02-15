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

    const imageUrls = await page.evaluate(() => {
      const urls = new Set();

      document.querySelectorAll("img").forEach((img) => {
        const src = img.src || img.dataset.src || img.dataset.lazy || img.dataset.original;
        if (src && (src.includes("upload") || src.includes("image") || src.includes("photo") || src.includes("pic"))) {
          urls.add(src);
        }
      });

      document.querySelectorAll("[style*='background']").forEach((el) => {
        const match = el.style.backgroundImage?.match(/url\(["']?(.+?)["']?\)/);
        if (match && match[1] && (match[1].includes("upload") || match[1].includes("image"))) {
          urls.add(match[1]);
        }
      });

      document.querySelectorAll("a[href*='upload'], a[href*='image'], a[data-fancybox]").forEach((a) => {
        if (a.href && (a.href.match(/\.(jpg|jpeg|png|webp|gif)/i) || a.href.includes("upload"))) {
          urls.add(a.href);
        }
      });

      document.querySelectorAll("[data-src], [data-image], [data-photo], [data-big], [data-full]").forEach((el) => {
        const src = el.dataset.src || el.dataset.image || el.dataset.photo || el.dataset.big || el.dataset.full;
        if (src) urls.add(src);
      });

      document.querySelectorAll(".swiper-slide img, .slick-slide img, .owl-item img, .gallery img, .fotorama img, .fotorama div").forEach((el) => {
        const src = el.src || el.dataset.src || el.dataset.img || el.dataset.full;
        if (src) urls.add(src);
      });

      return [...urls];
    });

    const pageContent = await page.content();
    const srcRegex = /https?:\/\/[^"'\s<>]+?(?:upload|image|photo|pic)[^"'\s<>]*?\.(?:jpg|jpeg|png|webp|gif)/gi;
    const srcMatches = pageContent.match(srcRegex) || [];

    const allUrls = [...new Set([...imageUrls, ...srcMatches])];

    const cleanUrls = allUrls
      .map((u) => {
        return u.replace(/_thumb|_small|_medium|\?w=\d+|\?h=\d+/gi, "");
      })
      .filter((u, i, arr) => arr.indexOf(u) === i);

    log(`Found ${cleanUrls.length} image URLs`);

    if (cleanUrls.length === 0) {
      log("No images found.");
      await browser.close();
      return { total: 0, downloaded: 0 };
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log(`Created directory: ${outputDir}`);
    }

    log(`Downloading ${cleanUrls.length} images to ${outputDir}...`);
    let downloaded = 0;

    for (let i = 0; i < cleanUrls.length; i++) {
      const imageUrl = cleanUrls[i];
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
    return { total: cleanUrls.length, downloaded };
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
