const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const url = process.argv[2];
const outputDir = process.argv[3];

if (!url || !outputDir) {
  console.error("Usage: node scrape.js <url> <output-dir>");
  process.exit(1);
}

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

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1920, height: 1080 });

  // Override webdriver detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for Cloudflare challenge to resolve
  console.log("Waiting for page to load (Cloudflare check)...");
  await page.waitForFunction(
    () => !document.title.includes("Just a moment"),
    { timeout: 30000 }
  ).catch(() => {
    console.log("Cloudflare challenge may still be active, continuing...");
  });

  // Extra wait for dynamic content
  await new Promise((r) => setTimeout(r, 3000));

  console.log("Page title:", await page.title());

  // Extract image URLs from the gallery
  const imageUrls = await page.evaluate(() => {
    const urls = new Set();

    // Method 1: Look for gallery/slider images
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.dataset.src || img.dataset.lazy || img.dataset.original;
      if (src && (src.includes("upload") || src.includes("image") || src.includes("photo") || src.includes("pic"))) {
        urls.add(src);
      }
    });

    // Method 2: Look for background images
    document.querySelectorAll("[style*='background']").forEach((el) => {
      const match = el.style.backgroundImage?.match(/url\(["']?(.+?)["']?\)/);
      if (match && match[1] && (match[1].includes("upload") || match[1].includes("image"))) {
        urls.add(match[1]);
      }
    });

    // Method 3: Look for anchor tags with image links
    document.querySelectorAll("a[href*='upload'], a[href*='image'], a[data-fancybox]").forEach((a) => {
      if (a.href && (a.href.match(/\.(jpg|jpeg|png|webp|gif)/i) || a.href.includes("upload"))) {
        urls.add(a.href);
      }
    });

    // Method 4: Check for any data attributes with image URLs
    document.querySelectorAll("[data-src], [data-image], [data-photo], [data-big], [data-full]").forEach((el) => {
      const src = el.dataset.src || el.dataset.image || el.dataset.photo || el.dataset.big || el.dataset.full;
      if (src) urls.add(src);
    });

    // Method 5: Look for swiper/slick/owl-carousel slides
    document.querySelectorAll(".swiper-slide img, .slick-slide img, .owl-item img, .gallery img, .fotorama img, .fotorama div").forEach((el) => {
      const src = el.src || el.dataset.src || el.dataset.img || el.dataset.full;
      if (src) urls.add(src);
    });

    return [...urls];
  });

  // Also look for image URLs in the page source
  const pageContent = await page.content();
  const srcRegex = /https?:\/\/[^"'\s<>]+?(?:upload|image|photo|pic)[^"'\s<>]*?\.(?:jpg|jpeg|png|webp|gif)/gi;
  const srcMatches = pageContent.match(srcRegex) || [];

  const allUrls = [...new Set([...imageUrls, ...srcMatches])];

  // Filter to get only property photos (usually larger images, not thumbnails)
  // Try to get the highest resolution version
  const cleanUrls = allUrls
    .map((u) => {
      // Try to get full-size version by removing thumbnail suffixes
      return u.replace(/_thumb|_small|_medium|\?w=\d+|\?h=\d+/gi, "");
    })
    .filter((u, i, arr) => arr.indexOf(u) === i);

  console.log(`\nFound ${cleanUrls.length} image URLs:`);
  cleanUrls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

  if (cleanUrls.length === 0) {
    console.log("\nNo images found. Let me dump the page for debugging...");
    // Take screenshot for debugging
    await page.screenshot({ path: "/tmp/101evler_debug.png", fullPage: true });
    console.log("Screenshot saved to /tmp/101evler_debug.png");

    // Save HTML for debugging
    fs.writeFileSync("/tmp/101evler_debug.html", pageContent);
    console.log("HTML saved to /tmp/101evler_debug.html");
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  // Download images
  console.log(`\nDownloading ${cleanUrls.length} images to ${outputDir}...`);
  for (let i = 0; i < cleanUrls.length; i++) {
    const imageUrl = cleanUrls[i];
    const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
    const filename = `photo_${String(i + 1).padStart(2, "0")}${ext}`;
    const dest = path.join(outputDir, filename);

    try {
      await downloadFile(imageUrl, dest);
      const stats = fs.statSync(dest);
      console.log(`  Downloaded: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`  Failed: ${filename} - ${err.message}`);
    }
  }

  console.log("\nDone!");
  await browser.close();
})();
