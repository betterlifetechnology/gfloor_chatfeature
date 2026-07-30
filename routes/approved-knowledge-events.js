"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Approved Knowledge Event Ingestion API
|--------------------------------------------------------------------------
|
| STEP 20J.1B
|
| Public write-only endpoint used by gfloor.com to record anonymous usage
| events for human-approved chatbot knowledge.
|
| This route does NOT accept or store:
|
| - raw customer questions
| - chatbot answer text
| - customer names
| - email addresses
| - phone numbers
| - order numbers
|
|--------------------------------------------------------------------------
*/

const express = require("express");
const crypto = require("crypto");

const {
  query,
  checkConnection
} = require("../db/review-db");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const VALID_EVENT_TYPES = new Set([
  "approved_knowledge_answer",
  "approved_knowledge_helpful_yes",
  "approved_knowledge_helpful_no"
]);

const VALID_RESPONSE_TYPES = new Set([
  "AUTO",
  "AUTO ANSWER",
  "HUMAN REVIEW",
  "ALWAYS ESCALATE"
]);

const MAX_REQUESTS_PER_WINDOW = 120;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const requestBuckets = new Map();

/*
|--------------------------------------------------------------------------
| Privacy Blocklist
|--------------------------------------------------------------------------
|
| These fields are rejected rather than silently ignored.
|
|--------------------------------------------------------------------------
*/

const DISALLOWED_FIELDS = new Set([
  "question",
  "raw_question",
  "customer_question",
  "answer",
  "raw_answer",
  "chatbot_answer",
  "name",
  "customer_name",
  "email",
  "customer_email",
  "phone",
  "customer_phone",
  "order_number",
  "order_id",
  "message",
  "transcript"
]);

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
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .slice(
      0,
      maximumLength
    );
}

function cleanOptionalText(
  value,
  maximumLength
) {
  const cleaned = cleanText(
    value,
    maximumLength
  );

  return cleaned || null;
}

function cleanEventType(
  value
) {
  const cleaned = cleanText(
    value,
    80
  )
    .toLowerCase()
    .replace(
      /^gfloor_chat_/,
      ""
    );

  return VALID_EVENT_TYPES.has(
    cleaned
  )
    ? cleaned
    : "";
}

function cleanResponseType(
  value
) {
  const cleaned = cleanText(
    value,
    50
  ).toUpperCase();

  if (!cleaned) {
    return null;
  }

  if (
    cleaned === "AUTO ANSWER"
  ) {
    return "AUTO";
  }

  return VALID_RESPONSE_TYPES.has(
    cleaned
  )
    ? cleaned
    : null;
}

function cleanTimestamp(
  value
) {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return new Date();
  }

  const now = Date.now();
  const maximumFutureTime =
    now + 5 * 60 * 1000;

  const minimumPastTime =
    now - 365 * 24 * 60 * 60 * 1000;

  if (
    date.getTime() >
      maximumFutureTime ||
    date.getTime() <
      minimumPastTime
  ) {
    return new Date();
  }

  return date;
}

function cleanMetadata(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const permittedKeys = [
    "analytics_version",
    "widget_version",
    "browser_language",
    "viewport_group"
  ];

  const cleaned = {};

  permittedKeys.forEach(
    function (
      key
    ) {
      const fieldValue =
        cleanOptionalText(
          value[key],
          100
        );

      if (fieldValue) {
        cleaned[key] =
          fieldValue;
      }
    }
  );

  return cleaned;
}

/*
|--------------------------------------------------------------------------
| Privacy Validation
|--------------------------------------------------------------------------
*/

function findDisallowedFields(
  value,
  prefix
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return [];
  }

  const matches = [];

  Object.keys(value).forEach(
    function (
      key
    ) {
      const normalizedKey =
        String(key)
          .trim()
          .toLowerCase();

      const fieldPath =
        prefix
          ? `${prefix}.${key}`
          : key;

      if (
        DISALLOWED_FIELDS.has(
          normalizedKey
        )
      ) {
        matches.push(
          fieldPath
        );
      }

      const childValue =
        value[key];

      if (
        childValue &&
        typeof childValue ===
          "object"
      ) {
        matches.push(
          ...findDisallowedFields(
            childValue,
            fieldPath
          )
        );
      }
    }
  );

  return matches;
}

/*
|--------------------------------------------------------------------------
| Client Event ID
|--------------------------------------------------------------------------
*/

function createClientEventId(
  event
) {
  const signature = [
    event.eventType,
    event.approvedKnowledgeId,
    event.conversationId || "",
    event.occurredAt.toISOString(),
    crypto.randomUUID()
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(signature)
    .digest("hex");
}

/*
|--------------------------------------------------------------------------
| Request Address
|--------------------------------------------------------------------------
*/

function getRequestAddress(
  request
) {
  const forwardedFor =
    cleanText(
      request.get(
        "X-Forwarded-For"
      ),
      500
    );

  if (forwardedFor) {
    return forwardedFor
      .split(",")[0]
      .trim();
  }

  return cleanText(
    request.ip ||
    request.socket
      .remoteAddress ||
    "unknown",
    200
  );
}

/*
|--------------------------------------------------------------------------
| Lightweight Rate Limiting
|--------------------------------------------------------------------------
*/

function rateLimit(
  request,
  response,
  next
) {
  const now = Date.now();

  const address =
    getRequestAddress(
      request
    );

  const existing =
    requestBuckets.get(
      address
    );

  if (
    !existing ||
    now - existing.startedAt >=
      RATE_LIMIT_WINDOW_MS
  ) {
    requestBuckets.set(
      address,
      {
        startedAt: now,
        count: 1
      }
    );

    return next();
  }

  existing.count += 1;

  if (
    existing.count >
    MAX_REQUESTS_PER_WINDOW
  ) {
    response.set(
      "Retry-After",
      "60"
    );

    return response
      .status(429)
      .json({
        success: false,
        error:
          "Too many reporting requests."
      });
  }

  next();
}

router.use(
  rateLimit
);

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

router.get(
  "/approved-knowledge/events/health",
  async function (
    request,
    response
  ) {
    try {
      const database =
        await checkConnection();

      const tableResult =
        await query(
          `
            SELECT
              to_regclass(
                'public.chat_approved_knowledge_events'
              ) AS reporting_table;
          `
        );

      const reportingTable =
        tableResult.rows[0] &&
        tableResult.rows[0]
          .reporting_table;

      response.json({
        success: Boolean(
          reportingTable
        ),

        ingestionApi: true,

        database,

        reportingTable:
          reportingTable || null
      });
    } catch (
      error
    ) {
      console.error(
        "Approved knowledge event health error:",
        error
      );

      response
        .status(500)
        .json({
          success: false,
          error:
            "Reporting event database connection failed."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Record Approved Knowledge Event
|--------------------------------------------------------------------------
*/

router.post(
  "/approved-knowledge/events",
  async function (
    request,
    response
  ) {
    try {
      const body =
        request.body || {};

      const disallowedFields =
        findDisallowedFields(
          body,
          ""
        );

      if (
        disallowedFields.length >
        0
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "Raw customer or chatbot content is not accepted by this endpoint.",
            rejectedFields:
              disallowedFields
          });
      }

      const eventType =
        cleanEventType(
          body.event_type ||
          body.eventType ||
          body.event
        );

      const approvedKnowledgeId =
        cleanText(
          body.approved_knowledge_id ||
          body.approvedKnowledgeId,
          150
        );

      const approvedKnowledgeCategory =
        cleanOptionalText(
          body.approved_knowledge_category ||
          body.approvedKnowledgeCategory,
          150
        );

      const approvedResponseType =
        cleanResponseType(
          body.approved_response_type ||
          body.approvedResponseType
        );

      const conversationId =
        cleanOptionalText(
          body.conversation_id ||
          body.conversationId,
          150
        );

      const pageType =
        cleanOptionalText(
          body.chat_page_type ||
          body.page_type ||
          body.pageType,
          100
        );

      const productHandle =
        cleanOptionalText(
          body.product_handle ||
          body.productHandle,
          300
        );

      const collectionHandle =
        cleanOptionalText(
          body.collection_handle ||
          body.collectionHandle,
          300
        );

      const variantId =
        cleanOptionalText(
          body.variant_id ||
          body.variantId,
          100
        );

      const occurredAt =
        cleanTimestamp(
          body.occurred_at ||
          body.occurredAt ||
          body.event_timestamp
        );

      const suppliedClientEventId =
        cleanOptionalText(
          body.client_event_id ||
          body.clientEventId,
          150
        );

      const metadata =
        cleanMetadata(
          body.metadata
        );

      if (!eventType) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "A valid approved-knowledge event type is required."
          });
      }

      if (
        !approvedKnowledgeId
      ) {
        return response
          .status(400)
          .json({
            success: false,
            error:
              "approved_knowledge_id is required."
          });
      }

      /*
       * Verify the referenced knowledge exists and is active.
       */

      const knowledgeResult =
        await query(
          `
            SELECT
              knowledge_id,
              category,
              response_type
            FROM
              chat_approved_knowledge
            WHERE
              knowledge_id = $1
              AND active = TRUE
            LIMIT 1;
          `,
          [
            approvedKnowledgeId
          ]
        );

      if (
        knowledgeResult.rows.length ===
        0
      ) {
        return response
          .status(404)
          .json({
            success: false,
            error:
              "Approved knowledge entry was not found or is inactive."
          });
      }

      const knowledge =
        knowledgeResult.rows[0];

      const clientEventId =
        suppliedClientEventId ||
        createClientEventId({
          eventType,
          approvedKnowledgeId,
          conversationId,
          occurredAt
        });

      const result =
        await query(
          `
            INSERT INTO
              chat_approved_knowledge_events
            (
              client_event_id,
              event_type,
              approved_knowledge_id,
              approved_knowledge_category,
              approved_response_type,
              knowledge_source,
              response_mode,
              conversation_id,
              page_type,
              product_handle,
              collection_handle,
              variant_id,
              occurred_at,
              metadata
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              'approved_database',
              'approved_database',
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12::jsonb
            )
            ON CONFLICT (
              client_event_id
            )
            WHERE
              client_event_id IS NOT NULL
            DO NOTHING
            RETURNING
              id,
              client_event_id,
              event_type,
              approved_knowledge_id,
              occurred_at,
              received_at;
          `,
          [
            clientEventId,
            eventType,
            approvedKnowledgeId,
            approvedKnowledgeCategory ||
              knowledge.category ||
              null,
            approvedResponseType ||
              knowledge.response_type ||
              null,
            conversationId,
            pageType,
            productHandle,
            collectionHandle,
            variantId,
            occurredAt.toISOString(),
            JSON.stringify(
              metadata
            )
          ]
        );

      if (
        result.rows.length ===
        0
      ) {
        return response
          .status(200)
          .json({
            success: true,
            duplicate: true,
            stored: false,
            clientEventId
          });
      }

      response
        .status(201)
        .json({
          success: true,
          duplicate: false,
          stored: true,
          event: result.rows[0]
        });
    } catch (
      error
    ) {
      console.error(
        "Approved knowledge event ingestion error:",
        error
      );

      response
        .status(500)
        .json({
          success: false,
          error:
            "The approved-knowledge event could not be recorded."
        });
    }
  }
);

module.exports = router;