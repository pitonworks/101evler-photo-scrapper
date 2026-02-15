const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const QUEUE_FILE = path.join(__dirname, "queue.json");

function loadQueue() {
  try {
    const data = fs.readFileSync(QUEUE_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return { items: [] };
  }
}

function saveQueue(queue) {
  const tmp = QUEUE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(queue, null, 2), "utf8");
  fs.renameSync(tmp, QUEUE_FILE);
}

function generateId() {
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString("hex");
  return `q_${ts}_${rand}`;
}

function addItem(url) {
  const queue = loadQueue();
  const item = {
    id: generateId(),
    url: url.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null,
    logs: [],
    result: null,
  };
  queue.items.push(item);
  saveQueue(queue);
  return item;
}

function addItems(urls) {
  const queue = loadQueue();
  const added = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const item = {
      id: generateId(),
      url: trimmed,
      status: "pending",
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      logs: [],
      result: null,
    };
    queue.items.push(item);
    added.push(item);
  }
  saveQueue(queue);
  return added;
}

function getItem(id) {
  const queue = loadQueue();
  return queue.items.find((item) => item.id === id) || null;
}

function getAllItems() {
  return loadQueue().items;
}

function updateItem(id, patch) {
  const queue = loadQueue();
  const idx = queue.items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  Object.assign(queue.items[idx], patch);
  saveQueue(queue);
  return queue.items[idx];
}

function removeItem(id) {
  const queue = loadQueue();
  const idx = queue.items.findIndex((item) => item.id === id);
  if (idx === -1) return false;
  queue.items.splice(idx, 1);
  saveQueue(queue);
  return true;
}

function getNextPending() {
  const queue = loadQueue();
  return queue.items.find((item) => item.status === "pending") || null;
}

function resetItem(id) {
  return updateItem(id, {
    status: "pending",
    startedAt: null,
    completedAt: null,
    error: null,
    logs: [],
    result: null,
  });
}

/** Reset any items stuck in "processing" back to "pending" (crash recovery) */
function resetProcessingItems() {
  const queue = loadQueue();
  let count = 0;
  for (const item of queue.items) {
    if (item.status === "processing") {
      item.status = "pending";
      item.startedAt = null;
      item.error = null;
      item.logs = [];
      item.result = null;
      count++;
    }
  }
  if (count > 0) saveQueue(queue);
  return count;
}

module.exports = {
  loadQueue,
  saveQueue,
  addItem,
  addItems,
  getItem,
  getAllItems,
  updateItem,
  removeItem,
  getNextPending,
  resetItem,
  resetProcessingItems,
};
