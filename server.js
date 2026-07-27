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

    methods: [
      "GET",
      "POST",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type"
    ]
  })
);

app.use(
  express.json({
    limit: "50kb"
  })
);

app.use(
  express.static("public")
);

/*
|--------------------------------------------------------------------------
| Live Agent Wait Configuration
|--------------------------------------------------------------------------
*/

function getLiveAgentWaitEstimate() {
  const queueStatus =
    (
      process.env.LIVE_AGENT_QUEUE_STATUS ||
      "normal"
    )
      .trim()
      .toLowerCase();

  const normalWait =
    (
      process.env.LIVE_AGENT_NORMAL_WAIT ||
      "2-5"
    ).trim();

  const busyWait =
    (
      process.env.LIVE_AGENT_BUSY_WAIT ||
      "5-10"
    ).trim();

  if (queueStatus === "busy") {
    return {
      queueStatus: "busy",
      estimatedWaitMinutes: busyWait
    };
  }

  return {
    queueStatus: "normal",
    estimatedWaitMinutes: normalWait
  };
}

/*
|--------------------------------------------------------------------------
| Customer Service Business Hours
|--------------------------------------------------------------------------
|
| Monday-Friday
| 8:00 AM-5:00 PM
| Central Time
|
|--------------------------------------------------------------------------
*/

function getCustomerServiceStatus() {
  const now =
    new Date();

  const formattedParts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Chicago",

        weekday:
          "short",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false
      }
    ).formatToParts(now);

  const centralTime =
    {};

  formattedParts.forEach(
    function (part) {
      if (
        part.type !==
        "literal"
      ) {
        centralTime[
          part.type
        ] =
          part.value;
      }
    }
  );

  const weekday =
    centralTime.weekday;

  const hour =
    Number(
      centralTime.hour
    );

  const minute =
    Number(
      centralTime.minute
    );

  const businessDays = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri"
  ];

  const isBusinessDay =
    businessDays.includes(
      weekday
    );

  const minutesSinceMidnight =
    hour * 60 +
    minute;

  const openingMinutes =
    8 * 60;

  const closingMinutes =
    17 * 60;

  const liveAgentAvailable =
    isBusinessDay &&
    minutesSinceMidnight >=
      openingMinutes &&
    minutesSinceMidnight <
      closingMinutes;

  if (
    liveAgentAvailable
  ) {
    const waitEstimate =
      getLiveAgentWaitEstimate();

    return {
      liveAgentAvailable:
        true,

      businessHours:
        "Monday-Friday, 8 AM-5 PM Central Time",

      queueStatus:
        waitEstimate
          .queueStatus,

      estimatedWaitMinutes:
        waitEstimate
          .estimatedWaitMinutes,

      message:
        "A Customer Service representative is currently available. " +
        "Estimated wait time: approximately " +
        waitEstimate.estimatedWaitMinutes +
        " minutes."
    };
  }

  return {
    liveAgentAvailable:
      false,

    businessHours:
      "Monday-Friday, 8 AM-5 PM Central Time",

    queueStatus:
      "offline",

    estimatedWaitMinutes:
      null,

    message:
      "Our Customer Service team is currently offline. " +
      "Live support hours are Monday-Friday, 8 AM-5 PM Central Time. " +
      "Please leave a message and our team will follow up."
  };
}

/*
|--------------------------------------------------------------------------
| Input Helpers
|--------------------------------------------------------------------------
*/

function cleanText(
  value,
  maximumLength
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maximumLength
    );
}

function isValidEmail(
  email
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function cleanTranscript(
  transcript
) {
  if (
    !Array.isArray(
      transcript
    )
  ) {
    return [];
  }

  return transcript
    .slice(0, 100)
    .map(
      function (entry) {
        return {
          role:
            cleanText(
              entry &&
                entry.role,
              30
            ),

          message:
            cleanText(
              entry &&
                entry.message,
              5000
            ),

          timestamp:
            cleanText(
              entry &&
                entry.timestamp,
              100
            )
        };
      }
    )
    .filter(
      function (entry) {
        return (
          entry.role &&
          entry.message
        );
      }
    );
}

function formatTranscript(
  transcript
) {
  if (
    !transcript ||
    transcript.length === 0
  ) {
    return "No transcript available.";
  }

  return transcript
    .map(
      function (entry) {
        const timestamp =
          entry.timestamp
            ? ` [${entry.timestamp}]`
            : "";

        return (
          `${entry.role}${timestamp}:\n` +
          entry.message
        );
      }
    )
    .join(
      "\n\n"
    );
}

/*
|--------------------------------------------------------------------------
| Home
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  function (req, res) {
    res.send(
      "G-Floor chat backend is running."
    );
  }
);

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get(
  "/health",
  function (req, res) {
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
        function (
          variableName
        ) {
          return !process.env[
            variableName
          ];
        }
      );

    const supportStatus =
      getCustomerServiceStatus();

    res.json({
      status:
        "ok",

      app:
        "gfloor-chatfeature",

      serverTime:
        new Date()
          .toISOString(),

      emailConfigured:
        missingEnvironmentVariables
          .length === 0,

      missingEnvironmentVariables:
        missingEnvironmentVariables,

      liveAgentAvailable:
        supportStatus
          .liveAgentAvailable,

      queueStatus:
        supportStatus
          .queueStatus,

      estimatedWaitMinutes:
        supportStatus
          .estimatedWaitMinutes
    });
  }
);

/*
|--------------------------------------------------------------------------
| Chat Status
|--------------------------------------------------------------------------
*/

app.get(
  "/chat/status",
  function (req, res) {
    try {
      const status =
        getCustomerServiceStatus();

      return res
        .status(200)
        .json({
          success:
            true,

          liveAgentAvailable:
            status
              .liveAgentAvailable,

          businessHours:
            status
              .businessHours,

          queueStatus:
            status
              .queueStatus,

          estimatedWaitMinutes:
            status
              .estimatedWaitMinutes,

          message:
            status
              .message
        });
    } catch (error) {
      console.error(
        "Chat status error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          liveAgentAvailable:
            false,

          businessHours:
            "Monday-Friday, 8 AM-5 PM Central Time",

          queueStatus:
            "unavailable",

          estimatedWaitMinutes:
            null,

          message:
            "Customer Service availability could not be checked right now."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Chat Message
|--------------------------------------------------------------------------
*/

app.post(
  "/chat/message",
  async function (
    req,
    res
  ) {
    try {
      const conversationId =
        cleanText(
          req.body
            .conversationId,
          100
        );

      const name =
        cleanText(
          req.body.name,
          100
        );

      const email =
        cleanText(
          req.body.email,
          254
        );

      const phone =
        cleanText(
          req.body.phone,
          50
        );

      const message =
        cleanText(
          req.body.message,
          5000
        );

      const pageUrl =
        cleanText(
          req.body.pageUrl,
          2000
        );

      const pageTitle =
        cleanText(
          req.body.pageTitle,
          300
        );

      const matchedIntent =
        cleanText(
          req.body
            .matchedIntent,
          200
        );

      const matchedQuestion =
        cleanText(
          req.body
            .matchedQuestion,
          500
        );

      const matchScore =
        typeof req.body
          .matchScore ===
        "number"
          ? req.body
              .matchScore
          : null;

      const transcript =
        cleanTranscript(
          req.body
            .transcript
        );

      const requestedLiveAgent =
        req.body
          .requestedLiveAgent ===
          true ||
        req.body
          .requestedLiveAgent ===
          "true";

      const currentSupportStatus =
        getCustomerServiceStatus();

      if (
        !name ||
        !email ||
        !phone ||
        !message
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            error:
              "Name, email, phone, and message are required."
          });
      }

      if (
        !isValidEmail(
          email
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

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
          function (
            variableName
          ) {
            return !process.env[
              variableName
            ];
          }
        );

      if (
        missingEnvironmentVariables
          .length > 0
      ) {
        console.error(
          "Missing email environment variables:",
          missingEnvironmentVariables.join(
            ", "
          )
        );

        return res
          .status(500)
          .json({
            success:
              false,

            error:
              "Email delivery is not fully configured."
          });
      }

      /*
      |--------------------------------------------------------------------------
      | Temporary SMTP Transport
      |--------------------------------------------------------------------------
      |
      | This will be replaced by Microsoft Graph when NetStandard
      | completes the required permissions.
      |
      */

      const transporter =
        nodemailer.createTransport({
          host:
            process.env
              .SMTP_HOST,

          port:
            Number(
              process.env
                .SMTP_PORT ||
              587
            ),

          secure:
            process.env
              .SMTP_SECURE ===
            "true",

          requireTLS:
            true,

          connectionTimeout:
            15000,

          greetingTimeout:
            10000,

          socketTimeout:
            20000,

          auth: {
            user:
              process.env
                .SMTP_USER,

            pass:
              process.env
                .SMTP_PASS
          },

          tls: {
            minVersion:
              "TLSv1.2"
          }
        });

      const formattedTranscript =
        formatTranscript(
          transcript
        );

      const emailBody = [
        "New G-Floor chat message",

        "",

        `Conversation ID: ${
          conversationId ||
          "Not provided"
        }`,

        "",

        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,

        "",

        "Customer message:",
        message,

        "",

        `Page title: ${
          pageTitle ||
          "Not provided"
        }`,

        `Page URL: ${
          pageUrl ||
          "Not provided"
        }`,

        "",

        `Matched intent ID: ${
          matchedIntent ||
          "None"
        }`,

        `Matched question: ${
          matchedQuestion ||
          "None"
        }`,

        `Match score: ${
          matchScore !==
          null
            ? matchScore
            : "None"
        }`,

        "",

        `Customer requested live agent: ${
          requestedLiveAgent
            ? "Yes"
            : "No"
        }`,

        `Live agent available at submission: ${
          currentSupportStatus
            .liveAgentAvailable
            ? "Yes"
            : "No"
        }`,

        `Queue status: ${
          currentSupportStatus
            .queueStatus
        }`,

        `Estimated wait time: ${
          currentSupportStatus
            .estimatedWaitMinutes
            ? currentSupportStatus
                .estimatedWaitMinutes +
              " minutes"
            : "Not available"
        }`,

        `Business hours: ${
          currentSupportStatus
            .businessHours
        }`,

        "",

        "Conversation Transcript",
        "-----------------------",
        formattedTranscript
      ].join(
        "\n"
      );

      const emailResult =
        await transporter
          .sendMail({
            from:
              process.env
                .SMTP_FROM,

            to:
              process.env
                .CUSTOMER_SERVICE_EMAIL,

            replyTo:
              email,

            subject:
              `[${conversationId || "G-Floor Chat"}] New G-Floor Chat Message from ${name}`,

            text:
              emailBody
          });

      console.log(
        "Chat email sent successfully:",
        {
          conversationId:
            conversationId,

          messageId:
            emailResult
              .messageId
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          conversationId:
            conversationId,

          message:
            "Your message was sent successfully.",

          liveAgentAvailable:
            currentSupportStatus
              .liveAgentAvailable,

          queueStatus:
            currentSupportStatus
              .queueStatus,

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

      return res
        .status(500)
        .json({
          success:
            false,

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