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
  // Contains match (skip very short targets to avoid false positives like "0" matching "10")
  if (normalizedTarget.length >= 3) {
    for (const opt of options) {
      const normText = normalizeTurkish(opt.text);
      if (normText.includes(normalizedTarget)) return opt.value;
      if (normText.length >= 3 && normalizedTarget.includes(normText)) return opt.value;
    }
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
  const profile = getProfile(metadata.katCode, metadata.saleType);
  log(`Property profile: ${profile.label} (type: ${profile.type}, saleType: ${metadata.saleType || "unknown"})`);

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
    // Upload photos FIRST (before form fill) via fileuploader plugin
    const maxPhotos = options.maxPhotos !== undefined ? options.maxPhotos : photoFiles.length;
    if (!dryRun && photoFiles && photoFiles.length > 0 && maxPhotos > 0) {
      const filesToUpload = photoFiles.slice(0, maxPhotos);
      log(`Uploading ${filesToUpload.length} photos via fileuploader plugin...`);

      let uploadedCount = 0;
      for (let i = 0; i < filesToUpload.length; i++) {
        const fp = filesToUpload[i];
        const fn = path.basename(fp);
        const fz = fs.statSync(fp).size;
        const tag = `[${i + 1}/${filesToUpload.length}]`;
        const t0 = Date.now();

        try {
          // Re-acquire file input each time (plugin may replace the element)
          const fileInput = await page.$('input[type="file"][name="files[]"]');
          if (!fileInput) {
            log(`  ${tag} ${fn} - file input not found, stopping uploads`);
            break;
          }

          // Try native uploadFile with 15s timeout, fallback to base64
          let uploadMethod = "native";
          try {
            await Promise.race([
              fileInput.uploadFile(fp),
              new Promise((_, reject) => setTimeout(() => reject(new Error("uploadFile timeout")), 15000)),
            ]);
          } catch (nativeErr) {
            // Fallback: base64 DataTransfer
            uploadMethod = "base64";
            log(`  ${tag} ${fn} native failed (${nativeErr.message}), trying base64...`);
            const b64 = fs.readFileSync(fp).toString("base64");
            const mimeType = fn.match(/\.png$/i) ? "image/png" : "image/jpeg";
            await page.evaluate((b64Data, mime, fileName) => {
              const byteChars = atob(b64Data);
              const byteArr = new Uint8Array(byteChars.length);
              for (let j = 0; j < byteChars.length; j++) byteArr[j] = byteChars.charCodeAt(j);
              const file = new File([byteArr], fileName, { type: mime });
              const dt = new DataTransfer();
              dt.items.add(file);
              const input = document.querySelector('input[type="file"][name="files[]"]');
              if (input) {
                input.files = dt.files;
                input.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }, b64, mimeType, fn);
          }

          // If native succeeded, fire change event
          if (uploadMethod === "native") {
            await page.evaluate(() => {
              const el = document.querySelector('input[type="file"][name="files[]"]');
              if (el) el.dispatchEvent(new Event("change", { bubbles: true }));
            });
          }

          // Wait for upload-successful count to increase
          let success = false;
          for (let poll = 0; poll < 60; poll++) {
            await new Promise((r) => setTimeout(r, 250));
            const count = await page.evaluate(() =>
              document.querySelectorAll(".fileuploader-item.upload-successful").length
            );
            if (count > uploadedCount) {
              success = true;
              uploadedCount = count;
              break;
            }
          }

          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          if (success) {
            log(`  ${tag} ${fn} OK via ${uploadMethod} (${(fz / 1024).toFixed(0)} KB, ${elapsed}s)`);
          } else {
            log(`  ${tag} ${fn} TIMEOUT after ${elapsed}s (${uploadMethod})`);
          }
        } catch (err) {
          log(`  ${tag} ${fn} Error: ${err.message}`);
        }
      }
      log(`Photos: ${uploadedCount}/${filesToUpload.length} uploaded`);
    }

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
            // Fallback: prefer "Belirtilmemiş" option (safe default), then first valid option
            const placeholders = ["seciniz", "secim yapiniz", "seciniz...", "sec"];
            const validOptions = options.filter(o => {
              if (!o.value || o.value === "0" || o.value === "") return false;
              const normText = normalizeTurkish(o.text.trim());
              return !placeholders.includes(normText);
            });
            const belirtilmemis = validOptions.find(o => normalizeTurkish(o.text) === "belirtilmemis");
            const fallbackOpt = belirtilmemis || validOptions[0];
            if (fallbackOpt) {
              const fallbackValue = fallbackOpt.value;
              const fallbackText = fallbackOpt.text;
              await page.select(selector, fallbackValue);
              await page.evaluate((sel, val) => {
                const el = document.querySelector(sel);
                if (!el) return;
                if (typeof jQuery !== "undefined") {
                  jQuery(el).val(val).trigger("change");
                }
              }, selector, fallbackValue);
              log(`  Fallback: ${name} = ${fallbackText} (original: ${value})`);
            } else {
              const optTexts = options
                .map(o => `"${o.text}"(${o.value})`)
                .slice(0, 10);
              log(`  WARNING: ${name} value not set! Tried "${value}" → "${matchedValue}". No valid fallback. Options: ${optTexts.join(", ")}`);
            }
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
          log("  Waiting for ilce AJAX (polling for select[name=ilce])...");

          // Poll specifically for an ilçe select to appear in the DOM with options
          // The ilçe select is dynamically injected by AJAX after il change
          let ilceLoaded = false;
          for (let attempt = 1; attempt <= 2; attempt++) {
            for (let poll = 0; poll < 30; poll++) {
              await new Promise((r) => setTimeout(r, 500));
              const optCount = await page.evaluate(() => {
                // Only check for selects explicitly named ilce/ilçe/semt/district
                const names = ["ilce", "ilçe", "semt", "district"];
                for (const name of names) {
                  const sel = document.querySelector(`select[name="${name}"]`);
                  if (sel && sel.options.length >= 2) return sel.options.length;
                }
                return 0;
              });
              if (optCount >= 2) {
                ilceLoaded = true;
                log(`  İlçe select loaded (${optCount} options, ${(poll + 1) * 0.5}s, attempt ${attempt})`);
                break;
              }
            }
            if (ilceLoaded) break;

            // Retry: re-trigger il change event
            if (attempt < 2) {
              log("  İlçe select not found after 15s, retrying il change event...");
              await page.evaluate((sel, val) => {
                const el = document.querySelector(sel);
                if (!el) return;
                el.value = val;
                el.dispatchEvent(new Event("change", { bubbles: true }));
                if (typeof jQuery !== "undefined") {
                  jQuery(el).val(val).trigger("change");
                }
              }, ilSelector, String(metadata.cityId));
            }
          }

          if (!ilceLoaded) {
            log("  WARNING: İlçe select did not appear after 2 attempts (30s total)");
          }
          filledFields.push(key);
          continue;
        }
      }

      if (key === "ilce" && metadata.district) {
        // İlçe is loaded via AJAX after il selection — search DOM directly (not fieldMap)
        log(`  Selecting ilce: "${metadata.district}"...`);
        try {
          const ilceResult = await page.evaluate((district) => {
            // Turkish normalization inside browser context
            function norm(s) {
              return s.replace(/İ/g, "I").toLowerCase()
                .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
                .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
            }
            const distNorm = norm(district);

            // Find the ilçe select directly from DOM (dynamically injected by AJAX)
            const ilceNames = ["ilce", "ilçe", "semt", "district"];
            let ilceSel = null;
            for (const name of ilceNames) {
              const el = document.querySelector(`select[name="${name}"]`);
              if (el && el.options.length >= 2) { ilceSel = el; break; }
            }

            if (!ilceSel) return { error: "no ilce select found in DOM" };

            // Try to match district name
            const allOpts = Array.from(ilceSel.options).map(o => ({
              value: o.value, text: o.textContent.trim(), norm: norm(o.textContent.trim())
            }));

            // 1. Exact match
            let match = allOpts.find(o => o.norm === distNorm);
            // 2. Contains match
            if (!match) match = allOpts.find(o => o.norm.includes(distNorm) || distNorm.includes(o.norm));
            // 3. Word-start match (e.g. "girne merkez" matches "Girne Merkez")
            if (!match) match = allOpts.find(o => o.norm.startsWith(distNorm) || distNorm.startsWith(o.norm));

            if (match) {
              ilceSel.value = match.value;
              ilceSel.dispatchEvent(new Event("change", { bubbles: true }));
              if (typeof jQuery !== "undefined") {
                jQuery(ilceSel).val(match.value).trigger("change");
              }
              return { name: ilceSel.name, value: match.value, text: match.text };
            }

            return {
              error: "district not matched",
              selectName: ilceSel.name,
              optCount: ilceSel.options.length,
              sampleOpts: allOpts.slice(0, 10).map(o => o.text),
            };
          }, metadata.district);

          if (ilceResult && !ilceResult.error) {
            log(`  Set ${ilceResult.name} = ${metadata.district} (matched: ${ilceResult.text})`);
            filledFields.push(key);

            // Wait for mahalle AJAX cascade after ilçe selection (polling)
            log("  Waiting for mahalle AJAX...");
            let mahalleLoaded = false;
            for (let poll = 0; poll < 20; poll++) {
              await new Promise((r) => setTimeout(r, 500));
              const mCount = await page.evaluate(() => {
                const selects = document.querySelectorAll("select");
                for (const sel of selects) {
                  if (sel.name && sel.name.toLowerCase().includes("mahalle") && sel.options.length >= 2) {
                    return sel.options.length;
                  }
                }
                return 0;
              });
              if (mCount >= 2) {
                mahalleLoaded = true;
                log(`  Mahalle options loaded (${mCount} options, ${(poll + 1) * 0.5}s)`);
                break;
              }
            }

            if (mahalleLoaded) {
              // Select first non-placeholder mahalle option
              const mahalleResult = await page.evaluate(() => {
                function norm(s) {
                  return s.replace(/İ/g, "I").toLowerCase()
                    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
                    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
                }
                const placeholders = ["seciniz", "secim yapiniz", "sec"];
                const selects = document.querySelectorAll("select");
                for (const sel of selects) {
                  if (sel.name && sel.name.toLowerCase().includes("mahalle") && sel.options.length >= 2) {
                    for (const opt of sel.options) {
                      if (opt.value && opt.value !== "" && opt.value !== "0" && !placeholders.includes(norm(opt.textContent.trim()))) {
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
                log("  No valid mahalle option found");
              }
            } else {
              log("  Mahalle select not loaded after 10s");
            }
          } else {
            const errInfo = ilceResult?.error || "unknown";
            const sampleOpts = ilceResult?.sampleOpts ? ` Options: [${ilceResult.sampleOpts.join(", ")}]` : "";
            log(`  Warning: ilce "${metadata.district}" not matched (${errInfo}).${sampleOpts}`);
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

      if (key === "aciklama") {
        const rawContent = metadata.aciklama || entry.value || "";
        // Strip emojis and variation selectors, collapse extra whitespace
        const htmlContent = rawContent
          .replace(/\p{Extended_Pictographic}/gu, "")
          .replace(/[\uFE00-\uFE0F\u200D]/g, "")
          .replace(/\s{2,}/g, " ");
        if (!htmlContent.trim()) {
          log("  Warning: no description content found");
          skippedFields.push(key);
          continue;
        }
        // Description may use Trumbowyg WYSIWYG editor
        log("  Setting description...");
        const editorSet = await page.evaluate((html) => {
          // 1. Set Trumbowyg contenteditable editor
          const editor =
            document.querySelector(".trumbowyg-editor") ||
            document.querySelector("[contenteditable='true']");
          if (editor) {
            editor.innerHTML = html;
            // 2. Also sync to hidden textarea (Trumbowyg reads from it on submit)
            const textarea = document.querySelector('textarea[name="aciklama"], textarea[name="icerik"], textarea[name="detay"], textarea[name="description"]');
            if (textarea) {
              textarea.value = html;
              textarea.dispatchEvent(new Event("change", { bubbles: true }));
            }
            // 3. Trigger Trumbowyg sync via jQuery
            if (typeof jQuery !== "undefined") {
              jQuery(".trumbowyg-editor").trigger("input").trigger("change");
              // Trumbowyg stores reference — try textareaChange event
              jQuery("textarea").first().trumbowyg && jQuery("textarea").first().trumbowyg("html", html);
            }
            return true;
          }
          return false;
        }, htmlContent);

        if (editorSet) {
          log("  Set description via WYSIWYG editor + hidden textarea");
          filledFields.push(key);
        } else {
          // No WYSIWYG — try plain textarea
          const plainText = htmlContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          const filled = await fillByFormNames(entry.formNames, plainText);
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

    // Re-trigger change events on filled fields to ensure validation catches everything
    // SKIP il/ilce — re-triggering il fires AJAX which resets the ilçe select
    log("Triggering form validation on all fields (excluding il/ilce)...");
    await page.evaluate(() => {
      const skipNames = ["il", "ilce", "ilçe", "semt", "mahalle"];
      document.querySelectorAll("select, input, textarea").forEach(el => {
        if (el.value && el.name && el.name !== "s" && !skipNames.includes(el.name)) {
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

    // Photos already uploaded before form fill (see below)

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
        // Re-trigger validation on each retry (skip il/ilce to prevent AJAX reset)
        await page.evaluate(() => {
          const skipNames = ["il", "ilce", "ilçe", "semt", "mahalle"];
          document.querySelectorAll("select, input").forEach(el => {
            if (el.value && el.name && el.name !== "s" && !skipNames.includes(el.name)) {
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
      log("Listing saved as draft.");

      // Extract ilan ID from result URL (e.g. ?ilan=21677)
      const ilanMatch = resultUrl.match(/[?&]ilan=(\d+)/);
      let listingUrl = resultUrl;

      if (ilanMatch) {
        const ilanId = ilanMatch[1];
        // Publish the listing by visiting the yayınla URL
        const publishUrl = `https://www.gelgezgor.com/sayfa/ilanlarim?yayinla=${ilanId}`;
        log(`Publishing listing ${ilanId}...`);
        try {
          await page.goto(publishUrl, { waitUntil: "networkidle2", timeout: 30000 });
          log(`Listing ${ilanId} published!`);
          listingUrl = publishUrl;
        } catch (err) {
          log(`  Warning: publish failed: ${err.message}`);
        }
      } else {
        log("  Warning: could not extract ilan ID from URL to publish");
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
