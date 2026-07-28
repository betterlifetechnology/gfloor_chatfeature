"use strict";

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const adminReviewsRouter =
  require(
    "./routes/admin-reviews"
  );

const approvedKnowledgeRouter =
  require(
    "./routes/approved-knowledge"
  );

require("dotenv").config();

const app = express();

const PORT =
  process.env.PORT ||
  3000;

/*
|--------------------------------------------------------------------------
| Allowed Shopify Origins
|--------------------------------------------------------------------------
*/

const allowedOrigins = [
  "https://gfloor.com",
  "https://www.gfloor.com"
];

if (
  process.env.SHOPIFY_ALLOWED_ORIGIN &&
  !allowedOrigins.includes(
    process.env.SHOPIFY_ALLOWED_ORIGIN
  )
) {
  allowedOrigins.push(
    process.env.SHOPIFY_ALLOWED_ORIGIN
  );
}

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: function (
      origin,
      callback
    ) {
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      if (
        allowedOrigins.includes(
          origin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      console.error(
        "Blocked CORS origin:",
        origin
      );

      return callback(
        new Error(
          "Origin is not allowed by CORS."
        )
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Admin-Token"
    ]
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.static(
    "public"
  )
);

/*
|--------------------------------------------------------------------------
| STEP 20B: Protected Knowledge Review Admin API
|--------------------------------------------------------------------------
*/

app.use(
  "/admin",
  adminReviewsRouter
);

/*
|--------------------------------------------------------------------------
| STEP 20G: Human-Approved Chat Knowledge
|--------------------------------------------------------------------------
|
| PUBLIC READ-ONLY ENDPOINTS
|
| /chat/approved-knowledge
| /chat/approved-knowledge/health
| /chat/approved-knowledge.js
|
| The router reads ONLY from chat_active_knowledge.
|--------------------------------------------------------------------------
*/

app.use(
  "/chat",
  approvedKnowledgeRouter
);

/*
|--------------------------------------------------------------------------
| Email Delivery Configuration
|--------------------------------------------------------------------------
|
| Supported modes:
|
| graph
| smtp
| auto
|
| "auto" uses Microsoft Graph when Graph credentials are available and
| falls back to SMTP when Graph has not been configured.
|--------------------------------------------------------------------------
*/

function getEmailDeliveryMode() {
  const mode =
    String(
      process.env.EMAIL_DELIVERY_MODE ||
      "auto"
    )
      .trim()
      .toLowerCase();

  if (
    [
      "graph",
      "smtp",
      "auto"
    ].includes(mode)
  ) {
    return mode;
  }

  return "auto";
}

/*
|--------------------------------------------------------------------------
| Microsoft Graph Configuration
|--------------------------------------------------------------------------
*/

function getGraphConfiguration() {
  return {
    tenantId:
      String(
        process.env.MICROSOFT_TENANT_ID ||
        ""
      ).trim(),

    clientId:
      String(
        process.env.MICROSOFT_CLIENT_ID ||
        ""
      ).trim(),

    clientSecret:
      String(
        process.env.MICROSOFT_CLIENT_SECRET ||
        ""
      ).trim(),

    senderEmail:
      String(
        process.env.GRAPH_SENDER_EMAIL ||
        process.env.CUSTOMER_SERVICE_EMAIL ||
        ""
      ).trim(),

    customerServiceEmail:
      String(
        process.env.CUSTOMER_SERVICE_EMAIL ||
        ""
      ).trim()
  };
}

function getMissingGraphEnvironmentVariables() {
  const config =
    getGraphConfiguration();

  const missing = [];

  if (
    !config.tenantId
  ) {
    missing.push(
      "MICROSOFT_TENANT_ID"
    );
  }

  if (
    !config.clientId
  ) {
    missing.push(
      "MICROSOFT_CLIENT_ID"
    );
  }

  if (
    !config.clientSecret
  ) {
    missing.push(
      "MICROSOFT_CLIENT_SECRET"
    );
  }

  if (
    !config.senderEmail
  ) {
    missing.push(
      "GRAPH_SENDER_EMAIL"
    );
  }

  if (
    !config.customerServiceEmail
  ) {
    missing.push(
      "CUSTOMER_SERVICE_EMAIL"
    );
  }

  return missing;
}

function isGraphConfigured() {
  return (
    getMissingGraphEnvironmentVariables()
      .length === 0
  );
}

/*
|--------------------------------------------------------------------------
| SMTP Configuration
|--------------------------------------------------------------------------
*/

function getMissingSmtpEnvironmentVariables() {
  const required = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "CUSTOMER_SERVICE_EMAIL"
  ];

  return required.filter(
    function (
      variableName
    ) {
      return !process.env[
        variableName
      ];
    }
  );
}

function isSmtpConfigured() {
  return (
    getMissingSmtpEnvironmentVariables()
      .length === 0
  );
}

/*
|--------------------------------------------------------------------------
| Determine Active Email Transport
|--------------------------------------------------------------------------
*/

function getActiveEmailTransport() {
  const requestedMode =
    getEmailDeliveryMode();

  if (
    requestedMode ===
    "graph"
  ) {
    return {
      requestedMode:
        requestedMode,

      transport:
        isGraphConfigured()
          ? "graph"
          : "unavailable",

      configured:
        isGraphConfigured()
    };
  }

  if (
    requestedMode ===
    "smtp"
  ) {
    return {
      requestedMode:
        requestedMode,

      transport:
        isSmtpConfigured()
          ? "smtp"
          : "unavailable",

      configured:
        isSmtpConfigured()
    };
  }

  /*
   * AUTO:
   * Prefer Graph.
   */

  if (
    isGraphConfigured()
  ) {
    return {
      requestedMode:
        "auto",

      transport:
        "graph",

      configured:
        true
    };
  }

  if (
    isSmtpConfigured()
  ) {
    return {
      requestedMode:
        "auto",

      transport:
        "smtp",

      configured:
        true
    };
  }

  return {
    requestedMode:
      "auto",

    transport:
      "unavailable",

    configured:
      false
  };
}

/*
|--------------------------------------------------------------------------
| Live Agent Wait Configuration
|--------------------------------------------------------------------------
*/

function getLiveAgentWaitEstimate() {
  const queueStatus =
    String(
      process.env.LIVE_AGENT_QUEUE_STATUS ||
      "normal"
    )
      .trim()
      .toLowerCase();

  const normalWait =
    String(
      process.env.LIVE_AGENT_NORMAL_WAIT ||
      "2-5"
    ).trim();

  const busyWait =
    String(
      process.env.LIVE_AGENT_BUSY_WAIT ||
      "5-10"
    ).trim();

  if (
    queueStatus ===
    "busy"
  ) {
    return {
      queueStatus:
        "busy",

      estimatedWaitMinutes:
        busyWait
    };
  }

  return {
    queueStatus:
      "normal",

    estimatedWaitMinutes:
      normalWait
  };
}

/*
|--------------------------------------------------------------------------
| Customer Service Business Hours
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
    ).formatToParts(
      now
    );

  const centralTime =
    {};

  formattedParts.forEach(
    function (
      part
    ) {
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
    (
      hour * 60
    ) +
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
        waitEstimate.queueStatus,

      estimatedWaitMinutes:
        waitEstimate
          .estimatedWaitMinutes,

      message:
        "A Customer Service representative is currently available. " +
        "Estimated wait time: approximately " +
        waitEstimate
          .estimatedWaitMinutes +
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

function cleanBoolean(
  value
) {
  return (
    value === true ||
    value === "true"
  );
}

function cleanNumber(
  value
) {
  if (
    typeof value ===
    "number" &&
    Number.isFinite(
      value
    )
  ) {
    return value;
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Transcript Sanitizer
|--------------------------------------------------------------------------
*/

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
    .slice(
      0,
      100
    )
    .map(
      function (
        entry
      ) {
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
      function (
        entry
      ) {
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
    transcript.length ===
      0
  ) {
    return (
      "No transcript available."
    );
  }

  return transcript
    .map(
      function (
        entry
      ) {
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
| Shopify Page / Product Context Sanitizer
|--------------------------------------------------------------------------
*/

function cleanPageContext(
  pageContext
) {
  if (
    !pageContext ||
    typeof pageContext !==
      "object"
  ) {
    return {
      pageType: "",
      pageTitle: "",
      pageUrl: "",
      referrer: "",

      productTitle: "",
      productHandle: "",
      productId: "",

      selectedColor: "",
      selectedSize: "",
      exactVariantMatch: false,

      variantId: "",
      variantTitle: "",
      sku: "",

      available: false,
      price: null,

      vendor: "",
      productType: "",

      collectionHandle: "",
      collectionTitle: ""
    };
  }

  return {
    pageType:
      cleanText(
        pageContext.pageType,
        100
      ),

    pageTitle:
      cleanText(
        pageContext.pageTitle,
        500
      ),

    pageUrl:
      cleanText(
        pageContext.pageUrl,
        2000
      ),

    referrer:
      cleanText(
        pageContext.referrer,
        2000
      ),

    productTitle:
      cleanText(
        pageContext.productTitle,
        500
      ),

    productHandle:
      cleanText(
        pageContext.productHandle,
        300
      ),

    productId:
      cleanText(
        String(
          pageContext.productId ||
          ""
        ),
        100
      ),

    selectedColor:
      cleanText(
        pageContext.selectedColor,
        200
      ),

    selectedSize:
      cleanText(
        pageContext.selectedSize,
        200
      ),

    exactVariantMatch:
      cleanBoolean(
        pageContext
          .exactVariantMatch
      ),

    variantId:
      cleanText(
        String(
          pageContext.variantId ||
          ""
        ),
        100
      ),

    variantTitle:
      cleanText(
        pageContext.variantTitle,
        500
      ),

    sku:
      cleanText(
        pageContext.sku,
        200
      ),

    available:
      cleanBoolean(
        pageContext.available
      ),

    price:
      cleanNumber(
        pageContext.price
      ),

    vendor:
      cleanText(
        pageContext.vendor,
        300
      ),

    productType:
      cleanText(
        pageContext.productType,
        300
      ),

    collectionHandle:
      cleanText(
        pageContext.collectionHandle,
        300
      ),

    collectionTitle:
      cleanText(
        pageContext.collectionTitle,
        500
      )
  };
}

function formatPriceFromCents(
  cents
) {
  if (
    typeof cents !==
      "number" ||
    !Number.isFinite(
      cents
    )
  ) {
    return (
      "Not detected"
    );
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD"
    }
  ).format(
    cents / 100
  );
}

function formatPageContext(
  context
) {
  return [
    `Page type: ${
      context.pageType ||
      "Not detected"
    }`,

    `Page title: ${
      context.pageTitle ||
      "Not provided"
    }`,

    `Page URL: ${
      context.pageUrl ||
      "Not provided"
    }`,

    `Referrer: ${
      context.referrer ||
      "Not provided"
    }`,

    "",

    `Product title: ${
      context.productTitle ||
      "Not detected"
    }`,

    `Product handle: ${
      context.productHandle ||
      "Not detected"
    }`,

    `Product ID: ${
      context.productId ||
      "Not detected"
    }`,

    `Selected color: ${
      context.selectedColor ||
      "Not detected"
    }`,

    `Selected size: ${
      context.selectedSize ||
      "Not detected"
    }`,

    `Exact purchasable variant match: ${
      context.exactVariantMatch
        ? "Yes"
        : "No"
    }`,

    `Variant ID: ${
      context.variantId ||
      "Not detected"
    }`,

    `Variant title: ${
      context.variantTitle ||
      "Not detected"
    }`,

    `SKU: ${
      context.sku ||
      "Not detected"
    }`,

    `Available: ${
      context.available
        ? "Yes"
        : "No"
    }`,

    `Price: ${
      formatPriceFromCents(
        context.price
      )
    }`,

    `Vendor: ${
      context.vendor ||
      "Not detected"
    }`,

    `Product type: ${
      context.productType ||
      "Not detected"
    }`,

    `Collection handle: ${
      context.collectionHandle ||
      "Not detected"
    }`,

    `Collection title: ${
      context.collectionTitle ||
      "Not detected"
    }`
  ].join(
    "\n"
  );
}

/*
|--------------------------------------------------------------------------
| Microsoft Graph OAuth Token
|--------------------------------------------------------------------------
*/

async function getMicrosoftGraphAccessToken() {
  const config =
    getGraphConfiguration();

  const missing =
    getMissingGraphEnvironmentVariables();

  if (
    missing.length >
    0
  ) {
    throw new Error(
      "Microsoft Graph is missing configuration: " +
      missing.join(
        ", "
      )
    );
  }

  const tokenUrl =
    "https://login.microsoftonline.com/" +
    encodeURIComponent(
      config.tenantId
    ) +
    "/oauth2/v2.0/token";

  const body =
    new URLSearchParams();

  body.set(
    "client_id",
    config.clientId
  );

  body.set(
    "client_secret",
    config.clientSecret
  );

  body.set(
    "scope",
    "https://graph.microsoft.com/.default"
  );

  body.set(
    "grant_type",
    "client_credentials"
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      function () {
        controller.abort();
      },
      15000
    );

  try {
    const response =
      await fetch(
        tokenUrl,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body:
            body.toString(),

          signal:
            controller.signal
        }
      );

    const result =
      await response.json();

    if (
      !response.ok
    ) {
      const description =
        result &&
        result.error_description
          ? result
              .error_description
          : (
              result &&
              result.error
                ? result.error
                : "Unknown Microsoft authentication error."
            );

      throw new Error(
        "Microsoft Graph authentication failed: " +
        description
      );
    }

    if (
      !result.access_token
    ) {
      throw new Error(
        "Microsoft Graph authentication did not return an access token."
      );
    }

    return (
      result.access_token
    );
  } finally {
    clearTimeout(
      timeout
    );
  }
}

/*
|--------------------------------------------------------------------------
| Microsoft Graph Mail Sender
|--------------------------------------------------------------------------
*/

async function sendWithMicrosoftGraph({
  subject,
  body,
  replyTo
}) {
  const config =
    getGraphConfiguration();

  const accessToken =
    await getMicrosoftGraphAccessToken();

  const endpoint =
    "https://graph.microsoft.com/v1.0/users/" +
    encodeURIComponent(
      config.senderEmail
    ) +
    "/sendMail";

  const graphMessage = {
    message: {
      subject:
        subject,

      body: {
        contentType:
          "Text",

        content:
          body
      },

      toRecipients: [
        {
          emailAddress: {
            address:
              config
                .customerServiceEmail
          }
        }
      ]
    },

    saveToSentItems:
      true
  };

  if (
    replyTo &&
    isValidEmail(
      replyTo
    )
  ) {
    graphMessage
      .message
      .replyTo = [
        {
          emailAddress: {
            address:
              replyTo
          }
        }
      ];
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      function () {
        controller.abort();
      },
      20000
    );

  try {
    const response =
      await fetch(
        endpoint,
        {
          method:
            "POST",

          headers: {
            Authorization:
              "Bearer " +
              accessToken,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              graphMessage
            ),

          signal:
            controller.signal
        }
      );

    if (
      response.status !==
      202
    ) {
      let errorBody =
        "";

      try {
        errorBody =
          await response.text();
      } catch (
        readError
      ) {
        errorBody =
          "";
      }

      throw new Error(
        "Microsoft Graph sendMail failed with HTTP " +
        response.status +
        (
          errorBody
            ? ": " +
              errorBody
            : ""
        )
      );
    }

    return {
      transport:
        "graph",

      status:
        response.status,

      messageId:
        null
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

/*
|--------------------------------------------------------------------------
| SMTP Fallback Sender
|--------------------------------------------------------------------------
*/

async function sendWithSmtp({
  subject,
  body,
  replyTo
}) {
  const missing =
    getMissingSmtpEnvironmentVariables();

  if (
    missing.length >
    0
  ) {
    throw new Error(
      "SMTP is missing configuration: " +
      missing.join(
        ", "
      )
    );
  }

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

  const result =
    await transporter.sendMail({
      from:
        process.env
          .SMTP_FROM,

      to:
        process.env
          .CUSTOMER_SERVICE_EMAIL,

      replyTo:
        replyTo,

      subject:
        subject,

      text:
        body
    });

  return {
    transport:
      "smtp",

    status:
      200,

    messageId:
      result.messageId ||
      null
  };
}

/*
|--------------------------------------------------------------------------
| Unified Email Sender
|--------------------------------------------------------------------------
*/

async function sendCustomerServiceEmail({
  subject,
  body,
  replyTo
}) {
  const transport =
    getActiveEmailTransport();

  if (
    !transport.configured
  ) {
    throw new Error(
      "No configured email delivery transport is available."
    );
  }

  if (
    transport.transport ===
    "graph"
  ) {
    return sendWithMicrosoftGraph({
      subject:
        subject,

      body:
        body,

      replyTo:
        replyTo
    });
  }

  if (
    transport.transport ===
    "smtp"
  ) {
    return sendWithSmtp({
      subject:
        subject,

      body:
        body,

      replyTo:
        replyTo
    });
  }

  throw new Error(
    "Email transport could not be determined."
  );
}

/*
|--------------------------------------------------------------------------
| Home
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  function (
    req,
    res
  ) {
    res.send(
      "G-Floor chat backend is running."
    );
  }
);

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
  "/health",
  function (
    req,
    res
  ) {
    const supportStatus =
      getCustomerServiceStatus();

    const emailTransport =
      getActiveEmailTransport();

    return res.json({
      status:
        "ok",

      app:
        "gfloor-chatfeature",

      serverTime:
        new Date()
          .toISOString(),

      emailDeliveryMode:
        getEmailDeliveryMode(),

      activeEmailTransport:
        emailTransport.transport,

      emailConfigured:
        emailTransport.configured,

      graphConfigured:
        isGraphConfigured(),

      graphMissingEnvironmentVariables:
        getMissingGraphEnvironmentVariables(),

      smtpConfigured:
        isSmtpConfigured(),

      smtpMissingEnvironmentVariables:
        getMissingSmtpEnvironmentVariables(),

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
| Graph Health
|--------------------------------------------------------------------------
|
| This endpoint checks configuration only.
| It does NOT send an email.
|--------------------------------------------------------------------------
*/

app.get(
  "/health/graph",
  function (
    req,
    res
  ) {
    const missing =
      getMissingGraphEnvironmentVariables();

    return res
      .status(
        missing.length ===
          0
          ? 200
          : 503
      )
      .json({
        success:
          missing.length ===
          0,

        configured:
          missing.length ===
          0,

        senderEmail:
          process.env
            .GRAPH_SENDER_EMAIL ||
          "",

        customerServiceEmail:
          process.env
            .CUSTOMER_SERVICE_EMAIL ||
          "",

        missingEnvironmentVariables:
          missing
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
  function (
    req,
    res
  ) {
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
    } catch (
      error
    ) {
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
| Chat Message / Customer Service Handoff
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
          500
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
        cleanNumber(
          req.body
            .matchScore
        );

      const confidenceScore =
        cleanNumber(
          req.body
            .confidenceScore
        );

      const confidenceLevel =
        cleanText(
          req.body
            .confidenceLevel,
          50
        );

      const escalationRequired =
        cleanBoolean(
          req.body
            .escalationRequired
        );

      const escalationRecommended =
        cleanBoolean(
          req.body
            .escalationRecommended
        );

      const escalationReason =
        cleanText(
          req.body
            .escalationReason,
          1000
        );

      const transcript =
        cleanTranscript(
          req.body
            .transcript
        );

      const pageContext =
        cleanPageContext(
          req.body
            .pageContext
        );

      const requestedLiveAgent =
        cleanBoolean(
          req.body
            .requestedLiveAgent
        );

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

      const emailTransport =
        getActiveEmailTransport();

      if (
        !emailTransport
          .configured
      ) {
        console.error(
          "No email delivery transport is configured.",
          {
            mode:
              getEmailDeliveryMode(),

            graphMissing:
              getMissingGraphEnvironmentVariables(),

            smtpMissing:
              getMissingSmtpEnvironmentVariables()
          }
        );

        return res
          .status(503)
          .json({
            success:
              false,

            error:
              "Customer Service message delivery is not configured."
          });
      }

      const formattedTranscript =
        formatTranscript(
          transcript
        );

      const formattedPageContext =
        formatPageContext(
          pageContext
        );

      const emailBody = [
        "New G-Floor chat message",

        "",

        `Conversation ID: ${
          conversationId ||
          "Not provided"
        }`,

        "",

        "CUSTOMER",
        "--------",

        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,

        "",

        "Customer message:",
        message,

        "",

        "SHOPIFY PAGE / PRODUCT CONTEXT",
        "------------------------------",

        formattedPageContext,

        "",

        "CHAT CONFIDENCE / ESCALATION",
        "----------------------------",

        `Confidence score: ${
          confidenceScore !==
          null
            ? confidenceScore
            : "Not provided"
        }`,

        `Confidence level: ${
          confidenceLevel ||
          "Not provided"
        }`,

        `Escalation required: ${
          escalationRequired
            ? "Yes"
            : "No"
        }`,

        `Escalation recommended: ${
          escalationRecommended
            ? "Yes"
            : "No"
        }`,

        `Escalation reason: ${
          escalationReason ||
          "None"
        }`,

        "",

        "KNOWLEDGE BASE MATCH",
        "--------------------",

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

        "CUSTOMER SERVICE STATUS",
        "-----------------------",

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

        "MESSAGE DELIVERY",
        "----------------",

        `Requested delivery mode: ${
          emailTransport
            .requestedMode
        }`,

        `Active transport: ${
          emailTransport
            .transport
        }`,

        "",

        "CONVERSATION TRANSCRIPT",
        "-----------------------",

        formattedTranscript,

        "",

        "CUSTOMER REPLY",
        "--------------",

        "Reply directly to this email to respond to the customer."
      ].join(
        "\n"
      );

      const subject =
        `[${conversationId || "G-Floor Chat"}] ` +
        (
          requestedLiveAgent
            ? "LIVE AGENT REQUEST"
            : "G-Floor Chat Message"
        ) +
        ` from ${name}`;

      const deliveryResult =
        await sendCustomerServiceEmail({
          subject:
            subject,

          body:
            emailBody,

          replyTo:
            email
        });

      console.log(
        "Chat handoff sent successfully:",
        {
          conversationId:
            conversationId,

          transport:
            deliveryResult
              .transport,

          productHandle:
            pageContext
              .productHandle,

          variantId:
            pageContext
              .variantId,

          status:
            deliveryResult
              .status,

          messageId:
            deliveryResult
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

          deliveryTransport:
            deliveryResult
              .transport,

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
    } catch (
      error
    ) {
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
            error.responseCode,

          stack:
            process.env
              .NODE_ENV ===
            "development"
              ? error.stack
              : undefined
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
    const emailTransport =
      getActiveEmailTransport();

    console.log(
      `G-Floor chat backend running on port ${PORT}`
    );

    console.log(
      "Email delivery:",
      {
        requestedMode:
          emailTransport
            .requestedMode,

        activeTransport:
          emailTransport
            .transport,

        graphConfigured:
          isGraphConfigured(),

        smtpConfigured:
          isSmtpConfigured()
      }
    );

    console.log(
      "Approved knowledge API:",
      {
        mounted:
          true,

        basePath:
          "/chat/approved-knowledge"
      }
    );
  }
);