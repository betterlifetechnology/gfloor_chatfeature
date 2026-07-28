"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Approved Chat Knowledge API
|--------------------------------------------------------------------------
|
| STEP 20G
|
| PURPOSE
|
| Expose ONLY human-approved, active chatbot knowledge to the public
| G-Floor chat widget.
|
| IMPORTANT
|
| This router NEVER exposes:
|
| - pending-review records
| - denied records
| - original Customer Service emails
| - customer names
| - customer email addresses
| - customer phone numbers
| - reviewer notes
| - ADMIN_TOKEN
|
| It reads exclusively from:
|
|     chat_active_knowledge
|
|--------------------------------------------------------------------------
*/

const express =
  require("express");

const {
  query
} =
  require(
    "../db/review-db"
  );

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function cleanText(
  value
) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}

function cleanVariations(
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
          item
        );
      }
    )
    .filter(Boolean)
    .slice(
      0,
      50
    );
}

function convertResponseType(
  value
) {
  const normalized =
    cleanText(
      value
    )
      .toUpperCase();

  /*
   * Existing widget.js uses:
   *
   * AUTO ANSWER
   * HUMAN REVIEW
   * ALWAYS ESCALATE
   *
   * PostgreSQL stores:
   *
   * AUTO
   * HUMAN REVIEW
   * ALWAYS ESCALATE
   */

  if (
    normalized ===
    "AUTO"
  ) {
    return "AUTO ANSWER";
  }

  if (
    normalized ===
    "ALWAYS ESCALATE"
  ) {
    return "ALWAYS ESCALATE";
  }

  return "HUMAN REVIEW";
}

function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
|
| GET /chat/approved-knowledge/health
|
|--------------------------------------------------------------------------
*/

router.get(
  "/approved-knowledge/health",
  async function (
    request,
    response
  ) {
    try {
      const result =
        await query(
          `
            SELECT
              COUNT(*)::integer
                AS active_knowledge_count
            FROM
              chat_active_knowledge;
          `
        );

      return response.json({
        success:
          true,

        source:
          "human-approved-postgresql",

        activeKnowledgeCount:
          result.rows[0]
            .active_knowledge_count
      });

    } catch (
      error
    ) {
      console.error(
        "Approved knowledge health error:",
        error
      );

      return response
        .status(500)
        .json({
          success:
            false,

          error:
            "Approved knowledge is currently unavailable."
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Approved Knowledge JSON
|--------------------------------------------------------------------------
|
| GET /chat/approved-knowledge
|
| This is intentionally public because the chatbot needs to read it.
|
| ONLY chat_active_knowledge is returned.
|
|--------------------------------------------------------------------------
*/

router.get(
  "/approved-knowledge",
  async function (
    request,
    response
  ) {
    try {
      const result =
        await query(
          `
            SELECT
              knowledge_id,
              category,
              question,
              variations,
              answer,
              source_url,
              response_type,
              approved_by,
              approved_at,
              updated_at

            FROM
              chat_active_knowledge

            ORDER BY
              category ASC,
              question ASC;
          `
        );

      const knowledge =
        result.rows.map(
          function (
            row
          ) {
            return {
              id:
                cleanText(
                  row.knowledge_id
                ),

              category:
                cleanText(
                  row.category
                ),

              question:
                cleanText(
                  row.question
                ),

              variations:
                cleanVariations(
                  row.variations
                ),

              answer:
                cleanText(
                  row.answer
                ),

              sourceUrl:
                cleanText(
                  row.source_url
                ) ||
                null,

              responseType:
                convertResponseType(
                  row.response_type
                ),

              product:
                "Human Approved Knowledge",

              lastReviewed:
                formatDate(
                  row.updated_at ||
                  row.approved_at
                ),

              source:
                "approved-database"
            };
          }
        );

      /*
       * Do not cache aggressively.
       *
       * Newly approved knowledge should become available reasonably quickly.
       */

      response.set(
        "Cache-Control",
        "public, max-age=60, must-revalidate"
      );

      return response.json({
        success:
          true,

        source:
          "human-approved-postgresql",

        count:
          knowledge.length,

        knowledge:
          knowledge
      });

    } catch (
      error
    ) {
      console.error(
        "Approved knowledge API error:",
        error
      );

      return response
        .status(500)
        .json({
          success:
            false,

          error:
            "Approved chatbot knowledge is currently unavailable.",

          knowledge:
            []
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Dynamic Approved Knowledge Loader
|--------------------------------------------------------------------------
|
| GET /chat/approved-knowledge.js
|
| This route produces JavaScript that integrates approved PostgreSQL
| knowledge into the existing:
|
|     window.GFloorKnowledgeBase
|
| without modifying the giant widget.js.
|
|--------------------------------------------------------------------------
*/

router.get(
  "/approved-knowledge.js",
  async function (
    request,
    response
  ) {
    try {
      const result =
        await query(
          `
            SELECT
              knowledge_id,
              category,
              question,
              variations,
              answer,
              source_url,
              response_type,
              approved_at,
              updated_at

            FROM
              chat_active_knowledge

            ORDER BY
              category ASC,
              question ASC;
          `
        );

      const approvedKnowledge =
        result.rows.map(
          function (
            row
          ) {
            return {
              id:
                cleanText(
                  row.knowledge_id
                ),

              category:
                cleanText(
                  row.category
                ),

              question:
                cleanText(
                  row.question
                ),

              variations:
                cleanVariations(
                  row.variations
                ),

              answer:
                cleanText(
                  row.answer
                ),

              sourceUrl:
                cleanText(
                  row.source_url
                ) ||
                null,

              responseType:
                convertResponseType(
                  row.response_type
                ),

              product:
                "Human Approved Knowledge",

              lastReviewed:
                formatDate(
                  row.updated_at ||
                  row.approved_at
                ),

              source:
                "approved-database"
            };
          }
        );

      const serialized =
        JSON.stringify(
          approvedKnowledge
        ).replace(
          /</g,
          "\\u003c"
        );

      /*
       * We install a getter/setter before widget.js loads.
       *
       * Later, when knowledge-base.js assigns:
       *
       * window.GFloorKnowledgeBase = [...]
       *
       * this setter automatically merges:
       *
       * static approved KB
       * +
       * PostgreSQL human-approved KB
       */

      const script = `
(function () {
  "use strict";

  var approvedKnowledge =
    ${serialized};

  var currentKnowledgeBase =
    Array.isArray(
      window.GFloorKnowledgeBase
    )
      ? window.GFloorKnowledgeBase.slice()
      : [];

  function mergeKnowledge(
    baseKnowledge
  ) {
    var base =
      Array.isArray(
        baseKnowledge
      )
        ? baseKnowledge.slice()
        : [];

    var seen =
      new Set();

    var merged =
      [];

    approvedKnowledge.forEach(
      function (
        item
      ) {
        if (
          !item ||
          !item.id
        ) {
          return;
        }

        if (
          seen.has(
            item.id
          )
        ) {
          return;
        }

        seen.add(
          item.id
        );

        merged.push(
          item
        );
      }
    );

    base.forEach(
      function (
        item
      ) {
        if (!item) {
          return;
        }

        var id =
          String(
            item.id ||
            ""
          );

        if (
          id &&
          seen.has(
            id
          )
        ) {
          return;
        }

        if (id) {
          seen.add(
            id
          );
        }

        merged.push(
          item
        );
      }
    );

    return merged;
  }

  currentKnowledgeBase =
    mergeKnowledge(
      currentKnowledgeBase
    );

  try {
    Object.defineProperty(
      window,
      "GFloorKnowledgeBase",
      {
        configurable:
          true,

        enumerable:
          true,

        get:
          function () {
            return currentKnowledgeBase;
          },

        set:
          function (
            incomingKnowledge
          ) {
            currentKnowledgeBase =
              mergeKnowledge(
                incomingKnowledge
              );
          }
      }
    );

  } catch (
    error
  ) {
    window.GFloorKnowledgeBase =
      mergeKnowledge(
        window.GFloorKnowledgeBase
      );
  }

  window.GFloorApprovedKnowledge =
    approvedKnowledge;

  window.GFloorApprovedKnowledgeLoaded =
    true;

  window.dispatchEvent(
    new CustomEvent(
      "gfloor-approved-knowledge-loaded",
      {
        detail: {
          count:
            approvedKnowledge.length
        }
      }
    )
  );

  if (
    window.console &&
    typeof window.console.log ===
    "function"
  ) {
    console.log(
      "G-Floor approved knowledge loaded:",
      approvedKnowledge.length
    );
  }
})();
`;

      response.set(
        "Content-Type",
        "application/javascript; charset=utf-8"
      );

      response.set(
        "Cache-Control",
        "public, max-age=60, must-revalidate"
      );

      return response.send(
        script
      );

    } catch (
      error
    ) {
      console.error(
        "Approved knowledge JavaScript error:",
        error
      );

      response.set(
        "Content-Type",
        "application/javascript; charset=utf-8"
      );

      response.set(
        "Cache-Control",
        "no-store"
      );

      /*
       * Fail safely.
       *
       * Existing static chatbot knowledge continues functioning even when
       * PostgreSQL approved knowledge cannot be loaded.
       */

      return response
        .status(200)
        .send(
          `
(function () {
  "use strict";

  window.GFloorApprovedKnowledge =
    [];

  window.GFloorApprovedKnowledgeLoaded =
    false;

  console.warn(
    "G-Floor approved PostgreSQL knowledge could not be loaded."
  );
})();
`
        );
    }
  }
);

module.exports =
  router;