"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Custom Chat Pre-Launch Check
|--------------------------------------------------------------------------
|
| Step 20L
|
| Validates:
|
| - required project files
| - JavaScript syntax
| - package configuration
| - environment-variable documentation
| - accidental credential exposure
| - admin authentication protection
| - knowledge approval safety
| - analytics foundation
| - Microsoft Graph launch status
|
|--------------------------------------------------------------------------
*/

const fs =
  require("fs");

const path =
  require("path");

const {
  execFileSync
} =
  require("child_process");

const ROOT =
  path.resolve(
    __dirname,
    ".."
  );

let failures =
  0;

let warnings =
  0;

const results =
  [];

/*
|--------------------------------------------------------------------------
| Reporting
|--------------------------------------------------------------------------
*/

function addResult(
  type,
  message
) {
  results.push({
    type,
    message
  });

  if (
    type ===
    "FAIL"
  ) {
    failures +=
      1;
  }

  if (
    type ===
    "WARN"
  ) {
    warnings +=
      1;
  }
}

function pass(
  message
) {
  addResult(
    "PASS",
    message
  );
}

function fail(
  message
) {
  addResult(
    "FAIL",
    message
  );
}

function warn(
  message
) {
  addResult(
    "WARN",
    message
  );
}

/*
|--------------------------------------------------------------------------
| File Helpers
|--------------------------------------------------------------------------
*/

function resolvePath(
  relativePath
) {
  return path.join(
    ROOT,
    relativePath
  );
}

function exists(
  relativePath
) {
  return fs.existsSync(
    resolvePath(
      relativePath
    )
  );
}

function read(
  relativePath
) {
  return fs.readFileSync(
    resolvePath(
      relativePath
    ),
    "utf8"
  );
}

function requireFile(
  relativePath
) {
  if (
    exists(
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

function checkJavaScriptSyntax(
  relativePath
) {
  if (
    !exists(
      relativePath
    )
  ) {
    return;
  }

  try {
    execFileSync(
      process.execPath,
      [
        "--check",
        resolvePath(
          relativePath
        )
      ],
      {
        stdio:
          "pipe"
      }
    );

    pass(
      `${relativePath} syntax is valid`
    );
  } catch (
    error
  ) {
    fail(
      `${relativePath} contains a JavaScript syntax error`
    );
  }
}

/*
|--------------------------------------------------------------------------
| Environment Parser
|--------------------------------------------------------------------------
*/

function parseEnvironmentFile(
  contents
) {
  const variables =
    {};

  String(
    contents ||
    ""
  )
    .split(
      /\r?\n/
    )
    .forEach(
      function (
        originalLine
      ) {
        const line =
          originalLine.trim();

        if (
          !line ||
          line.startsWith(
            "#"
          )
        ) {
          return;
        }

        const equalsIndex =
          line.indexOf(
            "="
          );

        if (
          equalsIndex <
          1
        ) {
          return;
        }

        const variableName =
          line
            .slice(
              0,
              equalsIndex
            )
            .trim();

        const variableValue =
          line
            .slice(
              equalsIndex +
              1
            )
            .trim();

        if (
          /^[A-Z][A-Z0-9_]*$/.test(
            variableName
          )
        ) {
          variables[
            variableName
          ] =
            variableValue;
        }
      }
    );

  return variables;
}

function removeQuotes(
  value
) {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (
    text.length >=
      2 &&
    (
      (
        text.startsWith(
          "\""
        ) &&
        text.endsWith(
          "\""
        )
      ) ||
      (
        text.startsWith(
          "'"
        ) &&
        text.endsWith(
          "'"
        )
      )
    )
  ) {
    return text.slice(
      1,
      -1
    );
  }

  return text;
}

function isBlankOrPlaceholder(
  value
) {
  const text =
    removeQuotes(
      value
    )
      .trim()
      .toLowerCase();

  if (
    !text
  ) {
    return true;
  }

  return (
    text ===
      "placeholder" ||
    text ===
      "replace-me" ||
    text ===
      "replace_me" ||
    text ===
      "set-in-render" ||
    text ===
      "set_in_render" ||
    text ===
      "your-secret" ||
    text ===
      "your_secret" ||
    text ===
      "your-token" ||
    text ===
      "your_token" ||
    text.startsWith(
      "your-"
    ) ||
    text.startsWith(
      "your_"
    ) ||
    text.startsWith(
      "example-"
    ) ||
    text.startsWith(
      "example_"
    ) ||
    text.includes(
      "${"
    )
  );
}

/*
|--------------------------------------------------------------------------
| Header
|--------------------------------------------------------------------------
*/

console.log(
  ""
);

console.log(
  "=============================================="
);

console.log(
  "G-FLOOR CUSTOM CHAT PRE-LAUNCH CHECK"
);

console.log(
  "=============================================="
);

console.log(
  ""
);

/*
|--------------------------------------------------------------------------
| Required Files
|--------------------------------------------------------------------------
*/

const requiredFiles =
  [
    "server.js",
    "package.json",
    ".env.example",
    ".gitignore",

    "db/review-db.js",
    "db/schema-review.sql",
    "db/schema-reporting.sql",
    "db/schema-knowledge-status.sql",

    "routes/admin-reviews.js",
    "routes/admin-reporting.js",
    "routes/admin-knowledge-status.js",
    "routes/approved-knowledge.js",
    "routes/approved-knowledge-events.js",

    "public/widget.js",
    "public/knowledge-base.js",
    "public/chat-analytics.js",
    "public/chat-approved-analytics.js",
    "public/chat-approved-reporting.js",
    "public/chat-mascot.js",
    "public/chat-smalltalk.js",

    "public/admin-review.html",
    "public/admin-review.js",
    "public/admin-review.css",

    "public/admin-report.html",
    "public/admin-report.js",
    "public/admin-report.css",

    "data/training-queue.json",

    "scripts/import-training-data.js",
    "scripts/init-review-db.js",
    "scripts/init-reporting-db.js",
    "scripts/init-knowledge-status-db.js"
  ];

requiredFiles.forEach(
  requireFile
);

/*
|--------------------------------------------------------------------------
| JavaScript Syntax
|--------------------------------------------------------------------------
*/

const javascriptFiles =
  [
    "server.js",

    "db/review-db.js",

    "routes/admin-reviews.js",
    "routes/admin-reporting.js",
    "routes/admin-knowledge-status.js",
    "routes/approved-knowledge.js",
    "routes/approved-knowledge-events.js",

    "public/widget.js",
    "public/knowledge-base.js",
    "public/chat-analytics.js",
    "public/chat-approved-analytics.js",
    "public/chat-approved-reporting.js",
    "public/chat-mascot.js",
    "public/chat-smalltalk.js",
    "public/admin-review.js",
    "public/admin-report.js",

    "scripts/import-training-data.js",
    "scripts/init-review-db.js",
    "scripts/init-reporting-db.js",
    "scripts/init-knowledge-status-db.js"
  ];

javascriptFiles.forEach(
  checkJavaScriptSyntax
);

/*
|--------------------------------------------------------------------------
| package.json
|--------------------------------------------------------------------------
*/

if (
  exists(
    "package.json"
  )
) {
  try {
    const packageJson =
      JSON.parse(
        read(
          "package.json"
        )
      );

    pass(
      "package.json contains valid JSON"
    );

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
      packageJson.scripts.prelaunch
    ) {
      pass(
        "npm prelaunch script exists"
      );
    } else {
      fail(
        "npm prelaunch script is missing"
      );
    }

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
        "Node.js engine is not explicitly configured as 20.x"
      );
    }
  } catch (
    error
  ) {
    fail(
      "package.json contains invalid JSON"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Administrative Authentication
|--------------------------------------------------------------------------
|
| Authentication can live in server.js or inside protected route files.
|
|--------------------------------------------------------------------------
*/

const administrativeFiles =
  [
    "server.js",
    "routes/admin-reviews.js",
    "routes/admin-reporting.js",
    "routes/admin-knowledge-status.js"
  ];

let administrativeCode =
  "";

administrativeFiles.forEach(
  function (
    relativePath
  ) {
    if (
      exists(
        relativePath
      )
    ) {
      administrativeCode +=
        "\n" +
        read(
          relativePath
        );
    }
  }
);

const adminTokenDetected =
  administrativeCode.includes(
    "ADMIN_TOKEN"
  );

const adminHeaderDetected =
  administrativeCode.includes(
    "X-Admin-Token"
  ) ||
  administrativeCode.includes(
    "x-admin-token"
  );

const unauthorizedResponseDetected =
  administrativeCode.includes(
    "Unauthorized"
  ) ||
  administrativeCode.includes(
    "401"
  );

if (
  adminTokenDetected &&
  adminHeaderDetected &&
  unauthorizedResponseDetected
) {
  pass(
    "Administrative token protection detected"
  );
} else {
  fail(
    "Administrative token protection was not detected"
  );
}

if (
  administrativeCode.includes(
    "timingSafeEqual"
  )
) {
  pass(
    "Timing-safe administrative token comparison detected"
  );
} else {
  warn(
    "Timing-safe administrative token comparison was not detected"
  );
}

if (
  administrativeCode.includes(
    "no-store"
  ) ||
  administrativeCode.includes(
    "noStore"
  )
) {
  pass(
    "Administrative no-store protection detected"
  );
} else {
  warn(
    "Administrative no-store protection was not detected"
  );
}

/*
|--------------------------------------------------------------------------
| Knowledge Status Controls
|--------------------------------------------------------------------------
*/

if (
  exists(
    "routes/admin-knowledge-status.js"
  )
) {
  const statusCode =
    read(
      "routes/admin-knowledge-status.js"
    );

  if (
    statusCode.includes(
      "deactivate"
    ) &&
    statusCode.includes(
      "reactivate"
    )
  ) {
    pass(
      "Approved knowledge deactivate/reactivate endpoints detected"
    );
  } else {
    fail(
      "Approved knowledge status endpoints are incomplete"
    );
  }
}

if (
  exists(
    "public/admin-review.js"
  )
) {
  const dashboardCode =
    read(
      "public/admin-review.js"
    );

  if (
    dashboardCode.includes(
      "submitKnowledgeStatusChange"
    ) &&
    dashboardCode.includes(
      "loadKnowledgeStatusCounts"
    )
  ) {
    pass(
      "Approved knowledge dashboard controls detected"
    );
  } else {
    fail(
      "Approved knowledge dashboard controls were not detected"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Training Approval Rules
|--------------------------------------------------------------------------
*/

if (
  exists(
    "data/training-queue.json"
  )
) {
  try {
    const trainingQueue =
      JSON.parse(
        read(
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
        "Human approval is required for training knowledge"
      );
    } else {
      fail(
        "Training knowledge must require human approval"
      );
    }
  } catch (
    error
  ) {
    fail(
      "training-queue.json contains invalid JSON"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Analytics
|--------------------------------------------------------------------------
*/

if (
  exists(
    "public/chat-analytics.js"
  )
) {
  const analyticsCode =
    read(
      "public/chat-analytics.js"
    );

  const requiredAnalyticsEvents =
    [
      "gfloor_chat_open",
      "gfloor_chat_question",
      "gfloor_chat_question_result",
      "gfloor_chat_unanswered",
      "gfloor_chat_helpful_yes",
      "gfloor_chat_helpful_no",
      "gfloor_chat_customer_service_request"
    ];

  requiredAnalyticsEvents.forEach(
    function (
      eventName
    ) {
      if (
        analyticsCode.includes(
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
    analyticsCode.includes(
      "question_text"
    )
  ) {
    warn(
      "Potential raw question_text analytics parameter detected"
    );
  } else {
    pass(
      "No raw question_text analytics parameter detected"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Environment Template
|--------------------------------------------------------------------------
*/

let environmentVariables =
  {};

if (
  exists(
    ".env.example"
  )
) {
  environmentVariables =
    parseEnvironmentFile(
      read(
        ".env.example"
      )
    );

  const expectedVariables =
    [
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

      "DATABASE_URL",
      "ADMIN_TOKEN",

      "LIVE_AGENT_QUEUE_STATUS",
      "LIVE_AGENT_NORMAL_WAIT",
      "LIVE_AGENT_BUSY_WAIT",

      "NODE_ENV",
      "PORT"
    ];

  expectedVariables.forEach(
    function (
      variableName
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          environmentVariables,
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
| Secret Exposure Check
|--------------------------------------------------------------------------
*/

const sensitiveTemplateVariables =
  [
    "MICROSOFT_CLIENT_SECRET",
    "SMTP_PASS",
    "ADMIN_TOKEN",
    "DATABASE_URL"
  ];

sensitiveTemplateVariables.forEach(
  function (
    variableName
  ) {
    const value =
      environmentVariables[
        variableName
      ];

    if (
      value &&
      !isBlankOrPlaceholder(
        value
      )
    ) {
      fail(
        `.env.example may contain a real ${variableName}`
      );
    } else {
      pass(
        `.env.example does not contain a real ${variableName}`
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Source Secret Scan
|--------------------------------------------------------------------------
*/

const sourceFilesToScan =
  [
    "server.js",
    "routes/admin-reviews.js",
    "routes/admin-reporting.js",
    "routes/admin-knowledge-status.js",
    "routes/approved-knowledge.js",
    "routes/approved-knowledge-events.js",
    "public/widget.js",
    "public/chat-analytics.js",
    "public/chat-approved-reporting.js"
  ];

const dangerousPatterns =
  [
    {
      pattern:
        /MICROSOFT_CLIENT_SECRET[ \t]*=[ \t]*["'][^"'\r\n]{20,}["']/,

      name:
        "hard-coded Microsoft client secret"
    },

    {
      pattern:
        /SMTP_PASS[ \t]*=[ \t]*["'][^"'\r\n]{8,}["']/,

      name:
        "hard-coded SMTP password"
    },

    {
      pattern:
        /ADMIN_TOKEN[ \t]*=[ \t]*["'][^"'\r\n]{8,}["']/,

      name:
        "hard-coded admin token"
    },

    {
      pattern:
        /postgres(?:ql)?:\/\/[^:\s"']+:[^@\s"']+@/i,

      name:
        "hard-coded PostgreSQL credential"
    }
  ];

sourceFilesToScan.forEach(
  function (
    relativePath
  ) {
    if (
      !exists(
        relativePath
      )
    ) {
      return;
    }

    const contents =
      read(
        relativePath
      );

    dangerousPatterns.forEach(
      function (
        dangerousPattern
      ) {
        if (
          dangerousPattern.pattern.test(
            contents
          )
        ) {
          fail(
            `${relativePath} may contain a ${dangerousPattern.name}`
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
| .gitignore Protection
|--------------------------------------------------------------------------
*/

if (
  exists(
    ".gitignore"
  )
) {
  const ignoredEntries =
    read(
      ".gitignore"
    )
      .split(
        /\r?\n/
      )
      .map(
        function (
          line
        ) {
          return line.trim();
        }
      );

  const environmentIgnored =
    ignoredEntries.includes(
      ".env"
    ) ||
    ignoredEntries.includes(
      ".env*"
    ) ||
    ignoredEntries.includes(
      "*.env"
    );

  if (
    environmentIgnored
  ) {
    pass(
      ".env is protected by .gitignore"
    );
  } else {
    fail(
      ".gitignore must exclude .env"
    );
  }
}

/*
|--------------------------------------------------------------------------
| Microsoft Graph Launch Gate
|--------------------------------------------------------------------------
*/

const graphVariables =
  [
    "MICROSOFT_TENANT_ID",
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
    "GRAPH_SENDER_EMAIL"
  ];

const graphConfigured =
  graphVariables.every(
    function (
      variableName
    ) {
      return Boolean(
        String(
          process.env[
            variableName
          ] ||
          ""
        ).trim()
      );
    }
  );

if (
  graphConfigured
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
| Results
|--------------------------------------------------------------------------
*/

console.log(
  ""
);

results.forEach(
  function (
    result
  ) {
    let symbol =
      "✓";

    if (
      result.type ===
      "FAIL"
    ) {
      symbol =
        "X";
    }

    if (
      result.type ===
      "WARN"
    ) {
      symbol =
        "!";
    }

    console.log(
      `[${symbol}] ${result.type}: ${result.message}`
    );
  }
);

console.log(
  ""
);

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

console.log(
  ""
);

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

  console.log(
    ""
  );

  console.log(
    "IMPORTANT: A successful Microsoft Graph live handoff must still be confirmed before disabling Shopify Inbox."
  );
}