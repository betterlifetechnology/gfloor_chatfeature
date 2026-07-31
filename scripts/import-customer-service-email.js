"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Customer Service Email Review Importer
|--------------------------------------------------------------------------
|
| STEP 20E
|
| PURPOSE
|
| Reads Customer Service email conversations from Microsoft Graph,
| pairs inbound customer messages with outbound Customer Service replies,
| and inserts proposed knowledge into chat_training_reviews.
|
| IMPORTANT
|
| - Nothing is automatically approved.
| - Nothing is automatically published to the chatbot.
| - Every imported record receives status = pending-review.
| - Human approval remains mandatory.
|
| DEFAULT MODE
|
| DRY RUN
|
| Run:
|
| npm run email-import
|
| to preview what would be imported.
|
| Run:
|
| npm run email-import -- --write
|
| to actually insert pending reviews.
|
|--------------------------------------------------------------------------
*/

require("dotenv").config();

const {
  query,
  closePool,
  checkConnection
} =
  require(
    "../db/review-db"
  );

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const GRAPH_BASE_URL =
  "https://graph.microsoft.com/v1.0";

const DEFAULT_LOOKBACK_DAYS =
  30;

const DEFAULT_MAX_MESSAGES =
  100;

const DEFAULT_CATEGORY =
  "Needs Classification";

const VALID_RESPONSE_TYPES =
  new Set([
    "AUTO",
    "HUMAN REVIEW",
    "ALWAYS ESCALATE"
  ]);

const INTERNAL_EMAIL_DOMAINS = [
  "gproductsllc.com",
  "bltllc.com"
];

/*
|--------------------------------------------------------------------------
| Environment Helpers
|--------------------------------------------------------------------------
*/

function getEnvironment() {
  return {
    tenantId:
      cleanText(
        process.env
          .MICROSOFT_TENANT_ID
      ),

    clientId:
      cleanText(
        process.env
          .MICROSOFT_CLIENT_ID
      ),

    clientSecret:
      cleanText(
        process.env
          .MICROSOFT_CLIENT_SECRET
      ),

    mailbox:
      cleanText(
        process.env
          .GRAPH_INGEST_MAILBOX ||
        process.env
          .CUSTOMER_SERVICE_EMAIL
      ),

    lookbackDays:
      cleanPositiveInteger(
        process.env
          .GRAPH_INGEST_LOOKBACK_DAYS,
        DEFAULT_LOOKBACK_DAYS
      ),

    maxMessages:
      Math.min(
        cleanPositiveInteger(
          process.env
            .GRAPH_INGEST_MAX_MESSAGES,
          DEFAULT_MAX_MESSAGES
        ),
        500
      )
  };
}

/*
|--------------------------------------------------------------------------
| Generic Helpers
|--------------------------------------------------------------------------
*/

function cleanText(
  value
) {
  return String(
    value == null
      ? ""
      : value
  )
    .replace(
      /\r\n/g,
      "\n"
    )
    .replace(
      /\r/g,
      "\n"
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

function cleanPositiveInteger(
  value,
  fallback
) {
  const number =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isInteger(
      number
    ) ||
    number < 1
  ) {
    return fallback;
  }

  return number;
}

function normalizeText(
  value
) {
  return cleanText(
    value
  )
    .toLowerCase()
    .replace(
      /g-floor/g,
      "gfloor"
    )
    .replace(
      /g floor/g,
      "gfloor"
    )
    .replace(
      /®/g,
      ""
    )
    .replace(
      /™/g,
      ""
    )
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function normalizeEmail(
  value
) {
  return cleanText(
    value
  )
    .toLowerCase();
}

function parseDate(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function isAfterOrSame(
  firstValue,
  secondValue
) {
  const first =
    parseDate(
      firstValue
    );

  const second =
    parseDate(
      secondValue
    );

  if (
    !first ||
    !second
  ) {
    return false;
  }

  return (
    first.getTime() >=
    second.getTime()
  );
}

function getCutoffDate(
  days
) {
  const cutoff =
    new Date();

  cutoff.setUTCDate(
    cutoff.getUTCDate() -
    days
  );

  return cutoff;
}

function isWithinLookback(
  value,
  cutoff
) {
  const date =
    parseDate(
      value
    );

  if (!date) {
    return false;
  }

  return (
    date.getTime() >=
    cutoff.getTime()
  );
}

/*
|--------------------------------------------------------------------------
| HTML To Plain Text
|--------------------------------------------------------------------------
*/

function decodeHtmlEntities(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&quot;/gi,
      "\""
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&#x27;/gi,
      "'"
    )
    .replace(
      /&#x2F;/gi,
      "/"
    );
}

function htmlToText(
  html
) {
  let value =
    String(
      html ||
      ""
    );

  value =
    value.replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    );

  value =
    value.replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    );

  value =
    value.replace(
      /<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi,
      "\n"
    );

  value =
    value.replace(
      /<li[^>]*>/gi,
      "- "
    );

  value =
    value.replace(
      /<[^>]+>/g,
      " "
    );

  value =
    decodeHtmlEntities(
      value
    );

  return cleanText(
    value
  );
}

function getMessageBodyText(
  message
) {
  if (
    !message ||
    !message.body
  ) {
    return cleanText(
      message &&
      message.bodyPreview
    );
  }

  const body =
    message.body;

  if (
    String(
      body.contentType
    )
      .toLowerCase() ===
    "html"
  ) {
    return htmlToText(
      body.content
    );
  }

  return cleanText(
    body.content
  );
}

/*
|--------------------------------------------------------------------------
| Remove Quoted Email History
|--------------------------------------------------------------------------
*/

function stripQuotedHistory(
  value
) {
  let text =
    cleanText(
      value
    );

  const markers = [
    "\n-----Original Message-----",
    "\nFrom:",
    "\nSent:",
    "\nTo:",
    "\nSubject:",
    "\nOn "
  ];

  let earliestIndex =
    -1;

  markers.forEach(
    function (
      marker
    ) {
      const index =
        text.indexOf(
          marker
        );

      if (
        index > 0 &&
        (
          earliestIndex ===
            -1 ||
          index <
            earliestIndex
        )
      ) {
        earliestIndex =
          index;
      }
    }
  );

  if (
    earliestIndex >
    0
  ) {
    text =
      text.slice(
        0,
        earliestIndex
      );
  }

  return cleanText(
    text
  );
}

/*
|--------------------------------------------------------------------------
| Remove Common Greeting / Signature Noise
|--------------------------------------------------------------------------
*/

function cleanSuggestedText(
  value
) {
  let text =
    stripQuotedHistory(
      value
    );

  const lines =
    text
      .split(
        "\n"
      )
      .map(
        function (
          line
        ) {
          return line.trim();
        }
      );

  while (
    lines.length &&
    !lines[0]
  ) {
    lines.shift();
  }

  /*
   * Remove very simple customer-service greetings.
   */

  if (
    lines.length &&
    /^(hi|hello|good morning|good afternoon|good evening)\b.{0,60}[,!]?$/i.test(
      lines[0]
    )
  ) {
    lines.shift();
  }

  /*
   * Remove common signature separator and everything below it.
   */

  const signatureIndex =
    lines.findIndex(
      function (
        line
      ) {
        return (
          /^--+$/.test(
            line
          ) ||
          /^(thanks|thank you|best|regards|sincerely|kind regards)[,!]?\s*$/i.test(
            line
          )
        );
      }
    );

  if (
    signatureIndex >
    0
  ) {
    lines.splice(
      signatureIndex
    );
  }

  text =
    lines.join(
      "\n"
    );

  return cleanText(
    text
  );
}

/*
|--------------------------------------------------------------------------
| Sensitive Information Detection
|--------------------------------------------------------------------------
*/

function detectSensitiveInformation(
  value
) {
  const text =
    cleanText(
      value
    );

  const findings =
    [];

  const emailPattern =
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

  const phonePattern =
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;

  const orderPattern =
    /\b(?:order|invoice|reference|confirmation|tracking)[\s#:.-]*[A-Z0-9-]{4,}\b/gi;

  const addressPattern =
    /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|court|ct|way|parkway|pkwy)\b/gi;

  if (
    emailPattern.test(
      text
    )
  ) {
    findings.push(
      "email-address"
    );
  }

  if (
    phonePattern.test(
      text
    )
  ) {
    findings.push(
      "phone-number"
    );
  }

  if (
    orderPattern.test(
      text
    )
  ) {
    findings.push(
      "possible-order-number"
    );
  }

  if (
    addressPattern.test(
      text
    )
  ) {
    findings.push(
      "possible-address"
    );
  }

  return [
    ...new Set(
      findings
    )
  ];
}

/*
|--------------------------------------------------------------------------
| Sanitize Proposed Chatbot Content
|--------------------------------------------------------------------------
|
| Original email text is preserved in customer_question and
| customer_service_response.
|
| The suggested chatbot text receives basic redaction.
|
|--------------------------------------------------------------------------
*/

function redactSensitiveInformation(
  value
) {
  let text =
    cleanSuggestedText(
      value
    );

  text =
    text.replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[email removed]"
    );

  text =
    text.replace(
      /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g,
      "[phone removed]"
    );

  text =
    text.replace(
      /\b(?:order|invoice|reference|confirmation|tracking)[\s#:.-]*[A-Z0-9-]{4,}\b/gi,
      "[order information removed]"
    );

  text =
    text.replace(
      /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|court|ct|way|parkway|pkwy)\b/gi,
      "[address removed]"
    );

  return cleanText(
    text
  );
}

/*
|--------------------------------------------------------------------------
| Category Suggestion
|--------------------------------------------------------------------------
*/

function suggestCategory(
  questionText,
  answerText
) {
  const value =
    normalizeText(
      questionText +
      " " +
      answerText
    );

  const rules = [
    {
      category:
        "Installation",

      keywords: [
        "install",
        "installation",
        "adhesive",
        "glue",
        "tape",
        "seam",
        "subfloor",
        "concrete",
        "wood",
        "plywood",
        "threshold"
      ]
    },

    {
      category:
        "Cleaning & Maintenance",

      keywords: [
        "clean",
        "cleaner",
        "cleaning",
        "wash",
        "stain",
        "scrub",
        "maintenance",
        "chemical",
        "spill"
      ]
    },

    {
      category:
        "Shipping & Delivery",

      keywords: [
        "shipping",
        "ship",
        "delivery",
        "freight"
      ]
    },

    {
      category:
        "Order Help",

      keywords: [
        "order",
        "invoice",
        "tracking",
        "purchase",
        "checkout",
        "confirmation"
      ]
    },

    {
      category:
        "Warranty & Returns",

      keywords: [
        "warranty",
        "return",
        "refund",
        "claim",
        "defect"
      ]
    },

    {
      category:
        "Outdoor & Marine",

      keywords: [
        "outdoor",
        "outside",
        "marine",
        "boat",
        "pontoon",
        "uv"
      ]
    },

    {
      category:
        "Garage Flooring",

      keywords: [
        "garage",
        "parking",
        "vehicle",
        "car",
        "truck"
      ]
    },

    {
      category:
        "Pet Flooring",

      keywords: [
        "pet",
        "dog",
        "cat",
        "kennel",
        "crate"
      ]
    },

    {
      category:
        "Product Details",

      keywords: [
        "size",
        "color",
        "sku",
        "price",
        "stock",
        "available",
        "material"
      ]
    }
  ];

  for (
    const rule
    of rules
  ) {
    const match =
      rule.keywords.some(
        function (
          keyword
        ) {
          return value.includes(
            keyword
          );
        }
      );

    if (match) {
      return rule.category;
    }
  }

  return DEFAULT_CATEGORY;
}

/*
|--------------------------------------------------------------------------
| Response Type Suggestion
|--------------------------------------------------------------------------
*/

function suggestResponseType(
  questionText,
  answerText,
  sensitiveFindings
) {
  const value =
    normalizeText(
      questionText +
      " " +
      answerText
    );

  const alwaysEscalateTerms = [
    "order number",
    "invoice",
    "tracking number",
    "refund status",
    "claim number",
    "where is my order",
    "cancel my order"
  ];

  if (
    alwaysEscalateTerms.some(
      function (
        term
      ) {
        return value.includes(
          term
        );
      }
    )
  ) {
    return "ALWAYS ESCALATE";
  }

  if (
    sensitiveFindings.length >
    0
  ) {
    return "HUMAN REVIEW";
  }

  return "AUTO";
}

/*
|--------------------------------------------------------------------------
| Generate Question Variations
|--------------------------------------------------------------------------
*/

function createVariations(
  question
) {
  const cleaned =
    cleanText(
      question
    );

  if (!cleaned) {
    return [];
  }

  return [
    cleaned
  ];
}

/*
|--------------------------------------------------------------------------
| Internal / Automated Sender Detection
|--------------------------------------------------------------------------
*/

function getSenderEmail(
  message
) {
  return normalizeEmail(
    message &&
    message.from &&
    message.from.emailAddress &&
    message.from.emailAddress.address
  );
}

function isInternalEmail(
  email
) {
  const normalized =
    normalizeEmail(
      email
    );

  const atIndex =
    normalized.lastIndexOf(
      "@"
    );

  if (
    atIndex ===
    -1
  ) {
    return false;
  }

  const domain =
    normalized.slice(
      atIndex +
      1
    );

  return INTERNAL_EMAIL_DOMAINS.includes(
    domain
  );
}

function isAutomatedSender(
  email
) {
  const normalized =
    normalizeEmail(
      email
    );

  const automatedTerms = [
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "mailer-daemon",
    "postmaster"
  ];

  return automatedTerms.some(
    function (
      term
    ) {
      return normalized.includes(
        term
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Microsoft Graph Authentication
|--------------------------------------------------------------------------
*/

async function getGraphAccessToken(
  environment
) {
  const missing =
    [];

  if (
    !environment.tenantId
  ) {
    missing.push(
      "MICROSOFT_TENANT_ID"
    );
  }

  if (
    !environment.clientId
  ) {
    missing.push(
      "MICROSOFT_CLIENT_ID"
    );
  }

  if (
    !environment.clientSecret
  ) {
    missing.push(
      "MICROSOFT_CLIENT_SECRET"
    );
  }

  if (
    !environment.mailbox
  ) {
    missing.push(
      "GRAPH_INGEST_MAILBOX"
    );
  }

  if (
    missing.length
  ) {
    throw new Error(
      "Missing Microsoft Graph configuration: " +
      missing.join(
        ", "
      )
    );
  }

  const tokenUrl =
    "https://login.microsoftonline.com/" +
    encodeURIComponent(
      environment.tenantId
    ) +
    "/oauth2/v2.0/token";

  const body =
    new URLSearchParams();

  body.set(
    "client_id",
    environment.clientId
  );

  body.set(
    "client_secret",
    environment.clientSecret
  );

  body.set(
    "scope",
    "https://graph.microsoft.com/.default"
  );

  body.set(
    "grant_type",
    "client_credentials"
  );

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
          body.toString()
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      "Microsoft Graph authentication failed: " +
      (
        data.error_description ||
        data.error ||
        response.status
      )
    );
  }

  return data.access_token;
}

/*
|--------------------------------------------------------------------------
| Microsoft Graph Request
|--------------------------------------------------------------------------
*/

async function graphGet(
  url,
  token
) {
  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Authorization:
            "Bearer " +
            token,

          Accept:
            "application/json"
        }
      }
    );

  let data;

  try {
    data =
      await response.json();
  } catch (
    error
  ) {
    throw new Error(
      "Microsoft Graph returned a non-JSON response."
    );
  }

  if (
    !response.ok
  ) {
    const graphMessage =
      data &&
      data.error &&
      data.error.message
        ? data.error.message
        : (
            "HTTP " +
            response.status
          );

    throw new Error(
      "Microsoft Graph request failed: " +
      graphMessage
    );
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| Read Folder Messages
|--------------------------------------------------------------------------
*/

async function loadFolderMessages({
  mailbox,
  folderName,
  token,
  maxMessages,
  orderField
}) {
  const selectFields = [
    "id",
    "internetMessageId",
    "conversationId",
    "subject",
    "from",
    "toRecipients",
    "receivedDateTime",
    "sentDateTime",
    "body",
    "bodyPreview",
    "webLink"
  ].join(
    ","
  );

  const parameters =
    new URLSearchParams();

  parameters.set(
    "$select",
    selectFields
  );

  parameters.set(
    "$orderby",
    (
      orderField ||
      "receivedDateTime"
    ) +
    " desc"
  );

  parameters.set(
    "$top",
    String(
      Math.min(
        maxMessages,
        100
      )
    )
  );

  let nextUrl =
    GRAPH_BASE_URL +
    "/users/" +
    encodeURIComponent(
      mailbox
    ) +
    "/mailFolders/" +
    encodeURIComponent(
      folderName
    ) +
    "/messages?" +
    parameters.toString();

  const messages =
    [];

  while (
    nextUrl &&
    messages.length <
    maxMessages
  ) {
    const page =
      await graphGet(
        nextUrl,
        token
      );

    if (
      Array.isArray(
        page.value
      )
    ) {
      messages.push(
        ...page.value
      );
    }

    nextUrl =
      page[
        "@odata.nextLink"
      ] ||
      "";

    if (
      messages.length >=
      maxMessages
    ) {
      break;
    }
  }

  return messages.slice(
    0,
    maxMessages
  );
}

/*
|--------------------------------------------------------------------------
| Pair Customer Question To Customer Service Reply
|--------------------------------------------------------------------------
*/

function pairMessages(
  inboxMessages,
  sentMessages,
  mailbox,
  cutoffDate
) {
  const normalizedMailbox =
    normalizeEmail(
      mailbox
    );

  const eligibleInbox =
    inboxMessages.filter(
      function (
        message
      ) {
        const sender =
          getSenderEmail(
            message
          );

        if (
          !message.conversationId
        ) {
          return false;
        }

        if (
          !isWithinLookback(
            message.receivedDateTime,
            cutoffDate
          )
        ) {
          return false;
        }

        if (
          sender ===
          normalizedMailbox
        ) {
          return false;
        }

        if (
          isInternalEmail(
            sender
          )
        ) {
          return false;
        }

        if (
          isAutomatedSender(
            sender
          )
        ) {
          return false;
        }

        const body =
          getMessageBodyText(
            message
          );

        return Boolean(
          cleanText(
            body
          )
        );
      }
    );

  const pairs =
    [];

  eligibleInbox.forEach(
    function (
      inbound
    ) {
      const candidates =
        sentMessages
          .filter(
            function (
              outbound
            ) {
              return (
                outbound.conversationId ===
                  inbound.conversationId &&
                isAfterOrSame(
                  outbound.sentDateTime ||
                  outbound.receivedDateTime,
                  inbound.receivedDateTime
                )
              );
            }
          )
          .sort(
            function (
              first,
              second
            ) {
              const firstDate =
                parseDate(
                  first.sentDateTime ||
                  first.receivedDateTime
                );

              const secondDate =
                parseDate(
                  second.sentDateTime ||
                  second.receivedDateTime
                );

              return (
                firstDate.getTime() -
                secondDate.getTime()
              );
            }
          );

      if (
        !candidates.length
      ) {
        return;
      }

      pairs.push({
        inbound:
          inbound,

        outbound:
          candidates[0]
      });
    }
  );

  return pairs;
}

/*
|--------------------------------------------------------------------------
| Duplicate Similarity
|--------------------------------------------------------------------------
*/

function tokenize(
  value
) {
  return new Set(
    normalizeText(
      value
    )
      .split(
        " "
      )
      .filter(
        function (
          word
        ) {
          return (
            word.length >
            2
          );
        }
      )
  );
}

function calculateSimilarity(
  first,
  second
) {
  const firstTokens =
    tokenize(
      first
    );

  const secondTokens =
    tokenize(
      second
    );

  if (
    firstTokens.size ===
      0 ||
    secondTokens.size ===
      0
  ) {
    return 0;
  }

  let intersection =
    0;

  firstTokens.forEach(
    function (
      token
    ) {
      if (
        secondTokens.has(
          token
        )
      ) {
        intersection +=
          1;
      }
    }
  );

  const union =
    new Set([
      ...firstTokens,
      ...secondTokens
    ]).size;

  if (!union) {
    return 0;
  }

  return (
    intersection /
    union
  );
}

async function findPossibleDuplicate(
  questionText
) {
  const result =
    await query(
      `
        SELECT
          knowledge_id,
          question
        FROM
          chat_active_knowledge;
      `
    );

  let bestMatch =
    null;

  result.rows.forEach(
    function (
      row
    ) {
      const score =
        calculateSimilarity(
          questionText,
          row.question
        );

      if (
        !bestMatch ||
        score >
        bestMatch.score
      ) {
        bestMatch = {
          knowledgeId:
            row.knowledge_id,

          question:
            row.question,

          score:
            score
        };
      }
    }
  );

  if (
    bestMatch &&
    bestMatch.score >=
    0.72
  ) {
    return bestMatch;
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Build Review Record
|--------------------------------------------------------------------------
*/

async function buildReviewRecord(
  pair
) {
  const inbound =
    pair.inbound;

  const outbound =
    pair.outbound;

  const originalQuestion =
    stripQuotedHistory(
      getMessageBodyText(
        inbound
      )
    );

  const originalResponse =
    stripQuotedHistory(
      getMessageBodyText(
        outbound
      )
    );

  const sensitiveInformation =
    [
      ...detectSensitiveInformation(
        originalQuestion
      ),

      ...detectSensitiveInformation(
        originalResponse
      )
    ];

  const uniqueSensitiveInformation =
    [
      ...new Set(
        sensitiveInformation
      )
    ];

  const suggestedQuestion =
    redactSensitiveInformation(
      originalQuestion
    );

  const suggestedAnswer =
    redactSensitiveInformation(
      originalResponse
    );

  const category =
    suggestCategory(
      suggestedQuestion,
      suggestedAnswer
    );

  let responseType =
    suggestResponseType(
      originalQuestion,
      originalResponse,
      uniqueSensitiveInformation
    );

  if (
    !VALID_RESPONSE_TYPES.has(
      responseType
    )
  ) {
    responseType =
      "HUMAN REVIEW";
  }

  const duplicate =
    await findPossibleDuplicate(
      suggestedQuestion
    );

  return {
    sourceType:
      "customer-service-email",

    sourceMessageId:
      cleanText(
        inbound.internetMessageId ||
        inbound.id
      ),

    sourceThreadId:
      cleanText(
        inbound.conversationId
      ),

    sourceFolder:
      "Inbox + Sent Items",

    sourceSubject:
      cleanText(
        inbound.subject
      ),

    sourceSender:
      getSenderEmail(
        inbound
      ),

    sourceReceivedAt:
      inbound.receivedDateTime ||
      null,

    sourceUrl:
      cleanText(
        inbound.webLink
      ) ||
      null,

    customerQuestion:
      originalQuestion,

    customerServiceResponse:
      originalResponse,

    suggestedQuestion:
      suggestedQuestion,

    suggestedAnswer:
      suggestedAnswer,

    suggestedCategory:
      category,

    suggestedVariations:
      createVariations(
        suggestedQuestion
      ),

    suggestedSourceUrl:
      null,

    suggestedResponseType:
      responseType,

    sensitiveInformationDetected:
      uniqueSensitiveInformation,

    requiresSensitiveReview:
      uniqueSensitiveInformation
        .length >
      0,

    sensitiveReviewCompleted:
      false,

    possibleDuplicate:
      Boolean(
        duplicate
      ),

    duplicateKnowledgeId:
      duplicate
        ? duplicate
            .knowledgeId
        : null,

    duplicateScore:
      duplicate
        ? duplicate.score
        : 0
  };
}

/*
|--------------------------------------------------------------------------
| Already Imported Check
|--------------------------------------------------------------------------
*/

async function reviewAlreadyExists(
  sourceMessageId
) {
  const result =
    await query(
      `
        SELECT
          id,
          status
        FROM
          chat_training_reviews
        WHERE
          source_message_id = $1
        LIMIT 1;
      `,
      [
        sourceMessageId
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| Insert Pending Review
|--------------------------------------------------------------------------
*/

async function insertPendingReview(
  review
) {
  const result =
    await query(
      `
        INSERT INTO
          chat_training_reviews
          (
            source_type,
            source_message_id,
            source_thread_id,
            source_folder,
            source_subject,
            source_sender,
            source_received_at,
            source_url,

            customer_question,
            customer_service_response,

            suggested_question,
            suggested_answer,
            suggested_category,
            suggested_variations,
            suggested_source_url,
            suggested_response_type,

            sensitive_information_detected,
            requires_sensitive_review,
            sensitive_review_completed,

            possible_duplicate,
            duplicate_knowledge_id,

            status
          )

        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,

            $9,
            $10,

            $11,
            $12,
            $13,
            $14::jsonb,
            $15,
            $16,

            $17::jsonb,
            $18,
            FALSE,

            $19,
            $20,

            'pending-review'
          )

        ON CONFLICT (
          source_message_id
        )
        WHERE
          source_message_id IS NOT NULL

        DO NOTHING

        RETURNING
          id,
          status;
      `,
      [
        review.sourceType,
        review.sourceMessageId,
        review.sourceThreadId,
        review.sourceFolder,
        review.sourceSubject,
        review.sourceSender,
        review.sourceReceivedAt,
        review.sourceUrl,

        review.customerQuestion,
        review.customerServiceResponse,

        review.suggestedQuestion,
        review.suggestedAnswer,
        review.suggestedCategory,

        JSON.stringify(
          review.suggestedVariations
        ),

        review.suggestedSourceUrl,
        review.suggestedResponseType,

        JSON.stringify(
          review
            .sensitiveInformationDetected
        ),

        review.requiresSensitiveReview,

        review.possibleDuplicate,
        review.duplicateKnowledgeId
      ]
    );

  return (
    result.rows[0] ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| Print Review Preview
|--------------------------------------------------------------------------
*/

function printReview(
  review,
  index
) {
  console.log("");
  console.log(
    "----------------------------------------------"
  );

  console.log(
    "EMAIL REVIEW #" +
    index
  );

  console.log(
    "----------------------------------------------"
  );

  console.log(
    "Subject:",
    review.sourceSubject ||
    "(no subject)"
  );

  console.log(
    "Sender:",
    review.sourceSender ||
    "(unknown)"
  );

  console.log(
    "Received:",
    review.sourceReceivedAt ||
    "(unknown)"
  );

  console.log(
    "Category:",
    review.suggestedCategory
  );

  console.log(
    "Response Type:",
    review.suggestedResponseType
  );

  console.log(
    "Sensitive Review:",
    review.requiresSensitiveReview
      ? "YES"
      : "No"
  );

  console.log(
    "Possible Duplicate:",
    review.possibleDuplicate
      ? (
          "YES - " +
          review
            .duplicateKnowledgeId +
          " (" +
          review
            .duplicateScore
            .toFixed(
              2
            ) +
          ")"
        )
      : "No"
  );

  console.log("");
  console.log(
    "Suggested Question:"
  );

  console.log(
    review.suggestedQuestion
  );

  console.log("");
  console.log(
    "Suggested Answer:"
  );

  console.log(
    review.suggestedAnswer
  );
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

async function main() {
  const argumentsList =
    process.argv
      .slice(2)
      .map(
        function (
          argument
        ) {
          return cleanText(
            argument
          )
            .toLowerCase();
        }
      );

  const writeMode =
    argumentsList.includes(
      "--write"
    );

  const environment =
    getEnvironment();

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    "G-FLOOR CUSTOMER SERVICE EMAIL IMPORT"
  );

  console.log(
    "STEP 20E"
  );

  console.log(
    "=============================================="
  );

  console.log("");

  console.log(
    "Mode:",
    writeMode
      ? "WRITE TO REVIEW QUEUE"
      : "DRY RUN"
  );

  console.log(
    "Mailbox:",
    environment.mailbox ||
    "(not configured)"
  );

  console.log(
    "Lookback:",
    environment.lookbackDays,
    "days"
  );

  console.log(
    "Max messages per folder:",
    environment.maxMessages
  );

  console.log("");

  try {
    const database =
      await checkConnection();

    console.log(
      "PostgreSQL:",
      database.connected
        ? "connected"
        : "unavailable"
    );

    const token =
      await getGraphAccessToken(
        environment
      );

    console.log(
      "Microsoft Graph:",
      "authenticated"
    );

    console.log("");
    console.log(
      "Loading Inbox..."
    );

    const inboxMessages =
      await loadFolderMessages({
        mailbox:
          environment.mailbox,

        folderName:
          "inbox",

        token:
          token,

        maxMessages:
          environment.maxMessages,

        orderField:
          "receivedDateTime"
      });

    console.log(
      "Inbox messages loaded:",
      inboxMessages.length
    );

    console.log(
      "Loading Sent Items..."
    );

    const sentMessages =
      await loadFolderMessages({
        mailbox:
          environment.mailbox,

        folderName:
          "sentitems",

        token:
          token,

        maxMessages:
          environment.maxMessages,

        orderField:
          "sentDateTime"
      });

    console.log(
      "Sent messages loaded:",
      sentMessages.length
    );

    const cutoffDate =
      getCutoffDate(
        environment.lookbackDays
      );

    const pairs =
      pairMessages(
        inboxMessages,
        sentMessages,
        environment.mailbox,
        cutoffDate
      );

    console.log("");
    console.log(
      "Matched customer/reply pairs:",
      pairs.length
    );

    if (
      !pairs.length
    ) {
      console.log("");
      console.log(
        "No eligible completed Customer Service email conversations were found."
      );

      console.log("");

      return;
    }

    let imported =
      0;

    let skippedExisting =
      0;

    let previewed =
      0;

    for (
      let index =
        0;
      index <
        pairs.length;
      index +=
        1
    ) {
      const review =
        await buildReviewRecord(
          pairs[index]
        );

      if (
        !review.customerQuestion ||
        !review.customerServiceResponse
      ) {
        continue;
      }

      const existing =
        await reviewAlreadyExists(
          review.sourceMessageId
        );

      if (existing) {
        skippedExisting +=
          1;

        continue;
      }

      previewed +=
        1;

      printReview(
        review,
        previewed
      );

      if (
        writeMode
      ) {
        const inserted =
          await insertPendingReview(
            review
          );

        if (inserted) {
          imported +=
            1;

          console.log("");
          console.log(
            "Inserted review ID:",
            inserted.id
          );
        }
      }
    }

    console.log("");
    console.log(
      "=============================================="
    );

    console.log(
      "IMPORT SUMMARY"
    );

    console.log(
      "=============================================="
    );

    console.log(
      "Matched pairs:",
      pairs.length
    );

    console.log(
      "New eligible reviews:",
      previewed
    );

    console.log(
      "Existing records skipped:",
      skippedExisting
    );

    console.log(
      "Inserted:",
      imported
    );

    console.log("");

    if (
      !writeMode
    ) {
      console.log(
        "DRY RUN COMPLETE."
      );

      console.log("");
      console.log(
        "Nothing was written to PostgreSQL."
      );

      console.log("");
      console.log(
        "To import these records into Pending Review, run:"
      );

      console.log("");

      console.log(
        "npm run email-import -- --write"
      );

    } else {
      console.log(
        "STEP 20E IMPORT COMPLETE."
      );

      console.log("");
      console.log(
        "All new records were inserted as pending-review."
      );

      console.log(
        "Human approval is still required."
      );
    }

    console.log("");

  } catch (
    error
  ) {
    console.error("");
    console.error(
      "=============================================="
    );

    console.error(
      "STEP 20E FAILED"
    );

    console.error(
      "=============================================="
    );

    console.error("");
    console.error(
      error.message
    );

    console.error("");

    process.exitCode =
      1;

  } finally {
    await closePool();
  }
}

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

main();