"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Chat Review Database Initializer
|--------------------------------------------------------------------------
|
| STEP 20A
|
| Creates the PostgreSQL tables, indexes, triggers, and views required for:
|
| - Customer Service email review
| - Approve / Edit / Deny workflow
| - Approved chatbot knowledge
| - Sensitive information review
| - Duplicate detection
|
|--------------------------------------------------------------------------
*/

const fs =
  require("fs");

const path =
  require("path");

const {
  Pool
} =
  require("pg");

require("dotenv")
  .config();

/*
|--------------------------------------------------------------------------
| Paths
|--------------------------------------------------------------------------
*/

const ROOT_DIRECTORY =
  path.resolve(
    __dirname,
    ".."
  );

const SCHEMA_FILE =
  path.join(
    ROOT_DIRECTORY,
    "db",
    "schema-review.sql"
  );

/*
|--------------------------------------------------------------------------
| Database Configuration
|--------------------------------------------------------------------------
*/

function getDatabaseConfiguration() {
  const databaseUrl =
    String(
      process.env.DATABASE_URL ||
      ""
    ).trim();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  const sslEnabled =
    String(
      process.env.DATABASE_SSL ||
      "false"
    )
      .trim()
      .toLowerCase() ===
    "true";

  return {
    connectionString:
      databaseUrl,

    ssl:
      sslEnabled
        ? {
            rejectUnauthorized:
              false
          }
        : false
  };
}

/*
|--------------------------------------------------------------------------
| Read Schema
|--------------------------------------------------------------------------
*/

function readSchema() {
  if (
    !fs.existsSync(
      SCHEMA_FILE
    )
  ) {
    throw new Error(
      "Database schema file could not be found: " +
      SCHEMA_FILE
    );
  }

  const schema =
    fs.readFileSync(
      SCHEMA_FILE,
      "utf8"
    );

  if (
    !schema.trim()
  ) {
    throw new Error(
      "Database schema file is empty."
    );
  }

  return schema;
}

/*
|--------------------------------------------------------------------------
| Verify Tables
|--------------------------------------------------------------------------
*/

async function verifyTables(
  client
) {
  const expectedTables = [
    "chat_training_reviews",
    "chat_approved_knowledge"
  ];

  const result =
    await client.query(
      `
        SELECT
          table_name
        FROM
          information_schema.tables
        WHERE
          table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY
          table_name;
      `,
      [
        expectedTables
      ]
    );

  const foundTables =
    result.rows.map(
      function (
        row
      ) {
        return row.table_name;
      }
    );

  const missingTables =
    expectedTables.filter(
      function (
        tableName
      ) {
        return !foundTables.includes(
          tableName
        );
      }
    );

  return {
    foundTables:
      foundTables,

    missingTables:
      missingTables
  };
}

/*
|--------------------------------------------------------------------------
| Verify Views
|--------------------------------------------------------------------------
*/

async function verifyViews(
  client
) {
  const expectedViews = [
    "chat_pending_reviews",
    "chat_review_counts",
    "chat_active_knowledge"
  ];

  const result =
    await client.query(
      `
        SELECT
          table_name
        FROM
          information_schema.views
        WHERE
          table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY
          table_name;
      `,
      [
        expectedViews
      ]
    );

  const foundViews =
    result.rows.map(
      function (
        row
      ) {
        return row.table_name;
      }
    );

  const missingViews =
    expectedViews.filter(
      function (
        viewName
      ) {
        return !foundViews.includes(
          viewName
        );
      }
    );

  return {
    foundViews:
      foundViews,

    missingViews:
      missingViews
  };
}

/*
|--------------------------------------------------------------------------
| Get Initial Counts
|--------------------------------------------------------------------------
*/

async function getReviewCounts(
  client
) {
  const result =
    await client.query(
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

  if (
    !result.rows.length
  ) {
    return {
      pending_review: 0,
      approved: 0,
      denied: 0,
      total: 0
    };
  }

  return result.rows[0];
}

/*
|--------------------------------------------------------------------------
| Initialize Database
|--------------------------------------------------------------------------
*/

async function initializeDatabase() {
  let pool;

  try {
    console.log("");
    console.log(
      "=============================================="
    );

    console.log(
      "G-FLOOR CHAT REVIEW DATABASE"
    );

    console.log(
      "STEP 20A INITIALIZATION"
    );

    console.log(
      "=============================================="
    );

    console.log("");

    const databaseConfiguration =
      getDatabaseConfiguration();

    console.log(
      "DATABASE_URL detected."
    );

    console.log(
      "SSL:",
      databaseConfiguration.ssl
        ? "enabled"
        : "disabled"
    );

    console.log("");

    pool =
      new Pool({
        connectionString:
          databaseConfiguration
            .connectionString,

        ssl:
          databaseConfiguration
            .ssl,

        max:
          2,

        idleTimeoutMillis:
          10000,

        connectionTimeoutMillis:
          15000
      });

    const client =
      await pool.connect();

    try {
      console.log(
        "Connected to PostgreSQL."
      );

      console.log("");

      const schema =
        readSchema();

      console.log(
        "Running review database schema..."
      );

      await client.query(
        "BEGIN"
      );

      try {
        await client.query(
          schema
        );

        await client.query(
          "COMMIT"
        );
      } catch (
        schemaError
      ) {
        await client.query(
          "ROLLBACK"
        );

        throw schemaError;
      }

      console.log(
        "Schema completed."
      );

      console.log("");

      /*
      |--------------------------------------------------------------------------
      | Verify Tables
      |--------------------------------------------------------------------------
      */

      const tableVerification =
        await verifyTables(
          client
        );

      console.log(
        "Tables found:"
      );

      tableVerification
        .foundTables
        .forEach(
          function (
            tableName
          ) {
            console.log(
              "  ✓",
              tableName
            );
          }
        );

      if (
        tableVerification
          .missingTables
          .length
      ) {
        console.log("");

        console.log(
          "Tables missing:"
        );

        tableVerification
          .missingTables
          .forEach(
            function (
              tableName
            ) {
              console.log(
                "  X",
                tableName
              );
            }
          );
      }

      console.log("");

      /*
      |--------------------------------------------------------------------------
      | Verify Views
      |--------------------------------------------------------------------------
      */

      const viewVerification =
        await verifyViews(
          client
        );

      console.log(
        "Views found:"
      );

      viewVerification
        .foundViews
        .forEach(
          function (
            viewName
          ) {
            console.log(
              "  ✓",
              viewName
            );
          }
        );

      if (
        viewVerification
          .missingViews
          .length
      ) {
        console.log("");

        console.log(
          "Views missing:"
        );

        viewVerification
          .missingViews
          .forEach(
            function (
              viewName
            ) {
              console.log(
                "  X",
                viewName
              );
            }
          );
      }

      console.log("");

      /*
      |--------------------------------------------------------------------------
      | Review Counts
      |--------------------------------------------------------------------------
      */

      const reviewCounts =
        await getReviewCounts(
          client
        );

      console.log(
        "Current review queue:"
      );

      console.log(
        "  Pending Review:",
        reviewCounts.pending_review
      );

      console.log(
        "  Approved:",
        reviewCounts.approved
      );

      console.log(
        "  Denied:",
        reviewCounts.denied
      );

      console.log(
        "  Total:",
        reviewCounts.total
      );

      console.log("");

      /*
      |--------------------------------------------------------------------------
      | Final Result
      |--------------------------------------------------------------------------
      */

      const everythingExists =
        tableVerification
          .missingTables
          .length ===
          0 &&
        viewVerification
          .missingViews
          .length ===
          0;

      if (
        !everythingExists
      ) {
        throw new Error(
          "Review database initialization completed but required database objects are missing."
        );
      }

      console.log(
        "=============================================="
      );

      console.log(
        "STEP 20A PASSED"
      );

      console.log(
        "Review database is ready."
      );

      console.log(
        "=============================================="
      );

      console.log("");
    } finally {
      client.release();
    }
  } catch (
    error
  ) {
    console.error("");

    console.error(
      "=============================================="
    );

    console.error(
      "STEP 20A FAILED"
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
    if (pool) {
      await pool.end();
    }
  }
}

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

initializeDatabase();