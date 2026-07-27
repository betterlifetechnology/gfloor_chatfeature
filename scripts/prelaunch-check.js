"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const results = [];

let failures = 0;
let warnings = 0;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function pass(message) {
  results.push({
    status: "PASS",
    message
  });
}

function fail(message) {
  failures += 1;

  results.push({
    status: "FAIL",
    message
  });
}

function warn(message) {
  warnings += 1;

  results.push({
    status: "WARN",
    message
  });
}

function fileExists(relativePath) {
  return fs.existsSync(
    path.join(
      ROOT,
      relativePath
    )
  );
}

function readFile(relativePath) {
  return fs.readFileSync(
    path.join(
      ROOT,
      relativePath
    ),
    "utf8"
  );
}

function checkFile(relativePath) {
  if (
    fileExists(
      relativePath
    )
  ) {
    pass(
      `${relativePath} exists`
    );

    return true;
  }

  fail(
    `${relativePath} is missing`
  );

  return false;
}

function checkSyntax(relativePath) {
  if (
    !fileExists(
      relativePath
    )
  ) {
    return;
  }

  try {
    execSync(
      `node --check "${path.join(
        ROOT,
        relativePath
      )}"`,
      {
        stdio: "pipe"
      }
    );

    pass(
      `${relativePath} JavaScript syntax is valid`
    );
  } catch (error) {
    fail(
      `${relativePath} contains a JavaScript syntax error`
    );
  }
}

/*
|--------------------------------------------------------------------------
| Required Application Files
|--------------------------------------------------------------------------
*/

console.log("");
console.log(
  "=============================================="
);
console.log(
  "G-FLOOR CUSTOM CHAT PRE-LAUNCH CHECK"
);
console.log(
  "=============================================="
);
console.log("");

const requiredFiles = [
  "server.js",
  "package.json",
  ".env.example",
  "public/widget.js",
  "public/knowledge-base.js",
  "public/chat-analytics.js",
  "data/training-queue.json",
  "scripts/import-training-data.js"
];

requiredFiles.forEach(
  checkFile
);

/*
|--------------------------------------------------------------------------
| JavaScript Syntax
|--------------------------------------------------------------------------
*/

[
  "server.js",
  "public/widget.js",
  "public/knowledge-base.js",
  "public/chat-analytics.js",
  "scripts/import-training-data.js"
].forEach(
  checkSyntax
);

/*
|--------------------------------------------------------------------------
| package.json Checks
|--------------------------------------------------------------------------
*/

if (
  fileExists(
    "package.json"
  )
) {
  try {
    const packageJson =
      JSON.parse(
        readFile(
          "package.json"
        )
      );

    pass(
      "package.json contains valid JSON"
    );

    if (
      packageJson.engines &&
      packageJson.engines.node ===
        "20.x"
    ) {
      pass(
        "Node.js 20.x is configured"
      );
    } else {
      warn(
        "Node.js engine is not explicitly set to 20.x"
      );
    }

    if (
      packageJson.scripts &&
      packageJson.scripts.start
    ) {
      pass(
        "npm start script exists"
      );
    } else {
      fail(
        "npm start script is missing"
      );
    }

    if (
      packageJson.scripts &&
      packageJson.scripts[
        "training-import"
      ]
    ) {
      pass(
        "training import script exists"
      );
    } else {
      warn(
        "training-import npm script is missing"
      );
    }
  } catch (error) {
    fail(
      "package.json contains invalid JSON"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Widget Checks
|--------------------------------------------------------------------------
*/

if (
  fileExists(
    "public/widget.js"
  )
) {
  const widget =
    readFile(
      "public/widget.js"
    );

  const widgetChecks = [
    {
      text:
        "gfloor-chat-panel",

      message:
        "Chat panel code detected"
    },

    {
      text:
        "gfloor-chat-question",

      message:
        "Customer question input detected"
    },

    {
      text:
        "gfloor-response-box",

      message:
        "Chat response container detected"
    },

    {
      text:
        "Customer Service",

      message:
        "Customer Service escalation language detected"
    },

    {
      text:
        "/chat/message",

      message:
        "Customer Service handoff endpoint detected"
    }
  ];

  widgetChecks.forEach(
    function (check) {
      if (
        widget.includes(
          check.text
        )
      ) {
        pass(
          check.message
        );
      } else {
        fail(
          `${check.message} is missing`
        );
      }
    }
  );
}

/*
|--------------------------------------------------------------------------
| Analytics Checks
|--------------------------------------------------------------------------
*/

if (
  fileExists(
    "public/chat-analytics.js"
  )
) {
  const analytics =
    readFile(
      "public/chat-analytics.js"
    );

  const analyticsEvents = [
    "gfloor_chat_open",
    "gfloor_chat_question",
    "gfloor_chat_question_result",
    "gfloor_chat_unanswered",
    "gfloor_chat_helpful_yes",
    "gfloor_chat_helpful_no",
    "gfloor_chat_customer_service_request",
    "gfloor_chat_contact_submit"
  ];

  analyticsEvents.forEach(
    function (eventName) {
      if (
        analytics.includes(
          eventName
        )
      ) {
        pass(
          `Analytics event detected: ${eventName}`
        );
      } else {
        warn(
          `Analytics event not detected: ${eventName}`
        );
      }
    }
  );

  if (
    analytics.includes(
      "question_text"
    )
  ) {
    warn(
      "Potential raw question_text analytics parameter detected. Review for GA4 PII risk."
    );
  } else {
    pass(
      "No question_text analytics parameter detected"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Knowledge Base Checks
|--------------------------------------------------------------------------
*/

if (
  fileExists(
    "public/knowledge-base.js"
  )
) {
  const knowledgeBase =
    readFile(
      "public/knowledge-base.js"
    );

  if (
    knowledgeBase.length >
    500
  ) {
    pass(
      "Knowledge base contains content"
    );
  } else {
    fail(
      "Knowledge base appears empty"
    );
  }

  if (
    knowledgeBase.includes(
      "answer"
    )
  ) {
    pass(
      "Knowledge base answer content detected"
    );
  } else {
    warn(
      "Could not detect answer fields in knowledge base"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Training Queue Security
|--------------------------------------------------------------------------
*/

if (
  fileExists(
    "data/training-queue.json"
  )
) {
  try {
    const trainingQueue =
      JSON.parse(
        readFile(
          "data/training-queue.json"
        )
      );

    pass(
      "training-queue.json contains valid JSON"
    );

    if (
      trainingQueue.rules &&
      trainingQueue.rules.autoPublish ===
        false
    ) {
      pass(
        "Training auto-publish is disabled"
      );
    } else {
      fail(
        "Training auto-publish must be disabled"
      );
    }

    if (
      trainingQueue.rules &&
      trainingQueue.rules.requiresHumanApproval ===
        true
    ) {
      pass(
        "Human approval is required for training data"
      );
    } else {
      fail(
        "Training data must require human approval"
      );
    }

    if (
      Array.isArray(
        trainingQueue.items
      )
    ) {
      const unapprovedLiveItems =
        trainingQueue.items.filter(
          function (item) {
            return (
              item.status ===
                "approved" &&
              item.approved !==
                true
            );
          }
        );

      if (
        unapprovedLiveItems.length ===
        0
      ) {
        pass(
          "No inconsistent approved training records detected"
        );
      } else {
        fail(
          `${unapprovedLiveItems.length} inconsistent training approval records detected`
        );
      }
    }
  } catch (error) {
    fail(
      "training-queue.json contains invalid JSON"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Environment Template Checks
|--------------------------------------------------------------------------
*/

if (
  fileExists(
    ".env.example"
  )
) {
  const envExample =
    readFile(
      ".env.example"
    );

  const expectedVariables = [
    "SHOPIFY_ALLOWED_ORIGIN",
    "CUSTOMER_SERVICE_EMAIL",
    "EMAIL_DELIVERY_MODE",
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "GRAPH_SENDER_EMAIL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_FROM",
    "LIVE_AGENT_QUEUE_STATUS",
    "LIVE_AGENT_NORMAL_WAIT",
    "LIVE_AGENT_BUSY_WAIT",
    "NODE_ENV"
  ];

  expectedVariables.forEach(
    function (variableName) {
      if (
        envExample.includes(
          variableName
        )
      ) {
        pass(
          `.env.example includes ${variableName}`
        );
      } else {
        warn(
          `.env.example is missing ${variableName}`
        );
      }
    }
  );
}

/*
|--------------------------------------------------------------------------
| Secret Leak Checks
|--------------------------------------------------------------------------
*/

const filesToScan = [
  "server.js",
  "public/widget.js",
  "public/knowledge-base.js",
  "public/chat-analytics.js",
  ".env.example"
];

const obviousSecretPatterns = [
  {
    pattern:
      /MICROSOFT_CLIENT_SECRET\s*=\s*[A-Za-z0-9_\-.~]{20,}/,

    description:
      "possible Microsoft client secret"
  },

  {
    pattern:
      /SMTP_PASS\s*=\s*(?!your-|YOUR_|example|$)[^\s]+/,

    description:
      "possible SMTP password"
  },

  {
    pattern:
      /ADMIN_TOKEN\s*=\s*(?!create-|your-|YOUR_|$)[^\s]+/,

    description:
      "possible admin token"
  }
];

filesToScan.forEach(
  function (relativePath) {
    if (
      !fileExists(
        relativePath
      )
    ) {
      return;
    }

    const contents =
      readFile(
        relativePath
      );

    obviousSecretPatterns.forEach(
      function (check) {
        if (
          check.pattern.test(
            contents
          )
        ) {
          fail(
            `${relativePath} may contain a real ${check.description}`
          );
        }
      }
    );
  }
);

pass(
  "Secret scan completed"
);

/*
|--------------------------------------------------------------------------
| Microsoft Graph Launch Gate
|--------------------------------------------------------------------------
*/

if (
  process.env
    .MICROSOFT_TENANT_ID &&
  process.env
    .MICROSOFT_CLIENT_ID &&
  process.env
    .MICROSOFT_CLIENT_SECRET &&
  process.env
    .GRAPH_SENDER_EMAIL
) {
  pass(
    "Microsoft Graph environment variables are available locally"
  );
} else {
  warn(
    "Microsoft Graph credentials are not available in this local environment. Final Graph send test is still required before launch."
  );
}

/*
|--------------------------------------------------------------------------
| Final Report
|--------------------------------------------------------------------------
*/

console.log("");

results.forEach(
  function (result) {
    const symbol =
      result.status ===
        "PASS"
        ? "✓"
        : (
            result.status ===
              "WARN"
              ? "!"
              : "X"
          );

    console.log(
      `[${symbol}] ${result.status}: ${result.message}`
    );
  }
);

console.log("");
console.log(
  "----------------------------------------------"
);
console.log(
  `Failures: ${failures}`
);
console.log(
  `Warnings: ${warnings}`
);
console.log(
  "----------------------------------------------"
);
console.log("");

if (
  failures >
  0
) {
  console.error(
    "PRE-LAUNCH CHECK FAILED"
  );

  console.error(
    "Resolve all FAIL items before launching the G-Floor custom chat."
  );

  process.exitCode =
    1;
} else {
  console.log(
    "PRE-LAUNCH CODE CHECK PASSED"
  );

  if (
    warnings >
    0
  ) {
    console.log(
      "Review WARN items before production launch."
    );
  }

  console.log("");
  console.log(
    "IMPORTANT: A successful Microsoft Graph live handoff must still be confirmed before disabling Shopify Inbox."
  );
}