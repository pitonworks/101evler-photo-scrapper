const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { launchBrowser, setupPage, bypassCloudflare } = require("./browser");

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

// Category code mapping based on URL keywords
const CATEGORY_MAP = {
  "kiralik-daire": 912,
  "kiralik-villa": 915,
  "kiralik-penthouse": 19100,
  "kiralik-mustakil-ev": 914,
  "kiralik-dukkan": 970,
  "kiralik-isyeri": 970,
  "satilik-daire": 901,
  "satilik-studio": 902,
  "satilik-mustakil-ev": 903,
  "satilik-villa": 904,
  "satilik-ikiz-villa": 19633,
  "satilik-penthouse": 18260,
  "satilik-arsa": 101,
  "satilik-tarla": 101,
  "satilik-isyeri": 970,
  "satilik-dukkan": 970,
};

// gelgezgor.com il kodları
const CITY_MAP = {
  lefkosa: 82, lefkoşa: 82,
  gazimagusa: 83, gazimağusa: 83,
  guzelyurt: 84, güzelyurt: 84,
  lefke: 85,
  girne: 86,
  iskele: 88, İskele: 88,
};

function normalizeTurkish(str) {
  return str
    .replace(/İ/g, "I")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function detectCategoryCode(url, details) {
  const urlLower = normalizeTurkish(url);

  // Direct match first (e.g. URL contains "satilik-villa")
  for (const [keyword, code] of Object.entries(CATEGORY_MAP)) {
    if (urlLower.includes(keyword)) return code;
  }

  // Detect sale type from URL
  const isSale = urlLower.includes("satilik");

  // Detect property type from URL slug or details (check multiple fields)
  // Replace hyphens with spaces so "ikiz-villa" matches "ikiz villa"
  const emlakTipi = details ? normalizeTurkish(
    (details["Emlak Tipi"] || "") + " " +
    (details["Emlak Türü"] || "") + " " +
    (details["Durumu"] || "")
  ) : "";
  const combined = urlLower.replace(/-/g, " ") + " " + emlakTipi;

  const typeMap = isSale
    ? { villa: 904, "ikiz villa": 19633, penthouse: 18260, studio: 902, "mustakil ev": 903, arsa: 101, tarla: 101, isyeri: 970, dukkan: 970, daire: 901 }
    : { villa: 915, penthouse: 19100, "mustakil ev": 914, isyeri: 970, dukkan: 970, daire: 912 };

  for (const [type, code] of Object.entries(typeMap)) {
    if (combined.includes(type)) return code;
  }

  return isSale ? 901 : 912;
}

function detectCity(locationText) {
  const normalized = normalizeTurkish(locationText);
  for (const [key, id] of Object.entries(CITY_MAP)) {
    if (normalized.includes(normalizeTurkish(key))) return { id, name: key };
  }
  return null;
}

/**
 * Scrape full listing metadata + photos from 101evler.com
 * @param {string} url - 101evler listing URL
 * @param {string} tmpDir - Directory for downloaded photos
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{metadata: object, photos: {total: number, downloaded: number, files: string[]}}>}
 */
async function scrapeListing(url, tmpDir, onProgress) {
  const log = onProgress || console.log;

  log("Launching browser...");
  const browser = await launchBrowser();

  try {
    const page = await setupPage(browser);

    log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await bypassCloudflare(page, log);

    const title = await page.title();
    log(`Page title: ${title}`);

    // Extract metadata from the listing page
    log("Extracting listing metadata...");
    const metadata = await page.evaluate(() => {
      const getText = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent.trim() : "";
      };

      // Title (h1)
      const baslik = getText("h1") || document.title;

      // Price from h3.ilanDetayFontPrice (e.g. "£200,000")
      let fiyat = "";
      let paraBirimi = "";
      const priceEl = document.querySelector("h3.ilanDetayFontPrice");
      if (priceEl) {
        const priceText = priceEl.textContent.trim();
        const numMatch = priceText.replace(/[^\d]/g, "");
        fiyat = numMatch;
        if (priceText.includes("£")) paraBirimi = "GBP";
        else if (priceText.includes("$")) paraBirimi = "USD";
        else if (priceText.includes("€")) paraBirimi = "EUR";
        else if (priceText.includes("₺")) paraBirimi = "TL";
        else paraBirimi = "GBP";
      }

      // Description - try multiple selectors
      // 101evler uses .f-s-16 inside .div-block-361 for description
      let aciklama = "";
      let descriptionText = "";
      const descSelectors = [
        ".div-block-361 .f-s-16",
        ".f-s-16",
        ".w-richtext",
        "[class*='ilan-aciklama']",
        ".col-10",
      ];
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 20) {
          aciklama = el.innerHTML.trim();
          descriptionText = el.textContent.trim();
          break;
        }
      }

      // Detail rows from .text-block-141 and .ilandetaycomponent (label + value pairs)
      const details = {};
      document.querySelectorAll(".text-block-141, .ilandetaycomponent").forEach((el) => {
        const parts = el.textContent.trim().split("\n").map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          details[parts[0]] = parts[1];
        }
      });

      // Quick stats from .div-block-358 (Emlak Tipi, Oda Sayısı, Banyo, Alan Ölçüsü)
      document.querySelectorAll(".div-block-358").forEach((el) => {
        const parts = el.textContent.trim().split("\n").map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2 && !details[parts[0]]) {
          details[parts[0]] = parts[1];
        }
      });

      // Location from .locationpremiumdivcopy
      const location = getText(".locationpremiumdivcopy") || getText("[class*='location']");

      // Subtitle h2 (e.g. "Satılık Villa - Karşıyaka, Girne, Kuzey Kıbrıs")
      const subtitle = getText("h2.text-block-139") || getText("h2");

      return { baslik, fiyat, paraBirimi, aciklama, descriptionText, details, location, subtitle };
    });

    // Detect category from URL + details
    metadata.katCode = detectCategoryCode(url, metadata.details);
    metadata.saleType = url.toLowerCase().includes("satilik") ? "satilik" : "kiralik";

    // Detect city from location/subtitle
    const locationStr = metadata.location + " " + (metadata.subtitle || "");
    const cityInfo = detectCity(locationStr);
    if (cityInfo) {
      metadata.cityId = cityInfo.id;
      metadata.cityName = cityInfo.name;
    }

    // Extract district (ilçe) from location or URL
    if (metadata.location && metadata.location.includes("/")) {
      metadata.district = metadata.location.split("/")[0].trim();
    }
    // Fallback: parse district from URL slug (e.g. /satilik-villa/karsiyaka-girne/)
    if (!metadata.district) {
      const urlPath = new URL(url).pathname;
      const slugParts = urlPath.split("/").filter(Boolean);
      // Second slug is usually "district-city" (e.g. "karsiyaka-girne")
      if (slugParts.length >= 2) {
        const locationSlug = slugParts[1]; // e.g. "karsiyaka-girne"
        // Remove city name from the end to get district
        const cityNames = ["girne", "lefkosa", "lefkoşa", "gazimagusa", "gazimağusa",
          "guzelyurt", "güzelyurt", "iskele", "lefke"];
        let districtSlug = locationSlug;
        for (const city of cityNames) {
          const suffix = "-" + normalizeTurkish(city);
          if (normalizeTurkish(districtSlug).endsWith(suffix)) {
            districtSlug = districtSlug.substring(0, districtSlug.length - suffix.length);
            break;
          }
        }
        // Convert slug to title case (e.g. "karsiyaka" → "Karsiyaka")
        if (districtSlug && districtSlug !== locationSlug.split("-")[0]) {
          metadata.district = districtSlug
            .split("-")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        } else if (districtSlug) {
          metadata.district = districtSlug.charAt(0).toUpperCase() + districtSlug.slice(1);
        }
      }
    }

    log(`Metadata: ${metadata.baslik} | ${metadata.fiyat} ${metadata.paraBirimi}`);
    log(`Category code: ${metadata.katCode}, City: ${metadata.cityName || "unknown"}`);
    log(`Details: ${JSON.stringify(metadata.details)}`);

    // Now scrape photos using existing #st gallery logic
    log("Opening gallery tab (#st)...");
    await page.evaluate(() => {
      window.location.hash = "st";
    });
    await new Promise((r) => setTimeout(r, 1500));

    const cleanUrls = await page.evaluate(() => {
      const container = document.querySelector(".gallery-tab-content#st, .w-tab-pane.gallery-tab-content");
      if (!container) return [];

      const urls = [];
      container.querySelectorAll('a.fancybox-link[data-fancybox]').forEach((a) => {
        if (a.href) urls.push(a.href);
      });

      if (urls.length === 0) {
        container.querySelectorAll("img").forEach((img) => {
          const src = img.src || img.dataset.src;
          if (src && src.includes("101evler")) urls.push(src);
        });
      }

      return [...new Set(urls)];
    });

    const finalUrls = cleanUrls.map((u) => u.replace("/property_wm/", "/property_thumb/"));
    log(`Found ${finalUrls.length} gallery images`);

    // Download photos
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const files = [];
    let downloaded = 0;

    for (let i = 0; i < finalUrls.length; i++) {
      const imageUrl = finalUrls[i];
      const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
      const filename = `photo_${String(i + 1).padStart(2, "0")}${ext}`;
      const dest = path.join(tmpDir, filename);

      try {
        await downloadFile(imageUrl, dest);
        const stats = fs.statSync(dest);
        log(`Downloaded: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        files.push(dest);
        downloaded++;
      } catch (err) {
        log(`Failed: ${filename} - ${err.message}`);
      }
    }

    log(`Photos: ${downloaded}/${finalUrls.length} downloaded`);

    return {
      metadata,
      photos: { total: finalUrls.length, downloaded, files },
    };
  } finally {
    await browser.close();
  }
}

async function scrapePhotos(url, outputDir, onProgress) {
  const log = onProgress || console.log;

  log("Launching browser...");
  const browser = await launchBrowser();

  try {
    const page = await setupPage(browser);

    log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await bypassCloudflare(page, log);

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
      container.querySelectorAll('a.fancybox-link[data-fancybox]').forEach((a) => {
        if (a.href) urls.push(a.href);
      });

      if (urls.length === 0) {
        container.querySelectorAll("img").forEach((img) => {
          const src = img.src || img.dataset.src;
          if (src && src.includes("101evler")) urls.push(src);
        });
      }

      return [...new Set(urls)];
    });

    // Replace property_wm with property_thumb for non-watermarked images
    const finalUrls = cleanUrls.map((u) => u.replace("/property_wm/", "/property_thumb/"));
    log(`Found ${finalUrls.length} gallery images`);

    if (finalUrls.length === 0) {
      log("No images found in #st gallery.");
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

module.exports = { scrapePhotos, scrapeListing, downloadFile };
