const fs = require("fs");
const path = require("path");
const { launchBrowser, setupPage } = require("./browser");
const { getProfile, mapMetadataToForm, deriveFields } = require("./form-profiles");
const { enrichMetadata } = require("./description-parser");

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

// Turkish synonym pairs for select option matching
const TURKISH_SYNONYMS = {
  hayir: ["yok"],
  yok: ["hayir"],
  evet: ["var"],
  var: ["evet"],
  belirtilmemis: ["bilinmiyor"],
};

/**
 * Find the best matching option in a <select> by fuzzy Turkish text matching
 */
function fuzzyMatchOption(options, target) {
  const normalizedTarget = normalizeTurkish(target);
  // Exact match first
  for (const opt of options) {
    if (normalizeTurkish(opt.text) === normalizedTarget) return opt.value;
  }
  // Synonym match (Hayır↔Yok, Evet↔Var, etc.)
  const synonyms = TURKISH_SYNONYMS[normalizedTarget] || [];
  for (const opt of options) {
    const normText = normalizeTurkish(opt.text);
    for (const syn of synonyms) {
      if (normText === syn) return opt.value;
    }
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
    // Helper: dispatch events so site JS detects value changes (native + jQuery)
    const triggerEvents = async (selector) => {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        // Native events in proper sequence
        el.dispatchEvent(new Event("focus", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        // jQuery events if available (gelgezgor uses jQuery for Trumbowyg + autoNumeric)
        if (typeof jQuery !== "undefined") {
          jQuery(el).trigger("change").trigger("input");
        } else if (typeof $ !== "undefined" && $.fn && $.fn.trigger) {
          $(el).trigger("change").trigger("input");
        }
      }, selector);
    };

    const fillField = async (name, value) => {
      if (!value || !fieldMap[name]) return false;
      try {
        const selector = `[name="${name}"]`;
        await page.waitForSelector(selector, { timeout: 3000 });

        if (fieldMap[name].tag === "select") {
          const options = fieldMap[name].options || [];
          const matchedValue = fuzzyMatchOption(options, value) || value;
          await page.select(selector, matchedValue);
          // Also set via jQuery for sites using jQuery event handlers
          await page.evaluate((sel, val) => {
            const el = document.querySelector(sel);
            if (!el) return;
            if (typeof jQuery !== "undefined") {
              jQuery(el).val(val).trigger("change");
            }
          }, selector, matchedValue);
          // Verify the value was actually set
          const actualValue = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el ? el.value : null;
          }, selector);
          if (!actualValue || actualValue === "" || actualValue === "0") {
            const optTexts = options
              .filter(o => o.value && o.value !== "0" && o.value !== "")
              .map(o => `"${o.text}"(${o.value})`)
              .slice(0, 10);
            log(`  WARNING: ${name} value not set! Tried "${value}" → "${matchedValue}". Options: ${optTexts.join(", ")}`);
          } else {
            log(`  Set ${name} = ${value} (matched: ${matchedValue})`);
          }
        } else if (fieldMap[name].tag === "textarea") {
          await page.evaluate(
            (sel, val) => {
              const el = document.querySelector(sel);
              el.value = val;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            },
            selector,
            value
          );
          log(`  Set ${name} = ${value.substring(0, 50)}...`);
        } else {
          await page.click(selector, { clickCount: 3 });
          await page.type(selector, String(value), { delay: 30 });
          // Also set via native setter + jQuery for robust detection
          await page.evaluate((sel, val) => {
            const el = document.querySelector(sel);
            if (!el) return;
            // Native input value setter (bypasses getter/setter overrides)
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, "value"
            )?.set;
            if (nativeSetter) nativeSetter.call(el, val);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            if (typeof jQuery !== "undefined") {
              jQuery(el).trigger("change").trigger("input");
            }
          }, selector, String(value));
          log(`  Set ${name} = ${value}`);
        }
        return true;
      } catch (err) {
        log(`  Warning: could not fill ${name}: ${err.message}`);
        return false;
      }
    };

    // Helper to fill by trying multiple possible form field names
    // First tries exact match, then keyword-based search in all field names
    const fillByFormNames = async (formNames, value) => {
      // 1. Exact match
      for (const name of formNames) {
        if (fieldMap[name]) {
          return await fillField(name, value);
        }
      }
      // 2. Keyword search: find a field whose name contains one of our keywords
      //    Skip very short field names (< 3 chars) to avoid false matches like "s", "il"
      const allFieldNames = Object.keys(fieldMap);
      for (const keyword of formNames) {
        if (keyword.length < 3) continue;
        const normKeyword = normalizeTurkish(keyword);
        for (const fname of allFieldNames) {
          if (fname.length < 3) continue; // skip short names like "s"
          const normFname = normalizeTurkish(fname);
          if (normFname === normKeyword) {
            log(`  Fuzzy match: "${keyword}" → "${fname}"`);
            return await fillField(fname, value);
          }
        }
      }
      // 3. Partial match (only if keyword is fully contained in field name)
      for (const keyword of formNames) {
        if (keyword.length < 3) continue;
        const normKeyword = normalizeTurkish(keyword);
        for (const fname of allFieldNames) {
          if (fname.length < 3) continue;
          const normFname = normalizeTurkish(fname);
          if (normFname.includes(normKeyword) && normFname.length <= normKeyword.length + 5) {
            log(`  Fuzzy match: "${keyword}" → "${fname}"`);
            return await fillField(fname, value);
          }
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
        // City needs special AJAX cascade handling: il → ilçe → mahalle
        const ilField = fieldMap["il"] || fieldMap["sehir"] || fieldMap["city"];
        if (ilField) {
          const ilName = ilField.name;
          const ilSelector = `[name="${ilName}"]`;
          await page.select(ilSelector, String(metadata.cityId));
          // Trigger jQuery change to fire AJAX cascade for ilce
          await page.evaluate((sel, val) => {
            const el = document.querySelector(sel);
            if (!el) return;
            if (typeof jQuery !== "undefined") {
              jQuery(el).val(val).trigger("change");
            }
          }, ilSelector, String(metadata.cityId));
          log(`  Set ${ilName} = ${metadata.cityId} (${metadata.cityName})`);
          log("  Waiting for ilce AJAX...");
          // Wait for ilçe options to load via AJAX
          await new Promise((r) => setTimeout(r, 4000));
          filledFields.push(key);
          continue;
        }
      }

      if (key === "ilce" && metadata.district) {
        // İlçe is loaded via AJAX after il selection
        log(`  Looking for ilce select after AJAX...`);
        try {
          const ilceResult = await page.evaluate((district) => {
            const selects = document.querySelectorAll("select");
            for (const sel of selects) {
              if (sel.name === "il" || sel.name === "s" || sel.options.length < 2) continue;
              for (const opt of sel.options) {
                const optText = opt.textContent.trim().toLowerCase();
                const distLower = district.toLowerCase();
                if (optText.includes(distLower) || distLower.includes(optText)) {
                  sel.value = opt.value;
                  sel.dispatchEvent(new Event("change", { bubbles: true }));
                  if (typeof jQuery !== "undefined") {
                    jQuery(sel).val(opt.value).trigger("change");
                  }
                  return { name: sel.name, value: opt.value, text: opt.textContent.trim() };
                }
              }
            }
            return null;
          }, metadata.district);

          if (ilceResult) {
            log(`  Set ${ilceResult.name} = ${metadata.district} (matched: ${ilceResult.text})`);
            filledFields.push(key);

            // Wait for mahalle AJAX cascade after ilçe selection
            log("  Waiting for mahalle AJAX...");
            await new Promise((r) => setTimeout(r, 3000));

            // Try to select first non-empty mahalle option
            const mahalleResult = await page.evaluate(() => {
              const selects = document.querySelectorAll("select");
              for (const sel of selects) {
                if (sel.name && sel.name.toLowerCase().includes("mahalle") && sel.options.length >= 2) {
                  // Select first real option (skip placeholder)
                  for (const opt of sel.options) {
                    if (opt.value && opt.value !== "" && opt.value !== "0") {
                      sel.value = opt.value;
                      sel.dispatchEvent(new Event("change", { bubbles: true }));
                      if (typeof jQuery !== "undefined") {
                        jQuery(sel).val(opt.value).trigger("change");
                      }
                      return { name: sel.name, value: opt.value, text: opt.textContent.trim() };
                    }
                  }
                }
              }
              return null;
            });

            if (mahalleResult) {
              log(`  Set ${mahalleResult.name} = ${mahalleResult.text}`);
            } else {
              log("  No mahalle select found or no options available");
            }
          } else {
            log(`  Warning: ilce "${metadata.district}" not found in AJAX-loaded options`);
            skippedFields.push(key);
          }
        } catch (err) {
          log(`  Warning: could not fill ilce: ${err.message}`);
          skippedFields.push(key);
        }
        continue;
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
        // Search for similar field names to suggest
        const allNames = Object.keys(fieldMap);
        const suggestions = [];
        for (const keyword of entry.formNames) {
          const normK = normalizeTurkish(keyword);
          for (const fn of allNames) {
            const normFn = normalizeTurkish(fn);
            // Partial match in either direction
            if (normFn.includes(normK.substring(0, 3)) || normK.includes(normFn.substring(0, 3))) {
              if (!suggestions.includes(fn) && suggestions.length < 5) suggestions.push(fn);
            }
          }
        }
        log(`  Skipped ${key}: tried [${entry.formNames.join(", ")}]${suggestions.length ? ` | Similar: [${suggestions.join(", ")}]` : ""}`);
      }
    }

    // Fill contact fields (yetkili, yetkili_tel) - always required
    if (fieldMap["yetkili"]) {
      // Check the "use profile contact" checkbox first
      try {
        const uyeCheckbox = await page.$('input[name="uye_numara"]');
        if (uyeCheckbox) {
          const isChecked = await page.evaluate(el => el.checked, uyeCheckbox);
          if (!isChecked) {
            await uyeCheckbox.click();
            log("  Checked 'use profile contact info'");
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } catch (err) {
        log(`  Warning: could not check uye_numara: ${err.message}`);
      }
    }

    // Check onay (terms) checkbox - use JS + jQuery since it may be a custom styled checkbox
    try {
      const onaySet = await page.evaluate(() => {
        const cb = document.querySelector('input[name="onay"]');
        if (!cb) return "not found";
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        cb.dispatchEvent(new Event("click", { bubbles: true }));
        cb.dispatchEvent(new Event("input", { bubbles: true }));
        // jQuery trigger
        if (typeof jQuery !== "undefined") {
          jQuery(cb).prop("checked", true).trigger("change").trigger("click");
        }
        // Also try clicking the label if checkbox is hidden
        const label = cb.closest("label") || document.querySelector('label[for="onay"]');
        if (label) label.click();
        return cb.checked ? "checked" : "failed";
      });
      log(`  Onay checkbox: ${onaySet}`);
    } catch (err) {
      log(`  Warning: could not check onay: ${err.message}`);
    }

    // Re-trigger change events on ALL filled fields to ensure validation catches everything
    log("Triggering form validation on all fields...");
    await page.evaluate(() => {
      document.querySelectorAll("select, input, textarea").forEach(el => {
        if (el.value && el.name && el.name !== "s") {
          el.dispatchEvent(new Event("change", { bubbles: true }));
          if (typeof jQuery !== "undefined") {
            jQuery(el).trigger("change");
          }
        }
      });
      // Click body to trigger any blur-based validation
      document.body.click();
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Debug: check which required/empty fields might be blocking submission
    const emptyFields = await page.evaluate(() => {
      const empty = [];
      // Check HTML required fields
      document.querySelectorAll("[required]").forEach(el => {
        if (!el.value || el.value === "") {
          empty.push({ name: el.name || el.id, tag: el.tagName, reason: "required+empty" });
        }
      });
      // Check selects with default/empty value
      document.querySelectorAll("select").forEach(el => {
        if (el.name && el.name !== "s" && (el.value === "" || el.value === "0")) {
          empty.push({ name: el.name, tag: "select", value: el.value, reason: "default/empty" });
        }
      });
      return empty;
    });
    if (emptyFields.length > 0) {
      log("Potentially empty/default fields:");
      for (const f of emptyFields) {
        log(`  ${f.name} (${f.tag}) - ${f.reason}${f.value !== undefined ? ` val="${f.value}"` : ""}`);
      }
    } else {
      log("All fields appear to be filled.");
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

    // Upload photos one by one using base64 + DataTransfer approach
    // (Puppeteer's uploadFile() hangs with custom uploader plugins)
    const maxPhotos = options.maxPhotos !== undefined ? options.maxPhotos : photoFiles.length;
    if (photoFiles && photoFiles.length > 0 && maxPhotos > 0) {
      const filesToUpload = photoFiles.slice(0, maxPhotos);
      log(`Uploading ${filesToUpload.length} photos (of ${photoFiles.length} total)...`);

      for (let i = 0; i < filesToUpload.length; i++) {
        const filePath = filesToUpload[i];
        const fileName = path.basename(filePath);
        log(`  [${i + 1}/${filesToUpload.length}] Uploading ${fileName}...`);

        try {
          const fileBuffer = fs.readFileSync(filePath);
          const fileBase64 = fileBuffer.toString("base64");
          const mimeType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";

          const uploadResult = await page.evaluate(async ({ base64, name, mime }) => {
            const input = document.querySelector('input[type="file"], input[name="files[]"]');
            if (!input) return { ok: false, error: "no file input found" };

            // Decode base64 to binary
            const byteChars = atob(base64);
            const byteArrays = [];
            for (let offset = 0; offset < byteChars.length; offset += 1024) {
              const slice = byteChars.slice(offset, offset + 1024);
              const byteNumbers = new Array(slice.length);
              for (let j = 0; j < slice.length; j++) {
                byteNumbers[j] = slice.charCodeAt(j);
              }
              byteArrays.push(new Uint8Array(byteNumbers));
            }
            const blob = new Blob(byteArrays, { type: mime });
            const file = new File([blob], name, { type: mime, lastModified: Date.now() });

            // Use DataTransfer to create a FileList and set on input
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;

            // Trigger events
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));

            // jQuery trigger
            if (typeof jQuery !== "undefined") {
              jQuery(input).trigger("change");
            }

            return { ok: true };
          }, { base64: fileBase64, name: fileName, mime: mimeType });

          if (uploadResult.ok) {
            log(`  [${i + 1}/${filesToUpload.length}] Sent ${fileName}`);
            // Wait for the site to process the upload
            await new Promise((r) => setTimeout(r, 3000));
          } else {
            log(`  [${i + 1}/${filesToUpload.length}] Warning: ${uploadResult.error}`);
          }
        } catch (err) {
          log(`  [${i + 1}/${filesToUpload.length}] Error: ${err.message}`);
        }
      }
      log("Photo upload complete");
    }

    // Remove required from non-form fields (search bars) to avoid validation blocking
    await page.evaluate(() => {
      document.querySelectorAll('input[name="s"]').forEach(el => {
        el.removeAttribute("required");
        el.value = "x"; // fill with dummy value just in case
      });
    });
    log("Cleaned stray required attributes");

    // Wait for submit button to become enabled (with retries)
    let btnStatus = "DISABLED";
    for (let attempt = 1; attempt <= 5; attempt++) {
      btnStatus = await page.evaluate(() => {
        const btn = document.querySelector('#buton, button[name="buton"]');
        if (!btn) return "not found";
        return btn.disabled ? "DISABLED" : "ENABLED";
      });
      if (btnStatus === "ENABLED") break;
      log(`  Submit button check ${attempt}/5: ${btnStatus}`);
      if (attempt < 5) {
        // Re-trigger validation on each retry
        await page.evaluate(() => {
          document.querySelectorAll("select, input").forEach(el => {
            if (el.value && el.name && el.name !== "s") {
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });
          const cb = document.querySelector('input[name="onay"]');
          if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
        });
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    log(`Submit button status: ${btnStatus}`);

    // If still disabled, force enable as last resort
    if (btnStatus === "DISABLED") {
      log("  Force-enabling submit button as fallback...");
      await page.evaluate(() => {
        const btn = document.querySelector('#buton, button[name="buton"]');
        if (btn) {
          btn.removeAttribute("disabled");
          btn.disabled = false;
          // Also try jQuery
          if (typeof jQuery !== "undefined") {
            jQuery(btn).prop("disabled", false).removeAttr("disabled");
          }
        }
      });
      btnStatus = "FORCE_ENABLED";
    }

    // Submit via button click inside the correct form (the one with baslik/fiyat)
    log("Submitting listing...");
    const clicked = await page.evaluate(() => {
      // Find the ilan form (contains baslik or fiyat field)
      const forms = document.querySelectorAll("form");
      for (const form of forms) {
        if (form.querySelector('[name="baslik"]') || form.querySelector('[name="fiyat"]')) {
          const btn = form.querySelector('#buton, button[name="buton"], button[type="submit"]');
          if (btn) {
            btn.click();
            return btn.textContent || btn.value || "button";
          }
        }
      }
      return null;
    });
    if (clicked) {
      log(`  Clicked submit button: "${clicked}"`);
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    } else {
      log("  Warning: no submit button found in listing form");
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
      // Capture all error/warning messages on the page
      const errorMsg = await page.evaluate(() => {
        const errors = [];
        // Standard error selectors
        document.querySelectorAll(".alert-danger, .alert-warning, .error, .hata, [class*='error'], [class*='uyari'], .text-danger, .invalid-feedback").forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length > 2 && !errors.includes(text)) errors.push(text);
        });
        // HTML5 validation messages
        document.querySelectorAll(":invalid").forEach(el => {
          if (el.validationMessage && !errors.includes(el.validationMessage)) {
            const name = el.name || el.id || "unknown";
            errors.push(`${name}: ${el.validationMessage}`);
          }
        });
        // Required but empty fields
        document.querySelectorAll("[required]").forEach(el => {
          if (!el.value || el.value === "") {
            const name = el.name || el.id || "unknown";
            const label = el.closest("label")?.textContent?.trim() || "";
            errors.push(`Empty required: ${name} ${label}`);
          }
        });
        return errors.length ? errors.join(" | ") : null;
      });
      log(`Warning: submission may have failed.`);
      if (errorMsg) log(`  Errors: ${errorMsg}`);
      return { success: false, listingUrl: resultUrl, error: errorMsg };
    }
  } finally {
    await browser.close();
  }
}

module.exports = { postListing, discoverForm };
