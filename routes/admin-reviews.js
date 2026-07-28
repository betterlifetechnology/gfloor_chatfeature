"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Knowledge Review Admin API
|--------------------------------------------------------------------------
|
| STEP 20B
|
| Protected endpoints for:
|
| - listing incoming knowledge reviews
| - viewing one review
| - editing proposed chatbot content
| - approving knowledge
| - denying knowledge
| - dashboard counts
|
| All routes require ADMIN_TOKEN.
|
|--------------------------------------------------------------------------
*/

const express =
  require("express");

const crypto =
  require("crypto");

const {
  query,
  withTransaction,
  checkConnection
} =
  require("../db/review-db");

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const VALID_STATUSES =
  new Set([
    "pending-review",
    "approved",
    "denied"
  ]);

const VALID_RESPONSE_TYPES =
  new Set([
    "AUTO",
    "HUMAN REVIEW",
    "ALWAYS ESCALATE"
  ]);

const MAX_PAGE_SIZE =
  100;

const DEFAULT_PAGE_SIZE =
  25;

/*
|--------------------------------------------------------------------------
| Utility Helpers
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

  return String(
    value
  )
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
  const cleaned =
    cleanText(
      value,
      maximumLength
    );

  return cleaned ||
    null;
}

function cleanBoolean(
  value
) {
  return (
    value === true ||
    value === "true"
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
    !Number.isFinite(
      number
    ) ||
    number < 1
  ) {
    return fallback;
  }

  return number;
}

function cleanJsonArray(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      function (
        item
      ) {
        return cleanText(
          item,
          500
        );
      }
    )
    .filter(Boolean)
    .slice(
      0,
      50
    );
}

function parseReviewId(
  value
) {
  const id =
    Number.parseInt(
      value,
      10
    );

  if (
    !Number.isInteger(
      id
    ) ||
    id < 1
  ) {
    return null;
  }

  return id;
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
        success:
          false,

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
        success:
          false,

        error:
          "Unauthorized."
      });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| Protect Every Route In This Router
|--------------------------------------------------------------------------
*/

router.use(
  requireAdmin
);

/*
|--------------------------------------------------------------------------
| Admin API Health Check
|--------------------------------------------------------------------------
*/

router.get(
  "/reviews/health",
  async function (
    request,
    response
  ) {
    try {
      const database =
        await checkConnection();

      response.json({
        success:
          true,

        adminApi:
          true,

        database:
          database
      });
    } catch (
      error
    ) {
      console.error(
        "Admin review health error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Review database connection failed."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Review Counts
|--------------------------------------------------------------------------
|
| GET /admin/reviews/counts
|
|--------------------------------------------------------------------------
*/

router.get(
  "/reviews/counts",
  async function (
    request,
    response
  ) {
    try {
      const result =
        await query(
          `
            SELECT
              pending_review,
              approved,
              denied,
              total
            FROM
              chat_review_counts;
          `
        );

      const counts =
        result.rows[0] ||
        {
          pending_review:
            0,

          approved:
            0,

          denied:
            0,

          total:
            0
        };

      response.json({
        success:
          true,

        counts:
          counts
      });
    } catch (
      error
    ) {
      console.error(
        "Admin review counts error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Unable to load review counts."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| List Reviews
|--------------------------------------------------------------------------
|
| GET /admin/reviews
|
| Optional query:
|
| ?status=pending-review
| ?category=Installation
| ?search=plywood
| ?page=1
| ?limit=25
|
|--------------------------------------------------------------------------
*/

router.get(
  "/reviews",
  async function (
    request,
    response
  ) {
    try {
      const status =
        cleanText(
          request.query.status,
          30
        );

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
          page -
          1
        ) *
        limit;

      if (
        status &&
        !VALID_STATUSES.has(
          status
        )
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid review status."
          });
      }

      const conditions =
        [];

      const parameters =
        [];

      if (status) {
        parameters.push(
          status
        );

        conditions.push(
          `status = $${parameters.length}`
        );
      }

      if (category) {
        parameters.push(
          category
        );

        conditions.push(
          `suggested_category = $${parameters.length}`
        );
      }

      if (search) {
        parameters.push(
          "%" +
          search +
          "%"
        );

        const searchParameter =
          "$" +
          parameters.length;

        conditions.push(
          `(
            customer_question ILIKE ${searchParameter}
            OR customer_service_response ILIKE ${searchParameter}
            OR suggested_question ILIKE ${searchParameter}
            OR suggested_answer ILIKE ${searchParameter}
            OR source_subject ILIKE ${searchParameter}
          )`
        );
      }

      const whereClause =
        conditions.length
          ? (
              "WHERE " +
              conditions.join(
                " AND "
              )
            )
          : "";

      const countResult =
        await query(
          `
            SELECT
              COUNT(*)::integer AS total
            FROM
              chat_training_reviews
            ${whereClause};
          `,
          parameters
        );

      const listParameters =
        parameters.slice();

      listParameters.push(
        limit
      );

      const limitParameter =
        "$" +
        listParameters.length;

      listParameters.push(
        offset
      );

      const offsetParameter =
        "$" +
        listParameters.length;

      const result =
        await query(
          `
            SELECT
              id,
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
              status,
              reviewer_name,
              reviewer_notes,
              reviewed_at,
              created_at,
              updated_at
            FROM
              chat_training_reviews
            ${whereClause}
            ORDER BY
              CASE
                WHEN status = 'pending-review'
                THEN 0
                ELSE 1
              END,
              created_at DESC
            LIMIT
              ${limitParameter}
            OFFSET
              ${offsetParameter};
          `,
          listParameters
        );

      const total =
        countResult.rows[0]
          .total;

      response.json({
        success:
          true,

        reviews:
          result.rows,

        pagination: {
          page:
            page,

          limit:
            limit,

          total:
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
        "Admin review list error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Unable to load review queue."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Get One Review
|--------------------------------------------------------------------------
|
| GET /admin/reviews/:id
|
|--------------------------------------------------------------------------
*/

router.get(
  "/reviews/:id",
  async function (
    request,
    response
  ) {
    try {
      const reviewId =
        parseReviewId(
          request.params.id
        );

      if (!reviewId) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid review ID."
          });
      }

      const result =
        await query(
          `
            SELECT
              *
            FROM
              chat_training_reviews
            WHERE
              id = $1
            LIMIT 1;
          `,
          [
            reviewId
          ]
        );

      if (
        !result.rows.length
      ) {
        return response
          .status(404)
          .json({
            success:
              false,

            error:
              "Review not found."
          });
      }

      response.json({
        success:
          true,

        review:
          result.rows[0]
      });
    } catch (
      error
    ) {
      console.error(
        "Admin review detail error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Unable to load review."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Edit Pending Review
|--------------------------------------------------------------------------
|
| PUT /admin/reviews/:id
|
| Editable:
|
| suggestedQuestion
| suggestedAnswer
| suggestedCategory
| suggestedVariations
| suggestedSourceUrl
| suggestedResponseType
| sensitiveReviewCompleted
| reviewerName
| reviewerNotes
|
|--------------------------------------------------------------------------
*/

router.put(
  "/reviews/:id",
  async function (
    request,
    response
  ) {
    try {
      const reviewId =
        parseReviewId(
          request.params.id
        );

      if (!reviewId) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid review ID."
          });
      }

      const existingResult =
        await query(
          `
            SELECT
              *
            FROM
              chat_training_reviews
            WHERE
              id = $1
            LIMIT 1;
          `,
          [
            reviewId
          ]
        );

      if (
        !existingResult
          .rows
          .length
      ) {
        return response
          .status(404)
          .json({
            success:
              false,

            error:
              "Review not found."
          });
      }

      const existing =
        existingResult.rows[0];

      if (
        existing.status !==
        "pending-review"
      ) {
        return response
          .status(409)
          .json({
            success:
              false,

            error:
              "Only pending reviews can be edited."
          });
      }

      const body =
        request.body ||
        {};

      const suggestedQuestion =
        body.suggestedQuestion !==
        undefined
          ? cleanOptionalText(
              body.suggestedQuestion,
              5000
            )
          : existing
              .suggested_question;

      const suggestedAnswer =
        body.suggestedAnswer !==
        undefined
          ? cleanOptionalText(
              body.suggestedAnswer,
              20000
            )
          : existing
              .suggested_answer;

      const suggestedCategory =
        body.suggestedCategory !==
        undefined
          ? cleanOptionalText(
              body.suggestedCategory,
              150
            )
          : existing
              .suggested_category;

      const suggestedVariations =
        body.suggestedVariations !==
        undefined
          ? cleanJsonArray(
              body.suggestedVariations
            )
          : existing
              .suggested_variations;

      const suggestedSourceUrl =
        body.suggestedSourceUrl !==
        undefined
          ? cleanOptionalText(
              body.suggestedSourceUrl,
              3000
            )
          : existing
              .suggested_source_url;

      const suggestedResponseType =
        body.suggestedResponseType !==
        undefined
          ? cleanText(
              body.suggestedResponseType,
              50
            )
              .toUpperCase()
          : existing
              .suggested_response_type;

      if (
        !VALID_RESPONSE_TYPES.has(
          suggestedResponseType
        )
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid suggested response type."
          });
      }

      const sensitiveReviewCompleted =
        body.sensitiveReviewCompleted !==
        undefined
          ? cleanBoolean(
              body.sensitiveReviewCompleted
            )
          : existing
              .sensitive_review_completed;

      const reviewerName =
        body.reviewerName !==
        undefined
          ? cleanOptionalText(
              body.reviewerName,
              200
            )
          : existing
              .reviewer_name;

      const reviewerNotes =
        body.reviewerNotes !==
        undefined
          ? cleanOptionalText(
              body.reviewerNotes,
              10000
            )
          : existing
              .reviewer_notes;

      const result =
        await query(
          `
            UPDATE
              chat_training_reviews
            SET
              suggested_question = $2,
              suggested_answer = $3,
              suggested_category = $4,
              suggested_variations = $5::jsonb,
              suggested_source_url = $6,
              suggested_response_type = $7,
              sensitive_review_completed = $8,
              reviewer_name = $9,
              reviewer_notes = $10
            WHERE
              id = $1
            RETURNING
              *;
          `,
          [
            reviewId,
            suggestedQuestion,
            suggestedAnswer,
            suggestedCategory,
            JSON.stringify(
              suggestedVariations
            ),
            suggestedSourceUrl,
            suggestedResponseType,
            sensitiveReviewCompleted,
            reviewerName,
            reviewerNotes
          ]
        );

      response.json({
        success:
          true,

        message:
          "Review updated.",

        review:
          result.rows[0]
      });
    } catch (
      error
    ) {
      console.error(
        "Admin review update error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Unable to update review."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Generate Knowledge ID
|--------------------------------------------------------------------------
*/

function slugify(
  value
) {
  return cleanText(
    value,
    200
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .slice(
      0,
      80
    );
}

function buildKnowledgeId(
  category,
  question,
  reviewId
) {
  const categoryPart =
    slugify(
      category
    ) ||
    "general";

  const questionPart =
    slugify(
      question
    ) ||
    "knowledge";

  return (
    "email-" +
    categoryPart +
    "-" +
    questionPart +
    "-" +
    reviewId
  ).slice(
    0,
    150
  );
}

/*
|--------------------------------------------------------------------------
| Approve Review
|--------------------------------------------------------------------------
|
| POST /admin/reviews/:id/approve
|
| Requires:
|
| reviewerName
|
| Optional:
|
| reviewerNotes
|
|--------------------------------------------------------------------------
*/

router.post(
  "/reviews/:id/approve",
  async function (
    request,
    response
  ) {
    try {
      const reviewId =
        parseReviewId(
          request.params.id
        );

      if (!reviewId) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid review ID."
          });
      }

      const reviewerName =
        cleanText(
          request.body &&
          request.body
            .reviewerName,
          200
        );

      const reviewerNotes =
        cleanOptionalText(
          request.body &&
          request.body
            .reviewerNotes,
          10000
        );

      if (!reviewerName) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Reviewer name is required."
          });
      }

      const approval =
        await withTransaction(
          async function (
            client
          ) {
            const reviewResult =
              await client.query(
                `
                  SELECT
                    *
                  FROM
                    chat_training_reviews
                  WHERE
                    id = $1
                  FOR UPDATE;
                `,
                [
                  reviewId
                ]
              );

            if (
              !reviewResult
                .rows
                .length
            ) {
              const error =
                new Error(
                  "Review not found."
                );

              error.statusCode =
                404;

              throw error;
            }

            const review =
              reviewResult.rows[0];

            if (
              review.status !==
              "pending-review"
            ) {
              const error =
                new Error(
                  "Only pending reviews can be approved."
                );

              error.statusCode =
                409;

              throw error;
            }

            if (
              review
                .requires_sensitive_review &&
              !review
                .sensitive_review_completed
            ) {
              const error =
                new Error(
                  "Sensitive-information review must be completed before approval."
                );

              error.statusCode =
                409;

              throw error;
            }

            const question =
              cleanText(
                review
                  .suggested_question,
                5000
              );

            const answer =
              cleanText(
                review
                  .suggested_answer,
                20000
              );

            const category =
              cleanText(
                review
                  .suggested_category,
                150
              );

            if (
              !question ||
              !answer ||
              !category
            ) {
              const error =
                new Error(
                  "Suggested question, answer, and category are required before approval."
                );

              error.statusCode =
                400;

              throw error;
            }

            const responseType =
              cleanText(
                review
                  .suggested_response_type ||
                "AUTO",
                50
              ).toUpperCase();

            if (
              !VALID_RESPONSE_TYPES.has(
                responseType
              )
            ) {
              const error =
                new Error(
                  "Suggested response type is invalid."
                );

              error.statusCode =
                400;

              throw error;
            }

            const knowledgeId =
              buildKnowledgeId(
                category,
                question,
                reviewId
              );

            const knowledgeResult =
              await client.query(
                `
                  INSERT INTO
                    chat_approved_knowledge
                    (
                      training_review_id,
                      knowledge_id,
                      category,
                      question,
                      variations,
                      answer,
                      source_url,
                      response_type,
                      active,
                      approved_by,
                      approved_at
                    )
                  VALUES
                    (
                      $1,
                      $2,
                      $3,
                      $4,
                      $5::jsonb,
                      $6,
                      $7,
                      $8,
                      TRUE,
                      $9,
                      NOW()
                    )
                  RETURNING
                    *;
                `,
                [
                  reviewId,
                  knowledgeId,
                  category,
                  question,
                  JSON.stringify(
                    Array.isArray(
                      review
                        .suggested_variations
                    )
                      ? review
                          .suggested_variations
                      : []
                  ),
                  answer,
                  review
                    .suggested_source_url,
                  responseType,
                  reviewerName
                ]
              );

            const updatedReviewResult =
              await client.query(
                `
                  UPDATE
                    chat_training_reviews
                  SET
                    status = 'approved',
                    reviewer_name = $2,
                    reviewer_notes = $3,
                    reviewed_at = NOW()
                  WHERE
                    id = $1
                  RETURNING
                    *;
                `,
                [
                  reviewId,
                  reviewerName,
                  reviewerNotes
                ]
              );

            return {
              review:
                updatedReviewResult
                  .rows[0],

              knowledge:
                knowledgeResult
                  .rows[0]
            };
          }
        );

      response.json({
        success:
          true,

        message:
          "Knowledge approved.",

        review:
          approval.review,

        knowledge:
          approval.knowledge
      });
    } catch (
      error
    ) {
      console.error(
        "Admin review approval error:",
        error
      );

      response
        .status(
          error.statusCode ||
          500
        )
        .json({
          success:
            false,

          error:
            error.statusCode
              ? error.message
              : "Unable to approve review."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Deny Review
|--------------------------------------------------------------------------
|
| POST /admin/reviews/:id/deny
|
| Requires:
|
| reviewerName
| reviewerNotes
|
|--------------------------------------------------------------------------
*/

router.post(
  "/reviews/:id/deny",
  async function (
    request,
    response
  ) {
    try {
      const reviewId =
        parseReviewId(
          request.params.id
        );

      if (!reviewId) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Invalid review ID."
          });
      }

      const reviewerName =
        cleanText(
          request.body &&
          request.body
            .reviewerName,
          200
        );

      const reviewerNotes =
        cleanText(
          request.body &&
          request.body
            .reviewerNotes,
          10000
        );

      if (!reviewerName) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Reviewer name is required."
          });
      }

      if (!reviewerNotes) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "A denial reason is required."
          });
      }

      const result =
        await query(
          `
            UPDATE
              chat_training_reviews
            SET
              status = 'denied',
              reviewer_name = $2,
              reviewer_notes = $3,
              reviewed_at = NOW()
            WHERE
              id = $1
              AND status = 'pending-review'
            RETURNING
              *;
          `,
          [
            reviewId,
            reviewerName,
            reviewerNotes
          ]
        );

      if (
        !result.rows.length
      ) {
        const existing =
          await query(
            `
              SELECT
                id,
                status
              FROM
                chat_training_reviews
              WHERE
                id = $1;
            `,
            [
              reviewId
            ]
          );

        if (
          !existing.rows.length
        ) {
          return response
            .status(404)
            .json({
              success:
                false,

              error:
                "Review not found."
            });
        }

        return response
          .status(409)
          .json({
            success:
              false,

            error:
              "Only pending reviews can be denied."
          });
      }

      response.json({
        success:
          true,

        message:
          "Review denied.",

        review:
          result.rows[0]
      });
    } catch (
      error
    ) {
      console.error(
        "Admin review denial error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Unable to deny review."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Export Router
|--------------------------------------------------------------------------
*/

module.exports =
  router;