"use strict";

const path = require("path");
const { execFile } = require("child_process");

const DEFAULT_LOOKBACK_DAYS = "180";
const DEFAULT_MAX_MESSAGES = "500";
const DEFAULT_INTERVAL_MINUTES = 5;

let running = false;
let timer = null;
let initialTimer = null;
let lastStartedAt = null;
let lastCompletedAt = null;
let lastError = "";
let lastSummary = null;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function getMissingConfiguration() {
  const missing = [];

  if (!clean(process.env.MICROSOFT_TENANT_ID)) {
    missing.push("MICROSOFT_TENANT_ID");
  }

  if (!clean(process.env.MICROSOFT_CLIENT_ID)) {
    missing.push("MICROSOFT_CLIENT_ID");
  }

  if (!clean(process.env.MICROSOFT_CLIENT_SECRET)) {
    missing.push("MICROSOFT_CLIENT_SECRET");
  }

  if (!clean(process.env.GRAPH_INGEST_MAILBOX || process.env.CUSTOMER_SERVICE_EMAIL)) {
    missing.push("GRAPH_INGEST_MAILBOX or CUSTOMER_SERVICE_EMAIL");
  }

  if (!clean(process.env.DATABASE_URL)) {
    missing.push("DATABASE_URL");
  }

  return missing;
}

function isConfigured() {
  return getMissingConfiguration().length === 0;
}

function parseNumber(output, label) {
  const expression = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:?\\s*(\\d+)", "i");
  const match = String(output || "").match(expression);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseSummary(output) {
  return {
    matchedPairs: parseNumber(output, "Matched pairs"),
    newEligibleReviews: parseNumber(output, "New eligible reviews"),
    existingRecordsSkipped: parseNumber(output, "Existing records skipped"),
    inserted: parseNumber(output, "Inserted")
  };
}

function getStatus() {
  return {
    configured: isConfigured(),
    missingConfiguration: getMissingConfiguration(),
    running,
    lastStartedAt,
    lastCompletedAt,
    lastError: lastError || null,
    lastSummary,
    lookbackDays: Number.parseInt(clean(process.env.GRAPH_INGEST_LOOKBACK_DAYS) || DEFAULT_LOOKBACK_DAYS, 10),
    maxMessagesPerFolder: Number.parseInt(clean(process.env.GRAPH_INGEST_MAX_MESSAGES) || DEFAULT_MAX_MESSAGES, 10),
    mailbox: clean(process.env.GRAPH_INGEST_MAILBOX || process.env.CUSTOMER_SERVICE_EMAIL) || null
  };
}

function runSync(options) {
  const settings = Object.assign({ reason: "manual" }, options || {});

  if (running) {
    return Promise.resolve({
      success: true,
      skipped: true,
      reason: "already-running",
      status: getStatus()
    });
  }

  const missing = getMissingConfiguration();
  if (missing.length) {
    lastError = "Outlook sync is not configured. Missing: " + missing.join(", ");
    return Promise.resolve({
      success: false,
      configured: false,
      error: lastError,
      status: getStatus()
    });
  }

  running = true;
  lastStartedAt = new Date().toISOString();
  lastError = "";

  const scriptPath = path.join(__dirname, "..", "scripts", "import-customer-service-email.js");
  const childEnvironment = Object.assign({}, process.env, {
    GRAPH_INGEST_LOOKBACK_DAYS: clean(process.env.GRAPH_INGEST_LOOKBACK_DAYS) || DEFAULT_LOOKBACK_DAYS,
    GRAPH_INGEST_MAX_MESSAGES: clean(process.env.GRAPH_INGEST_MAX_MESSAGES) || DEFAULT_MAX_MESSAGES
  });

  console.log("Starting Outlook knowledge sync:", settings.reason);

  return new Promise(function (resolve) {
    execFile(
      process.execPath,
      [scriptPath, "--write"],
      {
        cwd: path.join(__dirname, ".."),
        env: childEnvironment,
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024
      },
      function (error, stdout, stderr) {
        running = false;
        lastCompletedAt = new Date().toISOString();

        if (error) {
          lastError = clean(stderr) || clean(stdout) || error.message;
          console.error("Outlook knowledge sync failed:", lastError);
          resolve({
            success: false,
            configured: true,
            error: lastError,
            status: getStatus()
          });
          return;
        }

        lastSummary = parseSummary(stdout);
        lastError = "";
        console.log("Outlook knowledge sync complete:", lastSummary);

        resolve({
          success: true,
          configured: true,
          summary: lastSummary,
          status: getStatus()
        });
      }
    );
  });
}

function getIntervalMilliseconds() {
  const configuredMinutes = Number.parseInt(clean(process.env.GRAPH_INGEST_SYNC_INTERVAL_MINUTES), 10);
  const minutes = Number.isInteger(configuredMinutes) && configuredMinutes >= 1
    ? Math.min(configuredMinutes, 1440)
    : DEFAULT_INTERVAL_MINUTES;

  return minutes * 60 * 1000;
}

function startAutoSync() {
  if (!isConfigured()) {
    console.log("Outlook knowledge auto-sync is disabled because Microsoft Graph ingestion is not fully configured.");
    return;
  }

  if (timer || initialTimer) {
    return;
  }

  const intervalMs = getIntervalMilliseconds();

  initialTimer = setTimeout(function () {
    initialTimer = null;
    runSync({ reason: "startup" });
  }, 10000);

  timer = setInterval(function () {
    runSync({ reason: "scheduled" });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  if (initialTimer && typeof initialTimer.unref === "function") {
    initialTimer.unref();
  }

  console.log("Outlook knowledge auto-sync scheduled every", Math.round(intervalMs / 60000), "minutes.");
}

module.exports = {
  getStatus,
  runSync,
  startAutoSync
};
