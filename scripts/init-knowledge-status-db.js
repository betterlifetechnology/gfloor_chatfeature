"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Approved Knowledge Status Database Initialization
|--------------------------------------------------------------------------
|
| STEP 20J.6A
|
| Adds approved-knowledge deactivation and reactivation auditing without
| deleting approved knowledge or reporting history.
|
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const path = require("path");

require("dotenv").config();

const {
  query,
  closePool
} = require("../db/review-db");

const schemaPath = path.join(
  __dirname,
  "..",
  "db",
  "schema-knowledge-status.sql"
);

function divider() {
  console.log(
    "============================================================"
  );
}

async function initializeKnowledgeStatusDatabase() {
  divider();

  console.log(
    "G-FLOOR APPROVED KNOWLEDGE STATUS DATABASE"
  );

  console.log(
    "STEP 20J.6A INITIALIZATION"
  );

  divider();

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      "Knowledge status schema file was not found: " +
      schemaPath
    );
  }

  const schemaSql = fs.readFileSync(
    schemaPath,
    "utf8"
  );

  if (!schemaSql.trim()) {
    throw new Error(
      "The knowledge status schema file is empty."
    );
  }

  console.log(
    "Applying approved knowledge status schema..."
  );

  await query(
    schemaSql
  );

  console.log(
    "Approved knowledge status schema applied."
  );

  const columnResult = await query(
    `
      SELECT
        column_name
      FROM
        information_schema.columns
      WHERE
        table_schema = 'public'
        AND table_name = 'chat_approved_knowledge'
        AND column_name IN (
          'deactivated_by',
          'deactivated_at',
          'deactivation_reason',
          'reactivated_by',
          'reactivated_at',
          'reactivation_reason',
          'status_updated_at'
        )
      ORDER BY
        column_name;
    `
  );

  const existingColumns = new Set(
    columnResult.rows.map(
      function (row) {
        return row.column_name;
      }
    )
  );

  const requiredColumns = [
    "deactivated_by",
    "deactivated_at",
    "deactivation_reason",
    "reactivated_by",
    "reactivated_at",
    "reactivation_reason",
    "status_updated_at"
  ];

  const missingColumns = requiredColumns.filter(
    function (columnName) {
      return !existingColumns.has(
        columnName
      );
    }
  );

  if (missingColumns.length > 0) {
    throw new Error(
      "Missing approved knowledge status columns: " +
      missingColumns.join(", ")
    );
  }

  const viewResult = await query(
    `
      SELECT
        to_regclass(
          'public.chat_approved_knowledge_status'
        ) AS status_view;
    `
  );

  if (
    !viewResult.rows[0] ||
    !viewResult.rows[0].status_view
  ) {
    throw new Error(
      "The chat_approved_knowledge_status view was not created."
    );
  }

  const countsResult = await query(
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

  const counts =
    countsResult.rows[0] || {
      total: 0,
      active: 0,
      inactive: 0
    };

  console.log("");

  console.log(
    "Approved knowledge status counts:"
  );

  console.log(
    `  Total: ${counts.total || 0}`
  );

  console.log(
    `  Active: ${counts.active || 0}`
  );

  console.log(
    `  Inactive: ${counts.inactive || 0}`
  );

  console.log("");

  divider();

  console.log(
    "STEP 20J.6A PASSED"
  );

  console.log(
    "Approved knowledge status auditing is ready."
  );

  divider();
}

initializeKnowledgeStatusDatabase()
  .catch(
    function (error) {
      console.error("");

      divider();

      console.error(
        "STEP 20J.6A FAILED"
      );

      divider();

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