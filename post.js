const { launchBrowser, setupPage } = require("./browser");
const { getProfile, mapMetadataToForm, deriveFields } = require("./form-profiles");
const { enrichMetadata } = require("./description-parser");

function normalizeTurkish(str) {
  return str
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/İ/g, "i");
}

/**
 * Find the best matching option in a <select> by fuzzy Turkish text matching
 */
function fuzzyMatchOption(options, target) {
  const normalizedTarget = normalizeTurkish(target);
  // Exact match first
  for (const opt of options) {
    if (normalizeTurkish(opt.text) === normalizedTarget) return opt.value;
  }
  // Contains match
  for (const opt of options) {
    if (normalizeTurkish(opt.text).includes(normalizedTarget)) return opt.value;
    if (normalizedTarget.includes(normalizeTurkish(opt.text))) return opt.value;
  }
  return null;
}

/**
 * Phase A: Login to gelgezgor.com and discover form fields
 */
async function discoverForm(email, password, katCode, onProgress) {
  const log = onProgress || console.log;

  log("Phase A: Login & form discovery");
  log("Launching browser...");
  const browser = await launchBrowser();

  try {
    const page = await setupPage(browser);

    // Login
    log("Navigating to login page...");
    await page.goto("https://www.gelgezgor.com/sayfa/giris-yap", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await page.waitForSelector('input[name="email_adresi"]', { timeout: 10000 });
    await page.type('input[name="email_adresi"]', email, { delay: 50 });
    await page.type('input[name="parola"]', password, { delay: 50 });

    log("Submitting login...");
    await Promise.all([
      page.click('button[name="buton"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
    ]);

    // Check login success
    const currentUrl = page.url();
    const pageContent = await page.content();
    if (
      currentUrl.includes("giris-yap") &&
      (pageContent.includes("hatalı") || pageContent.includes("yanlış"))
    ) {
      throw new Error("Login failed - check email/password");
    }
    log("Login successful!");

    // Navigate to ilan-ekle form
    const formUrl = `https://www.gelgezgor.com/sayfa/ilan-ekle?kat=${katCode}`;
    log(`Navigating to form: ${formUrl}`);
    await page.goto(formUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Discover all form fields
    log("Discovering form fields...");
    const fields = await page.evaluate(() => {
      const result = [];

      // All input fields
      document.querySelectorAll("input, select, textarea").forEach((el) => {
        const field = {
          tag: el.tagName.toLowerCase(),
          type: el.type || "",
          name: el.name || "",
          id: el.id || "",
          placeholder: el.placeholder || "",
          required: el.required || false,
          className: el.className || "",
        };

        // Find label text
        const label = el.closest("label") || document.querySelector(`label[for="${el.id}"]`);
        if (label) field.label = label.textContent.trim();

        if (el.tagName === "SELECT") {
          field.options = [];
          el.querySelectorAll("option").forEach((opt) => {
            field.options.push({ value: opt.value, text: opt.textContent.trim() });
          });
        }

        if (field.name || field.id) {
          result.push(field);
        }
      });

      return result;
    });

    log(`Discovered ${fields.length} form fields:`);
    for (const f of fields) {
      const info = `  ${f.tag}[name="${f.name}"] type=${f.type}${f.required ? " REQUIRED" : ""}${f.options ? ` (${f.options.length} options)` : ""}${f.label ? ` label="${f.label}"` : ""}`;
      log(info);
    }

    return { fields, browser, page };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Phase B: Fill form fields using profile-based mapping and submit.
 * Supports dryRun mode: fills form but doesn't submit, returns mapped values.
 */
async function postListing(email, password, metadata, photoFiles, onProgress, options = {}) {
  const log = onProgress || console.log;
  const { dryRun = false } = options;

  log(`Phase B: ${dryRun ? "DRY RUN - " : ""}Posting listing to gelgezgor.com`);

  // Step 1: Enrich metadata from description text
  log("Enriching metadata from description...");
  enrichMetadata(metadata);

  // Step 2: Get profile for this property type
  const profile = getProfile(metadata.katCode);
  log(`Property profile: ${profile.label} (type: ${profile.type})`);

  // Step 3: Derive smart defaults (asansör, ısıtma, kullanım durumu, etc.)
  deriveFields(metadata);

  // Step 4: Map metadata to form values
  const { values, warnings } = mapMetadataToForm(profile, metadata);

  log(`Mapped ${Object.keys(values).length} form values:`);
  for (const [key, entry] of Object.entries(values)) {
    const displayValue = key === "aciklama"
      ? entry.value.substring(0, 60) + "..."
      : entry.value;
    log(`  ${key} = ${displayValue}${entry.required ? " *" : ""}`);
  }

  if (warnings.length > 0) {
    log("Warnings:");
    for (const w of warnings) {
      log(`  ! ${w}`);
    }
  }

  // Step 5: Login + discover form
  const { fields, browser, page } = await discoverForm(
    email,
    password,
    metadata.katCode,
    log
  );

  try {
    // Build name->field map
    const fieldMap = {};
    for (const f of fields) {
      if (f.name) fieldMap[f.name] = f;
    }

    log("Filling form fields based on profile...");

    // Helper to fill a field by trying multiple possible names
    const fillField = async (name, value) => {
      if (!value || !fieldMap[name]) return false;
      try {
        const selector = `[name="${name}"]`;
        await page.waitForSelector(selector, { timeout: 3000 });

        if (fieldMap[name].tag === "select") {
          const options = fieldMap[name].options || [];
          const matchedValue = fuzzyMatchOption(options, value) || value;
          await page.select(selector, matchedValue);
          log(`  Set ${name} = ${value} (matched: ${matchedValue})`);
        } else if (fieldMap[name].tag === "textarea") {
          await page.evaluate(
            (sel, val) => {
              document.querySelector(sel).value = val;
            },
            selector,
            value
          );
          log(`  Set ${name} = ${value.substring(0, 50)}...`);
        } else {
          await page.click(selector, { clickCount: 3 });
          await page.type(selector, String(value), { delay: 30 });
          log(`  Set ${name} = ${value}`);
        }
        return true;
      } catch (err) {
        log(`  Warning: could not fill ${name}: ${err.message}`);
        return false;
      }
    };

    // Helper to fill by trying multiple possible form field names
    const fillByFormNames = async (formNames, value) => {
      for (const name of formNames) {
        if (fieldMap[name]) {
          return await fillField(name, value);
        }
      }
      return false;
    };

    // Fill each mapped value using profile's formNames
    const filledFields = [];
    const skippedFields = [];

    for (const [key, entry] of Object.entries(values)) {
      // Special handling for certain fields
      if (key === "il" && metadata.cityId) {
        // City needs special AJAX cascade handling
        const ilField = fieldMap["il"] || fieldMap["sehir"] || fieldMap["city"];
        if (ilField) {
          const ilName = ilField.name;
          await page.select(`[name="${ilName}"]`, String(metadata.cityId));
          log(`  Set ${ilName} = ${metadata.cityId} (${metadata.cityName})`);
          log("  Waiting for ilce AJAX...");
          await new Promise((r) => setTimeout(r, 2000));
          filledFields.push(key);
          continue;
        }
      }

      if (key === "fiyat" && metadata.fiyat) {
        // Price field may use autoNumeric
        const priceField = fieldMap["fiyat"] || fieldMap["price"];
        if (priceField) {
          const priceSelector = `[name="${priceField.name}"]`;
          await page.waitForSelector(priceSelector, { timeout: 3000 }).catch(() => {});
          await page.click(priceSelector, { clickCount: 3 });
          await page.type(priceSelector, String(metadata.fiyat), { delay: 30 });
          log(`  Set ${priceField.name} = ${metadata.fiyat}`);
          filledFields.push(key);
          continue;
        }
      }

      if (key === "aciklama" && metadata.aciklama) {
        // Description may use Trumbowyg WYSIWYG editor
        log("  Setting description...");
        const editorSet = await page.evaluate((html) => {
          const editor =
            document.querySelector(".trumbowyg-editor") ||
            document.querySelector("[contenteditable='true']");
          if (editor) {
            editor.innerHTML = html;
            return true;
          }
          return false;
        }, metadata.aciklama);

        if (editorSet) {
          log("  Set description via WYSIWYG editor");
          filledFields.push(key);
        } else {
          const filled = await fillByFormNames(
            entry.formNames,
            metadata.aciklama.replace(/<[^>]*>/g, " ").trim()
          );
          if (filled) filledFields.push(key);
          else skippedFields.push(key);
        }
        continue;
      }

      // Standard field filling
      const filled = await fillByFormNames(entry.formNames, entry.value);
      if (filled) {
        filledFields.push(key);
      } else {
        skippedFields.push(key);
        log(`  Skipped ${key}: no matching form field found (tried: ${entry.formNames.join(", ")})`);
      }
    }

    log(`Filled: ${filledFields.length}, Skipped: ${skippedFields.length}`);

    // Dry-run: return results without submitting
    if (dryRun) {
      log("DRY RUN: Skipping photo upload and submit");

      const dryRunResult = {
        success: true,
        dryRun: true,
        profile: { type: profile.type, label: profile.label },
        discoveredFields: fields.map((f) => ({
          name: f.name,
          tag: f.tag,
          type: f.type,
          required: f.required,
          label: f.label,
          optionCount: f.options ? f.options.length : 0,
        })),
        mappedValues: {},
        filledFields,
        skippedFields,
        warnings,
      };

      for (const [key, entry] of Object.entries(values)) {
        dryRunResult.mappedValues[key] = entry.value;
      }

      return dryRunResult;
    }

    // Upload photos
    if (photoFiles && photoFiles.length > 0) {
      log(`Uploading ${photoFiles.length} photos...`);
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(...photoFiles);
        log(`  Uploaded ${photoFiles.length} photo files`);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        log("  Warning: no file input found for photo upload");
      }
    }

    // Submit the form
    log("Submitting listing...");
    const submitButton = await page.$(
      'button[type="submit"], input[type="submit"], button[name="buton"]'
    );
    if (submitButton) {
      await Promise.all([
        submitButton.click(),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
      ]);
    } else {
      await page.evaluate(() => {
        const form = document.querySelector("form");
        if (form) form.submit();
      });
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
    }

    // Check result
    const resultUrl = page.url();
    const resultContent = await page.content();
    log(`Result URL: ${resultUrl}`);

    const success =
      resultUrl.includes("ilan/") ||
      resultUrl.includes("ilanlarim") ||
      resultContent.includes("başarıyla") ||
      resultContent.includes("basariyla") ||
      resultContent.includes("eklendi");

    if (success) {
      log("Listing posted successfully!");
      let listingUrl = resultUrl;
      if (!resultUrl.includes("ilan/")) {
        const newListingUrl = await page.evaluate(() => {
          const link = document.querySelector('a[href*="ilan/"]');
          return link ? link.href : null;
        });
        if (newListingUrl) listingUrl = newListingUrl;
      }
      return { success: true, listingUrl };
    } else {
      const errorMsg = await page.evaluate(() => {
        const alert = document.querySelector(".alert-danger, .error, .hata, [class*='error']");
        return alert ? alert.textContent.trim() : null;
      });
      log(`Warning: submission may have failed. ${errorMsg || ""}`);
      return { success: false, listingUrl: resultUrl, error: errorMsg };
    }
  } finally {
    await browser.close();
  }
}

module.exports = { postListing, discoverForm };
