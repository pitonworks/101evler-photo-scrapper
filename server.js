const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { scrapePhotos } = require("./scrape");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
