const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "https://gfloor.com",
  "https://www.gfloor.com"
];

if (
  process.env.SHOPIFY_ALLOWED_ORIGIN &&
  !allowedOrigins.includes(process.env.SHOPIFY_ALLOWED_ORIGIN)
) {
  allowedOrigins.push(process.env.SHOPIFY_ALLOWED_ORIGIN);
}

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: function (origin, callback) {
      /*
       * Allow requests with no Origin header.
       * This includes direct health checks and server-side requests.
       */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("Blocked CORS origin:", origin);

      return callback(
        new Error("Origin is not allowed by CORS.")
      );
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(
  express.json({
    limit: "20kb"
  })
);

app.use(express.static("public"));

/*
|--------------------------------------------------------------------------
| Customer Service Business Hours
|--------------------------------------------------------------------------
|
| Business hours:
| Monday-Friday
| 8:00 AM-5:00 PM
| Central Time
|
| America/Chicago automatically handles CST/CDT.
|--------------------------------------------------------------------------
*/

function getCustomerServiceStatus() {
  const now = new Date();

  const formattedParts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(now);

  const centralTime = {};

  formattedParts.forEach(function (part) {
    if (part.type !== "literal") {
      centralTime[part.type] = part.value;
    }
  });

  const weekday = centralTime.weekday;
  const hour = Number(centralTime.hour);
  const minute = Number(centralTime.minute);

  const businessDays = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri"
  ];

  const isBusinessDay =
    businessDays.includes(weekday);

  const minutesSinceMidnight =
    hour * 60 + minute;

  const openingMinutes =
    8 * 60;

  const closingMinutes =
    17 * 60;

  const liveAgentAvailable =
    isBusinessDay &&
    minutesSinceMidnight >= openingMinutes &&
    minutesSinceMidnight < closingMinutes;

  if (liveAgentAvailable) {
    return {
      liveAgentAvailable: true,
      businessHours:
        "Monday-Friday, 8 AM-5 PM Central Time",
      estimatedWaitMinutes: "2-5",
      message:
        "A Customer Service representative is currently available. Estimated wait time: approximately 2-5 minutes."
    };
  }

  return {
    liveAgentAvailable: false,
    businessHours:
      "Monday-Friday, 8 AM-5 PM Central Time",
    estimatedWaitMinutes: null,
    message:
      "Our Customer Service team is currently offline. Live support hours are Monday-Friday, 8 AM-5 PM Central Time. Please leave a message and our team will follow up."
  };
}

/*
|--------------------------------------------------------------------------
| Home
|--------------------------------------------------------------------------
*/

app.get("/", function (req, res) {
  res.send(
    "G-Floor chat backend is running."
  );
});

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/health", function (req, res) {
  const requiredEnvironmentVariables = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "CUSTOMER_SERVICE_EMAIL"
  ];

  const missingEnvironmentVariables =
    requiredEnvironmentVariables.filter(
      function (variableName) {
        return !process.env[variableName];
      }
    );

  res.json({
    status: "ok",
    app: "gfloor-chatfeature",
    serverTime: new Date().toISOString(),
    emailConfigured:
      missingEnvironmentVariables.length === 0,
    missingEnvironmentVariables:
      missingEnvironmentVariables
  });
});

/*
|--------------------------------------------------------------------------
| Chat Status
|--------------------------------------------------------------------------
|
| Shopify calls this endpoint whenever the customer wants to connect
| with a live representative.
|
|--------------------------------------------------------------------------
*/

app.get("/chat/status", function (req, res) {
  try {
    const status =
      getCustomerServiceStatus();

    return res.status(200).json({
      success: true,
      liveAgentAvailable:
        status.liveAgentAvailable,
      businessHours:
        status.businessHours,
      estimatedWaitMinutes:
        status.estimatedWaitMinutes,
      message:
        status.message
    });
  } catch (error) {
    console.error(
      "Chat status error:",
      error
    );

    return res.status(500).json({
      success: false,
      liveAgentAvailable: false,
      businessHours:
        "Monday-Friday, 8 AM-5 PM Central Time",
      estimatedWaitMinutes: null,
      message:
        "Customer Service availability could not be checked right now."
    });
  }
});

/*
|--------------------------------------------------------------------------
| Chat Message
|--------------------------------------------------------------------------
*/

app.post(
  "/chat/message",
  async function (req, res) {
    try {
      const name =
        typeof req.body.name === "string"
          ? req.body.name.trim()
          : "";

      const email =
        typeof req.body.email === "string"
          ? req.body.email.trim()
          : "";

      const phone =
        typeof req.body.phone === "string"
          ? req.body.phone.trim()
          : "";

      const message =
        typeof req.body.message === "string"
          ? req.body.message.trim()
          : "";

      const pageUrl =
        typeof req.body.pageUrl === "string"
          ? req.body.pageUrl.trim()
          : "";

      const pageTitle =
        typeof req.body.pageTitle === "string"
          ? req.body.pageTitle.trim()
          : "";

      /*
       * Do NOT trust the browser's live-agent value.
       * The server determines whether live support
       * is actually available.
       */

      const currentSupportStatus =
        getCustomerServiceStatus();

      const requestedLiveAgent =
        req.body.requestedLiveAgent === true ||
        req.body.requestedLiveAgent === "true";

      if (
        !name ||
        !email ||
        !phone ||
        !message
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Name, email, phone, and message are required."
        });
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(email)) {
        return res.status(400).json({
          success: false,
          error:
            "Please enter a valid email address."
        });
      }

      const requiredEnvironmentVariables = [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASS",
        "SMTP_FROM",
        "CUSTOMER_SERVICE_EMAIL"
      ];

      const missingEnvironmentVariables =
        requiredEnvironmentVariables.filter(
          function (variableName) {
            return !process.env[variableName];
          }
        );

      if (
        missingEnvironmentVariables.length > 0
      ) {
        console.error(
          "Missing email environment variables:",
          missingEnvironmentVariables.join(", ")
        );

        return res.status(500).json({
          success: false,
          error:
            "Email delivery is not fully configured."
        });
      }

      /*
      |--------------------------------------------------------------------------
      | SMTP Transport
      |--------------------------------------------------------------------------
      |
      | This is temporary while Microsoft Graph is being configured
      | by NetStandard.
      |
      */

      const transporter =
        nodemailer.createTransport({
          host:
            process.env.SMTP_HOST,

          port:
            Number(
              process.env.SMTP_PORT || 587
            ),

          secure:
            process.env.SMTP_SECURE ===
            "true",

          requireTLS: true,

          connectionTimeout: 15000,

          greetingTimeout: 10000,

          socketTimeout: 20000,

          auth: {
            user:
              process.env.SMTP_USER,

            pass:
              process.env.SMTP_PASS
          },

          tls: {
            minVersion: "TLSv1.2"
          }
        });

      const emailBody = [
        "New G-Floor chat message",
        "",
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        "",
        "Message:",
        message,
        "",
        `Page title: ${
          pageTitle || "Not provided"
        }`,
        `Page URL: ${
          pageUrl || "Not provided"
        }`,
        "",
        `Customer requested live agent: ${
          requestedLiveAgent
            ? "Yes"
            : "No"
        }`,
        "",
        `Live agent available at submission: ${
          currentSupportStatus
            .liveAgentAvailable
            ? "Yes"
            : "No"
        }`,
        "",
        `Estimated wait time: ${
          currentSupportStatus
            .estimatedWaitMinutes
            ? currentSupportStatus
                .estimatedWaitMinutes +
              " minutes"
            : "Not available"
        }`,
        "",
        `Business hours: ${
          currentSupportStatus.businessHours
        }`
      ].join("\n");

      const emailResult =
        await transporter.sendMail({
          from:
            process.env.SMTP_FROM,

          to:
            process.env
              .CUSTOMER_SERVICE_EMAIL,

          replyTo:
            email,

          subject:
            `New G-Floor Chat Message from ${name}`,

          text:
            emailBody
        });

      console.log(
        "Chat email sent successfully:",
        emailResult.messageId
      );

      return res.status(200).json({
        success: true,
        message:
          "Your message was sent successfully.",
        liveAgentAvailable:
          currentSupportStatus
            .liveAgentAvailable,
        estimatedWaitMinutes:
          currentSupportStatus
            .estimatedWaitMinutes
      });
    } catch (error) {
      console.error(
        "Chat message error:",
        {
          name:
            error.name,
          message:
            error.message,
          code:
            error.code,
          command:
            error.command,
          response:
            error.response,
          responseCode:
            error.responseCode
        }
      );

      return res.status(500).json({
        success: false,
        error:
          "Message could not be sent. Please contact Customer Service directly."
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(
  PORT,
  function () {
    console.log(
      `G-Floor chat backend running on port ${PORT}`
    );
  }
);