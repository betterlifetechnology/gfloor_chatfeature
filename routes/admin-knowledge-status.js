"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Approved Knowledge Status Administration
|--------------------------------------------------------------------------
|
| STEP 20J.6C
|
| Protected administrative endpoints for:
|
| GET /admin/knowledge/status/health
| GET /admin/knowledge/status/counts
| GET /admin/knowledge/:knowledgeId/status
| PUT /admin/knowledge/:knowledgeId/deactivate
| PUT /admin/knowledge/:knowledgeId/reactivate
|
| Deactivation removes knowledge from the live chatbot without deleting:
|
| - the approved knowledge record
| - reporting events
| - helpful feedback
| - historical reporting
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

const MAX_KNOWLEDGE_ID_LENGTH =
  200;

const MAX_REVIEWER_NAME_LENGTH =
  200;

const MAX_REASON_LENGTH =
  5000;

/*
|--------------------------------------------------------------------------
| Text Helpers
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
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      maximumLength
    );
}

function cleanKnowledgeId(
  value
) {
  let decodedValue =
    "";

  try {
    decodedValue =
      decodeURIComponent(
        String(
          value || ""
        )
      );
  } catch (
    error
  ) {
    decodedValue =
      String(
        value || ""
      );
  }

  return cleanText(
    decodedValue,
    MAX_KNOWLEDGE_ID_LENGTH
  );
}

/*
|--------------------------------------------------------------------------
| Admin Authentication
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

  if (
    headerToken
  ) {
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

  return crypto.timingSafeEqual(
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

  if (
    !expectedToken
  ) {
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
| Protect All Routes
|--------------------------------------------------------------------------
*/

router.use(
  requireAdmin
);

/*
|--------------------------------------------------------------------------
| Response Helpers
|--------------------------------------------------------------------------
*/

function statusRecordResponse(
  row
) {
  if (
    !row
  ) {
    return null;
  }

  return {
    id:
      row.id,

    trainingReviewId:
      row.training_review_id,

    knowledgeId:
      row.knowledge_id,

    category:
      row.category,

    question:
      row.question,

    responseType:
      row.response_type,

    active:
      row.active === true,

    activationStatus:
      row.active === true
        ? "active"
        : "inactive",

    approvedBy:
      row.approved_by,

    approvedAt:
      row.approved_at,

    deactivatedBy:
      row.deactivated_by,

    deactivatedAt:
      row.deactivated_at,

    deactivationReason:
      row.deactivation_reason,

    reactivatedBy:
      row.reactivated_by,

    reactivatedAt:
      row.reactivated_at,

    reactivationReason:
      row.reactivation_reason,

    statusUpdatedAt:
      row.status_updated_at,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}

async function findKnowledgeRecord(
  knowledgeId,
  client
) {
  const database =
    client || {
      query
    };

  const result =
    await database.query(
      `
        SELECT
          id,
          training_review_id,
          knowledge_id,
          category,
          question,
          response_type,
          active,
          approved_by,
          approved_at,
          deactivated_by,
          deactivated_at,
          deactivation_reason,
          reactivated_by,
          reactivated_at,
          reactivation_reason,
          status_updated_at,
          created_at,
          updated_at
        FROM
          chat_approved_knowledge
        WHERE
          knowledge_id = $1
        LIMIT 1;
      `,
      [
        knowledgeId
      ]
    );

  return result.rows[0] ||
    null;
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
|
| GET /admin/knowledge/status/health
|
|--------------------------------------------------------------------------
*/

router.get(
  "/knowledge/status/health",
  async function (
    request,
    response
  ) {
    try {
      const database =
        await checkConnection();

      const schemaResult =
        await query(
          `
            SELECT

              COUNT(*) FILTER (
                WHERE column_name = 'deactivated_by'
              )::integer AS has_deactivated_by,

              COUNT(*) FILTER (
                WHERE column_name = 'deactivated_at'
              )::integer AS has_deactivated_at,

              COUNT(*) FILTER (
                WHERE column_name = 'deactivation_reason'
              )::integer AS has_deactivation_reason,

              COUNT(*) FILTER (
                WHERE column_name = 'reactivated_by'
              )::integer AS has_reactivated_by,

              COUNT(*) FILTER (
                WHERE column_name = 'reactivated_at'
              )::integer AS has_reactivated_at,

              COUNT(*) FILTER (
                WHERE column_name = 'reactivation_reason'
              )::integer AS has_reactivation_reason,

              COUNT(*) FILTER (
                WHERE column_name = 'status_updated_at'
              )::integer AS has_status_updated_at

            FROM
              information_schema.columns

            WHERE
              table_schema = 'public'
              AND table_name = 'chat_approved_knowledge';
          `
        );

      const schema =
        schemaResult.rows[0] ||
        {};

      const requiredFieldsReady =
        Number(
          schema.has_deactivated_by
        ) === 1 &&
        Number(
          schema.has_deactivated_at
        ) === 1 &&
        Number(
          schema.has_deactivation_reason
        ) === 1 &&
        Number(
          schema.has_reactivated_by
        ) === 1 &&
        Number(
          schema.has_reactivated_at
        ) === 1 &&
        Number(
          schema.has_reactivation_reason
        ) === 1 &&
        Number(
          schema.has_status_updated_at
        ) === 1;

      response
        .status(
          requiredFieldsReady
            ? 200
            : 503
        )
        .json({
          success:
            requiredFieldsReady,

          statusApi:
            true,

          schemaReady:
            requiredFieldsReady,

          database
        });
    } catch (
      error
    ) {
      console.error(
        "Approved knowledge status health error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          statusApi:
            true,

          schemaReady:
            false,

          error:
            "Approved knowledge status database check failed."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Status Counts
|--------------------------------------------------------------------------
|
| GET /admin/knowledge/status/counts
|
|--------------------------------------------------------------------------
*/

router.get(
  "/knowledge/status/counts",
  async function (
    request,
    response
  ) {
    try {
      const result =
        await query(
          `
            SELECT

              COUNT(*)::integer AS total,

              COUNT(*) FILTER (
                WHERE active = TRUE
              )::integer AS active,

              COUNT(*) FILTER (
                WHERE active = FALSE
              )::integer AS inactive

            FROM
              chat_approved_knowledge;
          `
        );

      response.json({
        success:
          true,

        counts:
          result.rows[0] || {
            total:
              0,

            active:
              0,

            inactive:
              0
          }
      });
    } catch (
      error
    ) {
      console.error(
        "Approved knowledge status counts error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Unable to load approved knowledge status counts."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Get One Knowledge Status
|--------------------------------------------------------------------------
|
| GET /admin/knowledge/:knowledgeId/status
|
|--------------------------------------------------------------------------
*/

router.get(
  "/knowledge/:knowledgeId/status",
  async function (
    request,
    response
  ) {
    try {
      const knowledgeId =
        cleanKnowledgeId(
          request.params
            .knowledgeId
        );

      if (
        !knowledgeId
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "A valid approved knowledge ID is required."
          });
      }

      const knowledge =
        await findKnowledgeRecord(
          knowledgeId
        );

      if (
        !knowledge
      ) {
        return response
          .status(404)
          .json({
            success:
              false,

            error:
              "Approved knowledge record was not found."
          });
      }

      response.json({
        success:
          true,

        knowledge:
          statusRecordResponse(
            knowledge
          )
      });
    } catch (
      error
    ) {
      console.error(
        "Approved knowledge status lookup error:",
        error
      );

      response
        .status(500)
        .json({
          success:
            false,

          error:
            "Unable to load approved knowledge status."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Deactivate Approved Knowledge
|--------------------------------------------------------------------------
|
| PUT /admin/knowledge/:knowledgeId/deactivate
|
| JSON body:
|
| {
|   "reviewerName": "BLT Marketing",
|   "reason": "Temporary test record is no longer needed."
| }
|
|--------------------------------------------------------------------------
*/

router.put(
  "/knowledge/:knowledgeId/deactivate",
  async function (
    request,
    response
  ) {
    try {
      const knowledgeId =
        cleanKnowledgeId(
          request.params
            .knowledgeId
        );

      const reviewerName =
        cleanText(
          request.body &&
          request.body
            .reviewerName,
          MAX_REVIEWER_NAME_LENGTH
        );

      const reason =
        cleanText(
          request.body &&
          request.body.reason,
          MAX_REASON_LENGTH
        );

      if (
        !knowledgeId
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "A valid approved knowledge ID is required."
          });
      }

      if (
        !reviewerName
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Reviewer name is required."
          });
      }

      if (
        reason.length < 5
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "A deactivation reason of at least five characters is required."
          });
      }

      const result =
        await withTransaction(
          async function (
            client
          ) {
            const current =
              await findKnowledgeRecord(
                knowledgeId,
                client
              );

            if (
              !current
            ) {
              const notFound =
                new Error(
                  "Approved knowledge record was not found."
                );

              notFound.statusCode =
                404;

              throw notFound;
            }

            if (
              current.active !==
              true
            ) {
              const conflict =
                new Error(
                  "Approved knowledge is already inactive."
                );

              conflict.statusCode =
                409;

              conflict.current =
                current;

              throw conflict;
            }

            const updatedResult =
              await client.query(
                `
                  UPDATE
                    chat_approved_knowledge

                  SET
                    active = FALSE,

                    deactivated_by = $2,

                    deactivated_at = NOW(),

                    deactivation_reason = $3,

                    status_updated_at = NOW(),

                    updated_at = NOW()

                  WHERE
                    knowledge_id = $1
                    AND active = TRUE

                  RETURNING
                    id,
                    training_review_id,
                    knowledge_id,
                    category,
                    question,
                    response_type,
                    active,
                    approved_by,
                    approved_at,
                    deactivated_by,
                    deactivated_at,
                    deactivation_reason,
                    reactivated_by,
                    reactivated_at,
                    reactivation_reason,
                    status_updated_at,
                    created_at,
                    updated_at;
                `,
                [
                  knowledgeId,
                  reviewerName,
                  reason
                ]
              );

            if (
              !updatedResult
                .rows
                .length
            ) {
              const conflict =
                new Error(
                  "Approved knowledge could not be deactivated because its status changed."
                );

              conflict.statusCode =
                409;

              throw conflict;
            }

            return updatedResult
              .rows[0];
          }
        );

      console.log(
        "Approved knowledge deactivated:",
        {
          knowledgeId,

          reviewerName
        }
      );

      response.json({
        success:
          true,

        message:
          "Approved knowledge was deactivated. Reporting history was preserved.",

        knowledge:
          statusRecordResponse(
            result
          )
      });
    } catch (
      error
    ) {
      console.error(
        "Approved knowledge deactivation error:",
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
              : "Unable to deactivate approved knowledge.",

          knowledge:
            error.current
              ? statusRecordResponse(
                  error.current
                )
              : undefined
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Reactivate Approved Knowledge
|--------------------------------------------------------------------------
|
| PUT /admin/knowledge/:knowledgeId/reactivate
|
| JSON body:
|
| {
|   "reviewerName": "BLT Marketing",
|   "reason": "The information has been reviewed and may be used again."
| }
|
|--------------------------------------------------------------------------
*/

router.put(
  "/knowledge/:knowledgeId/reactivate",
  async function (
    request,
    response
  ) {
    try {
      const knowledgeId =
        cleanKnowledgeId(
          request.params
            .knowledgeId
        );

      const reviewerName =
        cleanText(
          request.body &&
          request.body
            .reviewerName,
          MAX_REVIEWER_NAME_LENGTH
        );

      const reason =
        cleanText(
          request.body &&
          request.body.reason,
          MAX_REASON_LENGTH
        );

      if (
        !knowledgeId
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "A valid approved knowledge ID is required."
          });
      }

      if (
        !reviewerName
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "Reviewer name is required."
          });
      }

      if (
        reason.length < 5
      ) {
        return response
          .status(400)
          .json({
            success:
              false,

            error:
              "A reactivation reason of at least five characters is required."
          });
      }

      const result =
        await withTransaction(
          async function (
            client
          ) {
            const current =
              await findKnowledgeRecord(
                knowledgeId,
                client
              );

            if (
              !current
            ) {
              const notFound =
                new Error(
                  "Approved knowledge record was not found."
                );

              notFound.statusCode =
                404;

              throw notFound;
            }

            if (
              current.active ===
              true
            ) {
              const conflict =
                new Error(
                  "Approved knowledge is already active."
                );

              conflict.statusCode =
                409;

              conflict.current =
                current;

              throw conflict;
            }

            const updatedResult =
              await client.query(
                `
                  UPDATE
                    chat_approved_knowledge

                  SET
                    active = TRUE,

                    reactivated_by = $2,

                    reactivated_at = NOW(),

                    reactivation_reason = $3,

                    status_updated_at = NOW(),

                    updated_at = NOW()

                  WHERE
                    knowledge_id = $1
                    AND active = FALSE

                  RETURNING
                    id,
                    training_review_id,
                    knowledge_id,
                    category,
                    question,
                    response_type,
                    active,
                    approved_by,
                    approved_at,
                    deactivated_by,
                    deactivated_at,
                    deactivation_reason,
                    reactivated_by,
                    reactivated_at,
                    reactivation_reason,
                    status_updated_at,
                    created_at,
                    updated_at;
                `,
                [
                  knowledgeId,
                  reviewerName,
                  reason
                ]
              );

            if (
              !updatedResult
                .rows
                .length
            ) {
              const conflict =
                new Error(
                  "Approved knowledge could not be reactivated because its status changed."
                );

              conflict.statusCode =
                409;

              throw conflict;
            }

            return updatedResult
              .rows[0];
          }
        );

      console.log(
        "Approved knowledge reactivated:",
        {
          knowledgeId,

          reviewerName
        }
      );

      response.json({
        success:
          true,

        message:
          "Approved knowledge was reactivated.",

        knowledge:
          statusRecordResponse(
            result
          )
      });
    } catch (
      error
    ) {
      console.error(
        "Approved knowledge reactivation error:",
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
              : "Unable to reactivate approved knowledge.",

          knowledge:
            error.current
              ? statusRecordResponse(
                  error.current
                )
              : undefined
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