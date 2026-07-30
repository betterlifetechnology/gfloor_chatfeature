"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Approved Knowledge Reporting Admin API
|--------------------------------------------------------------------------
|
| STEP 20J.1B
|
| Protected reporting endpoints for approved-database chatbot usage.
|
| All routes require ADMIN_TOKEN.
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

const MAX_PAGE_SIZE = 250;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_DATE_RANGE_DAYS = 30;
const MAX_DATE_RANGE_DAYS = 366;

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

function cleanDate(
  value
) {
  const cleaned =
    cleanText(
      value,
      30
    );

  if (!cleaned) {
    return null;
  }

  const date =
    new Date(
      cleaned + "T00:00:00.000Z"
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return cleaned;
}

function getDefaultStartDate() {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() -
    DEFAULT_DATE_RANGE_DAYS
  );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

function getDefaultEndDate() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );
}

function getDateRange(
  request
) {
  const requestedStartDate =
    cleanDate(
      request.query.start_date
    );

  const requestedEndDate =
    cleanDate(
      request.query.end_date
    );

  const startDate =
    requestedStartDate ||
    getDefaultStartDate();

  const endDate =
    requestedEndDate ||
    getDefaultEndDate();

  const start =
    new Date(
      startDate +
      "T00:00:00.000Z"
    );

  const end =
    new Date(
      endDate +
      "T23:59:59.999Z"
    );

  if (
    start.getTime() >
    end.getTime()
  ) {
    throw new Error(
      "start_date cannot be after end_date."
    );
  }

  const differenceDays =
    Math.ceil(
      (
        end.getTime() -
        start.getTime()
      ) /
      (
        24 *
        60 *
        60 *
        1000
      )
    );

  if (
    differenceDays >
    MAX_DATE_RANGE_DAYS
  ) {
    throw new Error(
      `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days.`
    );
  }

  return {
    startDate,
    endDate,
    startTimestamp:
      start.toISOString(),
    endTimestamp:
      end.toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| ADMIN TOKEN AUTHENTICATION
|--------------------------------------------------------------------------
*/

function getConfiguredAdminToken() {
  return String(
    process.env.ADMIN_TOKEN ||
    ""
  ).trim();
}

function getRequestAdminToken(
  request
) {
  const headerToken =
    cleanText(
      request.get(
        "X-Admin-Token"
      ),
      1000
    );

  if (headerToken) {
    return headerToken;
  }

  const authorization =
    cleanText(
      request.get(
        "Authorization"
      ),
      2000
    );

  if (
    authorization
      .toLowerCase()
      .startsWith(
        "bearer "
      )
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return "";
}

function secureTokenMatch(
  suppliedToken,
  expectedToken
) {
  if (
    !suppliedToken ||
    !expectedToken
  ) {
    return false;
  }

  const suppliedBuffer =
    Buffer.from(
      suppliedToken
    );

  const expectedBuffer =
    Buffer.from(
      expectedToken
    );

  if (
    suppliedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto
    .timingSafeEqual(
      suppliedBuffer,
      expectedBuffer
    );
}

function requireAdmin(
  request,
  response,
  next
) {
  const expectedToken =
    getConfiguredAdminToken();

  if (!expectedToken) {
    console.error(
      "ADMIN_TOKEN is not configured."
    );

    return response
      .status(503)
      .json({
        success: false,
        error:
          "Admin API is not configured."
      });
  }

  const suppliedToken =
    getRequestAdminToken(
      request
    );

  if (
    !secureTokenMatch(
      suppliedToken,
      expectedToken
    )
  ) {
    return response
      .status(401)
      .json({
        success: false,
        error:
          "Unauthorized."
      });
  }

  next();
}

router.use(
  requireAdmin
);

/*
|--------------------------------------------------------------------------
| Reporting Health
|--------------------------------------------------------------------------
*/

router.get(
  "/reporting/health",
  async function (
    request,
    response
  ) {
    try {
      const database =
        await checkConnection();

      const objectsResult =
        await query(
          `
            SELECT
              to_regclass(
                'public.chat_approved_knowledge_events'
              ) AS events_table,

              to_regclass(
                'public.chat_approved_knowledge_reporting_summary'
              ) AS knowledge_summary,

              to_regclass(
                'public.chat_approved_knowledge_category_summary'
              ) AS category_summary,

              to_regclass(
                'public.chat_approved_knowledge_daily_summary'
              ) AS daily_summary,

              to_regclass(
                'public.chat_approved_knowledge_reporting_totals'
              ) AS totals_view;
          `
        );

      const objects =
        objectsResult.rows[0] || {};

      const ready = Boolean(
        objects.events_table &&
        objects.knowledge_summary &&
        objects.category_summary &&
        objects.daily_summary &&
        objects.totals_view
      );

      response
        .status(
          ready
            ? 200
            : 503
        )
        .json({
          success: ready,
          reportingApi: true,
          database,
          objects
        });
    } catch (
      error
    ) {
      console.error(
        "Admin reporting health error:",
        error
      );

      response
        .status(500)
        .json({
          success: false,
          error:
            "Reporting database connection failed."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Reporting Totals
|--------------------------------------------------------------------------
*/

router.get(
  "/reporting/totals",
  async function (
    request,
    response
  ) {
    try {
      const range =
        getDateRange(
          request
        );

      const result =
        await query(
          `
            SELECT

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_answer'
              ) AS total_answers,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_helpful_yes'
              ) AS total_helpful_yes,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_helpful_no'
              ) AS total_helpful_no,

              COUNT(*) FILTER (
                WHERE event_type IN (
                  'approved_knowledge_helpful_yes',
                  'approved_knowledge_helpful_no'
                )
              ) AS total_feedback,

              COUNT(
                DISTINCT approved_knowledge_id
              ) FILTER (
                WHERE event_type =
                  'approved_knowledge_answer'
              ) AS knowledge_entries_used,

              COUNT(
                DISTINCT conversation_id
              ) FILTER (
                WHERE conversation_id IS NOT NULL
              ) AS conversations,

              CASE
                WHEN COUNT(*) FILTER (
                  WHERE event_type IN (
                    'approved_knowledge_helpful_yes',
                    'approved_knowledge_helpful_no'
                  )
                ) = 0
                THEN NULL

                ELSE ROUND(
                  (
                    COUNT(*) FILTER (
                      WHERE event_type =
                        'approved_knowledge_helpful_yes'
                    )::NUMERIC
                    /
                    COUNT(*) FILTER (
                      WHERE event_type IN (
                        'approved_knowledge_helpful_yes',
                        'approved_knowledge_helpful_no'
                      )
                    )::NUMERIC
                  ) * 100,
                  2
                )
              END AS helpful_rate,

              MIN(
                occurred_at
              ) AS first_event_at,

              MAX(
                occurred_at
              ) AS last_event_at

            FROM
              chat_approved_knowledge_events

            WHERE
              occurred_at >= $1
              AND occurred_at <= $2;
          `,
          [
            range.startTimestamp,
            range.endTimestamp
          ]
        );

      response.json({
        success: true,
        range: {
          startDate:
            range.startDate,
          endDate:
            range.endDate
        },
        totals:
          result.rows[0] || {}
      });
    } catch (
      error
    ) {
      const status =
        error.message.includes(
          "date"
        ) ||
        error.message.includes(
          "Date"
        )
          ? 400
          : 500;

      console.error(
        "Reporting totals error:",
        error
      );

      response
        .status(status)
        .json({
          success: false,
          error:
            status === 400
              ? error.message
              : "Reporting totals could not be loaded."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Reporting by Knowledge Entry
|--------------------------------------------------------------------------
*/

router.get(
  "/reporting/knowledge",
  async function (
    request,
    response
  ) {
    try {
      const range =
        getDateRange(
          request
        );

      const page =
        cleanPositiveInteger(
          request.query.page,
          1
        );

      const requestedLimit =
        cleanPositiveInteger(
          request.query.limit,
          DEFAULT_PAGE_SIZE
        );

      const limit =
        Math.min(
          requestedLimit,
          MAX_PAGE_SIZE
        );

      const offset =
        (
          page - 1
        ) *
        limit;

      const category =
        cleanText(
          request.query.category,
          150
        );

      const search =
        cleanText(
          request.query.search,
          300
        );

      const parameters = [
        range.startTimestamp,
        range.endTimestamp
      ];

      const filters = [
        "e.occurred_at >= $1",
        "e.occurred_at <= $2"
      ];

      if (category) {
        parameters.push(
          category
        );

        filters.push(
          `e.approved_knowledge_category = $${parameters.length}`
        );
      }

      if (search) {
        parameters.push(
          `%${search}%`
        );

        filters.push(
          `
            (
              e.approved_knowledge_id ILIKE $${parameters.length}
              OR e.approved_knowledge_category ILIKE $${parameters.length}
              OR k.question ILIKE $${parameters.length}
            )
          `
        );
      }

      const whereClause =
        filters.join(
          "\nAND "
        );

      const countResult =
        await query(
          `
            SELECT
              COUNT(
                DISTINCT e.approved_knowledge_id
              ) AS total
            FROM
              chat_approved_knowledge_events e
            LEFT JOIN
              chat_approved_knowledge k
            ON
              k.knowledge_id =
              e.approved_knowledge_id
            WHERE
              ${whereClause};
          `,
          parameters
        );

      const dataParameters = [
        ...parameters,
        limit,
        offset
      ];

      const limitParameter =
        dataParameters.length - 1;

      const offsetParameter =
        dataParameters.length;

      const result =
        await query(
          `
            SELECT

              e.approved_knowledge_id,

              MAX(
                e.approved_knowledge_category
              ) AS category,

              MAX(
                e.approved_response_type
              ) AS response_type,

              MAX(
                k.question
              ) AS question,

              COUNT(*) FILTER (
                WHERE e.event_type =
                  'approved_knowledge_answer'
              ) AS answer_count,

              COUNT(*) FILTER (
                WHERE e.event_type =
                  'approved_knowledge_helpful_yes'
              ) AS helpful_yes_count,

              COUNT(*) FILTER (
                WHERE e.event_type =
                  'approved_knowledge_helpful_no'
              ) AS helpful_no_count,

              COUNT(*) FILTER (
                WHERE e.event_type IN (
                  'approved_knowledge_helpful_yes',
                  'approved_knowledge_helpful_no'
                )
              ) AS feedback_count,

              CASE
                WHEN COUNT(*) FILTER (
                  WHERE e.event_type IN (
                    'approved_knowledge_helpful_yes',
                    'approved_knowledge_helpful_no'
                  )
                ) = 0
                THEN NULL

                ELSE ROUND(
                  (
                    COUNT(*) FILTER (
                      WHERE e.event_type =
                        'approved_knowledge_helpful_yes'
                    )::NUMERIC
                    /
                    COUNT(*) FILTER (
                      WHERE e.event_type IN (
                        'approved_knowledge_helpful_yes',
                        'approved_knowledge_helpful_no'
                      )
                    )::NUMERIC
                  ) * 100,
                  2
                )
              END AS helpful_rate,

              MIN(
                e.occurred_at
              ) AS first_event_at,

              MAX(
                e.occurred_at
              ) AS last_event_at

            FROM
              chat_approved_knowledge_events e

            LEFT JOIN
              chat_approved_knowledge k
            ON
              k.knowledge_id =
              e.approved_knowledge_id

            WHERE
              ${whereClause}

            GROUP BY
              e.approved_knowledge_id

            ORDER BY
              answer_count DESC,
              last_event_at DESC

            LIMIT
              $${limitParameter}

            OFFSET
              $${offsetParameter};
          `,
          dataParameters
        );

      const total =
        Number.parseInt(
          countResult.rows[0]
            .total,
          10
        ) || 0;

      response.json({
        success: true,

        range: {
          startDate:
            range.startDate,
          endDate:
            range.endDate
        },

        knowledge:
          result.rows,

        pagination: {
          page,
          limit,
          total,
          pages:
            Math.max(
              1,
              Math.ceil(
                total /
                limit
              )
            )
        }
      });
    } catch (
      error
    ) {
      console.error(
        "Reporting knowledge error:",
        error
      );

      response
        .status(500)
        .json({
          success: false,
          error:
            "Approved-knowledge reporting could not be loaded."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Reporting by Category
|--------------------------------------------------------------------------
*/

router.get(
  "/reporting/categories",
  async function (
    request,
    response
  ) {
    try {
      const range =
        getDateRange(
          request
        );

      const result =
        await query(
          `
            SELECT

              COALESCE(
                NULLIF(
                  approved_knowledge_category,
                  ''
                ),
                'Uncategorized'
              ) AS category,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_answer'
              ) AS answer_count,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_helpful_yes'
              ) AS helpful_yes_count,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_helpful_no'
              ) AS helpful_no_count,

              COUNT(*) FILTER (
                WHERE event_type IN (
                  'approved_knowledge_helpful_yes',
                  'approved_knowledge_helpful_no'
                )
              ) AS feedback_count,

              CASE
                WHEN COUNT(*) FILTER (
                  WHERE event_type IN (
                    'approved_knowledge_helpful_yes',
                    'approved_knowledge_helpful_no'
                  )
                ) = 0
                THEN NULL

                ELSE ROUND(
                  (
                    COUNT(*) FILTER (
                      WHERE event_type =
                        'approved_knowledge_helpful_yes'
                    )::NUMERIC
                    /
                    COUNT(*) FILTER (
                      WHERE event_type IN (
                        'approved_knowledge_helpful_yes',
                        'approved_knowledge_helpful_no'
                      )
                    )::NUMERIC
                  ) * 100,
                  2
                )
              END AS helpful_rate

            FROM
              chat_approved_knowledge_events

            WHERE
              occurred_at >= $1
              AND occurred_at <= $2

            GROUP BY
              COALESCE(
                NULLIF(
                  approved_knowledge_category,
                  ''
                ),
                'Uncategorized'
              )

            ORDER BY
              answer_count DESC,
              category ASC;
          `,
          [
            range.startTimestamp,
            range.endTimestamp
          ]
        );

      response.json({
        success: true,

        range: {
          startDate:
            range.startDate,
          endDate:
            range.endDate
        },

        categories:
          result.rows
      });
    } catch (
      error
    ) {
      console.error(
        "Reporting category error:",
        error
      );

      response
        .status(500)
        .json({
          success: false,
          error:
            "Category reporting could not be loaded."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Daily Reporting
|--------------------------------------------------------------------------
*/

router.get(
  "/reporting/daily",
  async function (
    request,
    response
  ) {
    try {
      const range =
        getDateRange(
          request
        );

      const result =
        await query(
          `
            SELECT

              DATE(
                occurred_at AT TIME ZONE
                'America/Chicago'
              ) AS report_date,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_answer'
              ) AS answer_count,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_helpful_yes'
              ) AS helpful_yes_count,

              COUNT(*) FILTER (
                WHERE event_type =
                  'approved_knowledge_helpful_no'
              ) AS helpful_no_count,

              COUNT(
                DISTINCT approved_knowledge_id
              ) FILTER (
                WHERE event_type =
                  'approved_knowledge_answer'
              ) AS knowledge_entries_used,

              COUNT(
                DISTINCT conversation_id
              ) FILTER (
                WHERE conversation_id IS NOT NULL
              ) AS conversation_count

            FROM
              chat_approved_knowledge_events

            WHERE
              occurred_at >= $1
              AND occurred_at <= $2

            GROUP BY
              DATE(
                occurred_at AT TIME ZONE
                'America/Chicago'
              )

            ORDER BY
              report_date ASC;
          `,
          [
            range.startTimestamp,
            range.endTimestamp
          ]
        );

      response.json({
        success: true,

        range: {
          startDate:
            range.startDate,
          endDate:
            range.endDate
        },

        daily:
          result.rows
      });
    } catch (
      error
    ) {
      console.error(
        "Daily reporting error:",
        error
      );

      response
        .status(500)
        .json({
          success: false,
          error:
            "Daily reporting could not be loaded."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Recent Events
|--------------------------------------------------------------------------
*/

router.get(
  "/reporting/events",
  async function (
    request,
    response
  ) {
    try {
      const range =
        getDateRange(
          request
        );

      const requestedLimit =
        cleanPositiveInteger(
          request.query.limit,
          100
        );

      const limit =
        Math.min(
          requestedLimit,
          MAX_PAGE_SIZE
        );

      const result =
        await query(
          `
            SELECT
              id,
              client_event_id,
              event_type,
              approved_knowledge_id,
              approved_knowledge_category,
              approved_response_type,
              conversation_id,
              page_type,
              product_handle,
              collection_handle,
              variant_id,
              occurred_at,
              received_at
            FROM
              chat_approved_knowledge_events
            WHERE
              occurred_at >= $1
              AND occurred_at <= $2
            ORDER BY
              occurred_at DESC
            LIMIT
              $3;
          `,
          [
            range.startTimestamp,
            range.endTimestamp,
            limit
          ]
        );

      response.json({
        success: true,

        range: {
          startDate:
            range.startDate,
          endDate:
            range.endDate
        },

        events:
          result.rows
      });
    } catch (
      error
    ) {
      console.error(
        "Reporting event list error:",
        error
      );

      response
        .status(500)
        .json({
          success: false,
          error:
            "Reporting events could not be loaded."
        });
    }
  }
);

module.exports = router;