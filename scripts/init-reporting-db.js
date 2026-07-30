"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Approved Knowledge Reporting Database Initialization
|--------------------------------------------------------------------------
|
| STEP 20J.1
|
| Creates the PostgreSQL tables, indexes, and views used by the approved
| knowledge reporting dashboard.
|
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const path = require("path");

const {
  query,
  closePool
} = require("../db/review-db");

require("dotenv").config();

const schemaPath = path.join(
  __dirname,
  "..",
  "db",
  "schema-reporting.sql"
);

function printDivider() {
  console.log(
    "============================================================"
  );
}

async function initializeReportingDatabase() {
  printDivider();

  console.log(
    "G-FLOOR APPROVED KNOWLEDGE REPORTING DATABASE"
  );

  console.log(
    "STEP 20J.1 INITIALIZATION"
  );

  printDivider();

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `Reporting schema file was not found: ${schemaPath}`
    );
  }

  const schemaSql = fs.readFileSync(
    schemaPath,
    "utf8"
  );

  if (!schemaSql.trim()) {
    throw new Error(
      "The reporting schema file is empty."
    );
  }

  console.log(
    "Applying reporting database schema..."
  );

  await query(schemaSql);

  console.log(
    "Reporting schema applied."
  );

  const tableCheck = await query(
    `
      SELECT
        to_regclass(
          'public.chat_approved_knowledge_events'
        ) AS reporting_table;
    `
  );

  if (
    !tableCheck.rows[0] ||
    !tableCheck.rows[0].reporting_table
  ) {
    throw new Error(
      "The chat_approved_knowledge_events table was not created."
    );
  }

  const viewCheck = await query(
    `
      SELECT
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
        ) AS reporting_totals;
    `
  );

  const views =
    viewCheck.rows[0] || {};

  const missingViews = [];

  if (!views.knowledge_summary) {
    missingViews.push(
      "chat_approved_knowledge_reporting_summary"
    );
  }

  if (!views.category_summary) {
    missingViews.push(
      "chat_approved_knowledge_category_summary"
    );
  }

  if (!views.daily_summary) {
    missingViews.push(
      "chat_approved_knowledge_daily_summary"
    );
  }

  if (!views.reporting_totals) {
    missingViews.push(
      "chat_approved_knowledge_reporting_totals"
    );
  }

  if (missingViews.length > 0) {
    throw new Error(
      "Missing reporting views: " +
      missingViews.join(", ")
    );
  }

  const totalsResult = await query(
    `
      SELECT
        total_answers,
        total_helpful_yes,
        total_helpful_no,
        total_feedback,
        knowledge_entries_used,
        conversations,
        helpful_rate,
        first_event_at,
        last_event_at
      FROM
        chat_approved_knowledge_reporting_totals;
    `
  );

  const totals =
    totalsResult.rows[0] || {};

  console.log("");

  console.log(
    "Current reporting totals:"
  );

  console.log(
    `  Answers: ${
      totals.total_answers || 0
    }`
  );

  console.log(
    `  Helpful Yes: ${
      totals.total_helpful_yes || 0
    }`
  );

  console.log(
    `  Helpful No: ${
      totals.total_helpful_no || 0
    }`
  );

  console.log(
    `  Feedback: ${
      totals.total_feedback || 0
    }`
  );

  console.log(
    `  Knowledge entries used: ${
      totals.knowledge_entries_used || 0
    }`
  );

  console.log(
    `  Conversations: ${
      totals.conversations || 0
    }`
  );

  console.log(
    `  Helpful rate: ${
      totals.helpful_rate == null
        ? "Not available"
        : totals.helpful_rate + "%"
    }`
  );

  console.log("");

  printDivider();

  console.log(
    "STEP 20J.1 PASSED"
  );

  console.log(
    "Approved knowledge reporting database is ready."
  );

  printDivider();
}

initializeReportingDatabase()
  .catch(
    function (error) {
      console.error("");

      printDivider();

      console.error(
        "STEP 20J.1 FAILED"
      );

      printDivider();

      console.error(
        error.message
      );

      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          error.stack
        );
      }

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