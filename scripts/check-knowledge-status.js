"use strict";

require("dotenv").config();

const {
  query,
  closePool
} = require("../db/review-db");

async function checkKnowledgeStatus() {
  const result = await query(`
    SELECT
      knowledge_id,
      active,
      deactivated_by,
      deactivated_at,
      deactivation_reason,
      reactivated_by,
      reactivated_at,
      reactivation_reason,
      status_updated_at
    FROM
      chat_approved_knowledge
    ORDER BY
      id DESC
    LIMIT 5;
  `);

  console.table(
    result.rows
  );
}

checkKnowledgeStatus()
  .catch(
    function (error) {
      console.error(
        "Knowledge status verification failed:"
      );

      console.error(
        error
      );

      process.exitCode = 1;
    }
  )
  .finally(
    async function () {
      try {
        await closePool();
      } catch (error) {
        console.error(
          "Could not close PostgreSQL pool:",
          error.message
        );
      }
    }
  );