"use strict";

const fs = require("fs");
const path = require("path");

const originalExpress = require("express");
const liveChat = require("./routes/live-chat");

const expressModulePath = require.resolve("express");

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
    "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  });
}

function sendPublicFile(response, fileName, contentType) {
  const filePath = path.join(__dirname, "public", fileName);
  response.type(contentType);
  response.send(fs.readFileSync(filePath, "utf8"));
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
