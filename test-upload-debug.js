const { launchBrowser, setupPage } = require("./browser");
const fs = require("fs");
const path = require("path");

(async () => {
  const photos = fs.readdirSync("/tmp/test-upload-real")
    .filter(f => f.endsWith(".jpeg"))
    .map(f => path.join("/tmp/test-upload-real", f))
    .slice(0, 3);
  console.log("Photos:", photos.length);

  const browser = await launchBrowser();
  const page = await setupPage(browser);

  // Login
  await page.goto("https://www.gelgezgor.com/sayfa/giris-yap", { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector('input[name="email_adresi"]', { timeout: 10000 });
  await page.type('input[name="email_adresi"]', "omergungor99+gelgezgor@gmail.com", { delay: 50 });
  await page.type('input[name="parola"]', "guclu78**sifre*4", { delay: 50 });
  await Promise.all([
    page.click('button[name="buton"]'),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
  ]);

  await page.goto("https://www.gelgezgor.com/sayfa/ilan-ekle?kat=904", { waitUntil: "networkidle2", timeout: 60000 });

  // Test 1: fetch with X-Requested-With header
  console.log("\n=== Test 1: fetch with X-Requested-With ===");
  const fileBuffer = fs.readFileSync(photos[0]);
  const fileBase64 = fileBuffer.toString("base64");
  const fn = path.basename(photos[0]);

  const r1 = await page.evaluate(async ({ base64, name }) => {
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let j = 0; j < byteChars.length; j++) bytes[j] = byteChars.charCodeAt(j);
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const file = new File([blob], name, { type: "image/jpeg" });
    const fd = new FormData();
    fd.append("files[]", file);
    const resp = await fetch("/temalar/limon_ilan/ajax.php?islem=ajax_upload", {
      method: "POST",
      body: fd,
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    return { status: resp.status, body: await resp.text() };
  }, { base64: fileBase64, name: fn });
  console.log("Result:", r1.status, r1.body.substring(0, 300));

  // Test 2: jQuery.ajax
  console.log("\n=== Test 2: jQuery.ajax ===");
  const r2 = await page.evaluate(async ({ base64, name }) => {
    return new Promise((resolve) => {
      const byteChars = atob(base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let j = 0; j < byteChars.length; j++) bytes[j] = byteChars.charCodeAt(j);
      const blob = new Blob([bytes], { type: "image/jpeg" });
      const file = new File([blob], name, { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("files[]", file);
      jQuery.ajax({
        url: "/temalar/limon_ilan/ajax.php?islem=ajax_upload",
        type: "POST",
        data: fd,
        processData: false,
        contentType: false,
        success: function(data) { resolve({ ok: true, data: typeof data === "string" ? data.substring(0, 300) : JSON.stringify(data).substring(0, 300) }); },
        error: function(xhr) { resolve({ ok: false, status: xhr.status, text: xhr.responseText?.substring(0, 300) }); },
      });
    });
  }, { base64: fileBase64, name: fn });
  console.log("Result:", JSON.stringify(r2));

  // Test 3: Re-acquire input after each upload
  console.log("\n=== Test 3: uploadFile with re-acquired input ===");
  for (let i = 0; i < Math.min(3, photos.length); i++) {
    const fp = photos[i];
    const fname = path.basename(fp);
    const t0 = Date.now();

    // Re-find the file input each time (plugin may replace it)
    const input = await page.$('input[type="file"][name="files[]"]');
    if (!input) {
      console.log(`  [${i+1}] No file input found!`);
      break;
    }

    try {
      await input.uploadFile(fp);
      // Dispatch change event manually
      await page.evaluate(() => {
        const el = document.querySelector('input[type="file"][name="files[]"]');
        if (el) {
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      // Wait for success
      const beforeCount = await page.evaluate(() => document.querySelectorAll(".fileuploader-item.upload-successful").length);
      let success = false;
      for (let poll = 0; poll < 40; poll++) {
        await new Promise(r => setTimeout(r, 250));
        const count = await page.evaluate(() => document.querySelectorAll(".fileuploader-item.upload-successful").length);
        if (count > beforeCount) { success = true; break; }
      }
      console.log(`  [${i+1}] ${fname} → ${success ? "OK" : "TIMEOUT"} in ${((Date.now()-t0)/1000).toFixed(1)}s`);
    } catch (err) {
      console.log(`  [${i+1}] ${fname} ERROR: ${err.message}`);
    }
  }

  const finalCount = await page.evaluate(() => document.querySelectorAll(".fileuploader-item.upload-successful").length);
  console.log("\nTotal uploaded:", finalCount);

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
