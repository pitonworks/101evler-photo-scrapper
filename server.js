const express = require("express");
const path = require("path");
const { scrapePhotos } = require("./scrape");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
