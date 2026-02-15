const fs = require("fs");
const path = require("path");
const os = require("os");
const { scrapeListing } = require("./scrape");
const { postListing } = require("./post");
const store = require("./queue-store");

const ITEM_TIMEOUT = 10 * 60 * 1000; // 10 minutes per item

const workerState = {
  running: false,
  shouldStop: false,
  currentItemId: null,
  sseClients: [],
  credentials: null,
  options: null,
};

function broadcast(event, data) {
  const payload = `data: ${JSON.stringify({ event, ...data })}\n\n`;
  for (let i = workerState.sseClients.length - 1; i >= 0; i--) {
    try {
      workerState.sseClients[i].write(payload);
    } catch (err) {
      workerState.sseClients.splice(i, 1);
    }
  }
}

function addSSEClient(res) {
  workerState.sseClients.push(res);
  res.on("close", () => {
    const idx = workerState.sseClients.indexOf(res);
    if (idx !== -1) workerState.sseClients.splice(idx, 1);
  });
}

function getStatus() {
  const items = store.getAllItems();
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const processing = items.filter((i) => i.status === "processing").length;
  return {
    running: workerState.running,
    currentItemId: workerState.currentItemId,
    total: items.length,
    done,
    failed,
    pending,
    processing,
  };
}

async function processItem(item, credentials, options) {
  const tmpDir = path.join(os.tmpdir(), "queue-" + item.id);
  fs.mkdirSync(tmpDir, { recursive: true });

  const onProgress = (message) => {
    // Append to item logs
    store.updateItem(item.id, {
      logs: [...(store.getItem(item.id)?.logs || []), message],
    });
    broadcast("log", { itemId: item.id, message });
  };

  try {
    // Phase 1: Scrape
    broadcast("log", { itemId: item.id, message: "Scraping listing from 101evler..." });
    const listing = await scrapeListing(item.url, tmpDir, onProgress);

    broadcast("log", {
      itemId: item.id,
      message: `Scraped: ${listing.metadata.baslik} | ${listing.photos.downloaded} photos`,
    });

    // Phase 2: Post
    const dryRun = options.dryRun || false;
    broadcast("log", {
      itemId: item.id,
      message: dryRun
        ? "DRY RUN: Filling form without submitting..."
        : "Posting listing to gelgezgor.com...",
    });

    const result = await postListing(
      credentials.email,
      credentials.password,
      listing.metadata,
      listing.photos.files,
      onProgress,
      { dryRun, maxPhotos: options.maxPhotos }
    );

    return result;
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  }
}

function start(credentials, options = {}) {
  if (workerState.running) {
    return { error: "Worker is already running" };
  }

  workerState.running = true;
  workerState.shouldStop = false;
  workerState.credentials = credentials;
  workerState.options = options;

  broadcast("worker-status", { status: "started" });

  // Process loop
  (async () => {
    try {
      while (!workerState.shouldStop) {
        const item = store.getNextPending();
        if (!item) {
          broadcast("worker-status", { status: "idle", message: "No more pending items" });
          break;
        }

        workerState.currentItemId = item.id;
        store.updateItem(item.id, {
          status: "processing",
          startedAt: new Date().toISOString(),
        });
        broadcast("item-start", { itemId: item.id, url: item.url });

        try {
          // Run with timeout
          const result = await Promise.race([
            processItem(item, credentials, options),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Item processing timed out (10 min)")), ITEM_TIMEOUT)
            ),
          ]);

          store.updateItem(item.id, {
            status: "done",
            completedAt: new Date().toISOString(),
            result,
          });
          broadcast("item-done", { itemId: item.id, result });
        } catch (err) {
          store.updateItem(item.id, {
            status: "failed",
            completedAt: new Date().toISOString(),
            error: err.message,
          });
          broadcast("item-failed", { itemId: item.id, error: err.message });
        }
      }
    } finally {
      workerState.running = false;
      workerState.currentItemId = null;
      workerState.credentials = null;
      workerState.options = null;
      broadcast("worker-status", { status: "stopped" });
    }
  })();

  return { ok: true };
}

function stop() {
  if (!workerState.running) {
    return { error: "Worker is not running" };
  }
  workerState.shouldStop = true;
  broadcast("worker-status", { status: "stopping", message: "Will stop after current item finishes" });
  return { ok: true };
}

module.exports = { workerState, broadcast, addSSEClient, getStatus, start, stop };
