"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const originalExpress = require("express");
const liveChat = require("./routes/live-chat");
const outlookSync = require("./services/outlook-sync-runner");

const expressModulePath = require.resolve("express");

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function secureTokenMatch(supplied, expected) {
  if (!supplied || !expected) return false;

  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireAdmin(request, response, next) {
  const expected = clean(process.env.ADMIN_TOKEN);
  const supplied = clean(request.get("X-Admin-Token")) ||
    clean(request.get("Authorization")).replace(/^Bearer\s+/i, "");

  if (!expected) {
    return response.status(503).json({
      success: false,
      error: "Admin access is not configured."
    });
  }

  if (!secureTokenMatch(supplied, expected)) {
    return response.status(401).json({
      success: false,
      error: "Unauthorized."
    });
  }

  next();
}

function applyAdminHeaders(response) {
  response.set({
    "Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self' https://cdn.shopify.com; connect-src 'self'; img-src 'self' https://cdn.shopify.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
}

function sendPublicFile(response, fileName, contentType) {
  const filePath = path.join(__dirname, "public", fileName);
  response.type(contentType);
  response.send(fs.readFileSync(filePath, "utf8"));
}

function sendReviewDashboard(response) {
  const filePath = path.join(__dirname, "public", "admin-review.html");
  let html = fs.readFileSync(filePath, "utf8");

  if (!html.includes("/outlook-sync-admin.js")) {
    html = html.replace(
      /<\/body>/i,
      "  <script src=\"/outlook-sync-admin.js?v=1\"></script>\n</body>"
    );
  }

  response.type("text/html; charset=utf-8");
  response.send(html);
}

function createWrappedExpress() {
  const app = originalExpress();

  app.get("/admin", function (request, response) {
    applyAdminHeaders(response);
    response.redirect(302, "/admin/live");
  });

  app.get("/admin/live", function (request, response) {
    applyAdminHeaders(response);
    sendPublicFile(response, "admin-live.html", "text/html; charset=utf-8");
  });

  app.get("/admin-live.css", function (request, response) {
    applyAdminHeaders(response);
    sendPublicFile(response, "admin-live.css", "text/css; charset=utf-8");
  });

  app.get("/admin-live.js", function (request, response) {
    applyAdminHeaders(response);
    sendPublicFile(response, "admin-live.js", "application/javascript; charset=utf-8");
  });

  /*
  |--------------------------------------------------------------------------
  | Knowledge Review Outlook Sync Extension
  |--------------------------------------------------------------------------
  */
  app.get("/admin-review.html", function (request, response) {
    applyAdminHeaders(response);
    sendReviewDashboard(response);
  });

  app.get("/outlook-sync-admin.js", function (request, response) {
    applyAdminHeaders(response);
    sendPublicFile(response, "outlook-sync-admin.js", "application/javascript; charset=utf-8");
  });

  app.get("/outlook-sync/status", function (request, response) {
    response.set("Cache-Control", "no-store");
    response.json({
      success: true,
      outlookSync: outlookSync.getStatus()
    });
  });

  app.post("/admin/outlook-sync", requireAdmin, async function (request, response) {
    applyAdminHeaders(response);

    try {
      const result = await outlookSync.runSync({ reason: "admin-dashboard" });

      if (!result.success) {
        return response.status(result.configured === false ? 503 : 500).json(result);
      }

      response.json(result);
    } catch (error) {
      console.error("Manual Outlook knowledge sync error:", error);
      response.status(500).json({
        success: false,
        error: "Outlook knowledge sync failed."
      });
    }
  });

  app.get("/widget.js", function (request, response, next) {
    try {
      const widgetSource = fs.readFileSync(path.join(__dirname, "public", "widget.js"), "utf8");
      const liveSource = fs.readFileSync(path.join(__dirname, "public", "live-chat-client.js"), "utf8");

      response
        .type("application/javascript; charset=utf-8")
        .set("Cache-Control", "no-cache, no-store, must-revalidate")
        .send(widgetSource + "\n\n" + liveSource);
    } catch (error) {
      console.error("Live chat widget extension load error:", error);
      next();
    }
  });

  app.get("/chat/status", async function (request, response) {
    try {
      const origin = String(request.get("Origin") || "");
      const allowedOrigins = [
        "https://gfloor.com",
        "https://www.gfloor.com",
        String(process.env.SHOPIFY_ALLOWED_ORIGIN || "")
      ].filter(Boolean);

      if (origin && allowedOrigins.includes(origin)) {
        response.set("Access-Control-Allow-Origin", origin);
        response.set("Vary", "Origin");
      }

      const status = await liveChat.getLiveSupportStatus();
      response.status(200).json(status);
    } catch (error) {
      console.error("Live chat status override error:", error);
      response.status(503).json({
        success: false,
        liveAgentAvailable: false,
        businessHours: "Monday-Friday, 8 AM-5 PM Central Time",
        queueStatus: "unavailable",
        estimatedWaitMinutes: null,
        message: "Live support status is temporarily unavailable."
      });
    }
  });

  app.use("/chat/live", liveChat.publicRouter);
  app.use("/admin/live/api", function (request, response, next) {
    applyAdminHeaders(response);
    next();
  }, liveChat.adminRouter);

  return app;
}

[
  "Router",
  "json",
  "raw",
  "static",
  "text",
  "urlencoded",
  "query"
].forEach(function (propertyName) {
  if (Object.prototype.hasOwnProperty.call(originalExpress, propertyName)) {
    createWrappedExpress[propertyName] = originalExpress[propertyName];
  }
});

require.cache[expressModulePath].exports = createWrappedExpress;

outlookSync.startAutoSync();
