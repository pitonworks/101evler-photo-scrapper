const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { scrapePhotos, scrapeListing } = require("./scrape");
const { postListing } = require("./post");
const store = require("./queue-store");
const worker = require("./queue-worker");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Crash recovery: reset any items stuck in "processing"
const resetCount = store.resetProcessingItems();
if (resetCount > 0) {
  console.log(`Crash recovery: reset ${resetCount} processing item(s) back to pending`);
}

function getWindowsDrives(callback) {
  fs.readdir("/mnt", { withFileTypes: true }, (err, entries) => {
    if (err) return callback([]);
    const drives = entries
      .filter((e) => e.isDirectory() && /^[a-z]$/.test(e.name))
      .map((e) => ({ label: e.name.toUpperCase() + ":", path: "/mnt/" + e.name }));
    callback(drives);
  });
}

app.get("/browse", (req, res) => {
  const requestedPath = req.query.path || os.homedir();
  const resolved = path.resolve(requestedPath);

  fs.readdir(resolved, { withFileTypes: true }, (err, entries) => {
    if (err) {
      return res.status(400).json({ error: "Cannot read directory: " + err.message });
    }
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    getWindowsDrives((drives) => {
      res.json({ current: resolved, folders, drives });
    });
  });
});

app.post("/mkdir", (req, res) => {
  const { dirPath } = req.body;
  if (!dirPath) {
    return res.status(400).json({ error: "dirPath is required" });
  }
  const resolved = path.resolve(dirPath);
  fs.mkdir(resolved, { recursive: true }, (err) => {
    if (err) {
      return res.status(400).json({ error: "Cannot create directory: " + err.message });
    }
    res.json({ created: resolved });
  });
});

app.post("/scrape", (req, res) => {
  const { url, outputDir } = req.body;

  if (!url || !outputDir) {
    return res.status(400).json({ error: "url and outputDir are required" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onProgress = (message) => {
    sendEvent({ type: "progress", message });
  };

  scrapePhotos(url, outputDir, onProgress)
    .then((result) => {
      sendEvent({ type: "done", ...result });
      res.end();
    })
    .catch((err) => {
      sendEvent({ type: "error", message: err.message });
      res.end();
    });
});

app.post("/transfer", (req, res) => {
  const { url, email, password, dryRun, maxPhotos } = req.body;

  if (!url || !email || !password) {
    return res.status(400).json({ error: "url, email, and password are required" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Create temp directory for photos
  const tmpDir = path.join(os.tmpdir(), "transfer-" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const onProgress = (message) => {
    sendEvent({ type: "progress", message });
  };

  (async () => {
    try {
      // Phase 1: Scrape listing from 101evler
      sendEvent({ type: "phase", phase: "scraping", message: "Scraping listing from 101evler..." });

      const listing = await scrapeListing(url, tmpDir, onProgress);
      sendEvent({
        type: "scraped",
        metadata: {
          baslik: listing.metadata.baslik,
          fiyat: listing.metadata.fiyat,
          paraBirimi: listing.metadata.paraBirimi,
          katCode: listing.metadata.katCode,
          saleType: listing.metadata.saleType,
          cityName: listing.metadata.cityName,
          details: listing.metadata.details,
        },
        photoCount: listing.photos.downloaded,
      });

      // Phase 2: Post listing to gelgezgor.com
      sendEvent({
        type: "phase",
        phase: "posting",
        message: dryRun
          ? "DRY RUN: Filling form without submitting..."
          : "Posting listing to gelgezgor.com...",
      });

      const result = await postListing(
        email,
        password,
        listing.metadata,
        listing.photos.files,
        onProgress,
        { dryRun: !!dryRun, maxPhotos: maxPhotos ? Number(maxPhotos) : undefined }
      );

      if (result.dryRun) {
        sendEvent({
          type: "dryrun",
          profile: result.profile,
          discoveredFields: result.discoveredFields,
          mappedValues: result.mappedValues,
          filledFields: result.filledFields,
          skippedFields: result.skippedFields,
          warnings: result.warnings,
        });
        sendEvent({ type: "done", success: true, dryRun: true });
      } else if (result.success) {
        sendEvent({ type: "done", success: true, listingUrl: result.listingUrl });
      } else {
        sendEvent({
          type: "done",
          success: false,
          listingUrl: result.listingUrl,
          error: result.error || "Submission may have failed",
        });
      }
    } catch (err) {
      sendEvent({ type: "error", message: err.message });
    } finally {
      // Cleanup temp directory
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        // ignore cleanup errors
      }
      res.end();
    }
  })();
});

// ==================== Queue Endpoints ====================
// NOTE: Specific paths (/queue/start, /queue/stop, /queue/progress)
// must be defined BEFORE parameterized paths (/queue/:id)

// GET /queue/progress — SSE stream
app.get("/queue/progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const status = worker.getStatus();
    res.write(`data: ${JSON.stringify({ event: "worker-status", ...status })}\n\n`);
    worker.addSSEClient(res);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ event: "error", message: err.message })}\n\n`);
    res.end();
    return;
  }

  req.on("close", () => {
    const idx = worker.workerState.sseClients.indexOf(res);
    if (idx !== -1) worker.workerState.sseClients.splice(idx, 1);
  });
});

// POST /queue/start — Start processing
app.post("/queue/start", (req, res) => {
  try {
    const { email, password, dryRun, maxPhotos } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = worker.start(
      { email, password },
      { dryRun: !!dryRun, maxPhotos: maxPhotos ? Number(maxPhotos) : undefined }
    );
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue/stop — Stop after current item
app.post("/queue/stop", (req, res) => {
  try {
    const result = worker.stop();
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /queue — All items + worker status
app.get("/queue", (req, res) => {
  try {
    const items = store.getAllItems();
    const status = worker.getStatus();
    res.json({ items, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue — Add URL(s) to queue
app.post("/queue", (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "urls array is required" });
    }
    const added = store.addItems(urls);
    worker.broadcast("queue-updated", { added: added.length });
    res.json({ added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /queue/:id — Remove item (not if processing)
app.delete("/queue/:id", (req, res) => {
  try {
    const item = store.getItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    if (item.status === "processing") {
      return res.status(400).json({ error: "Cannot delete a processing item" });
    }
    store.removeItem(req.params.id);
    worker.broadcast("queue-updated", { removed: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /queue/:id/retry — Reset failed item to pending
app.post("/queue/:id/retry", (req, res) => {
  try {
    const item = store.getItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    if (item.status !== "failed") {
      return res.status(400).json({ error: "Only failed items can be retried" });
    }
    const updated = store.resetItem(req.params.id);
    worker.broadcast("queue-updated", { retried: req.params.id });
    res.json({ item: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
