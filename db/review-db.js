"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Chat Review Database Connection
|--------------------------------------------------------------------------
|
| STEP 20B
|
| Provides the shared PostgreSQL connection used by the protected
| knowledge-review API.
|
|--------------------------------------------------------------------------
*/

const {
  Pool
} =
  require("pg");

require("dotenv")
  .config();

let pool =
  null;

/*
|--------------------------------------------------------------------------
| Environment Helpers
|--------------------------------------------------------------------------
*/

function getDatabaseUrl() {
  return String(
    process.env.DATABASE_URL ||
    ""
  ).trim();
}

function getDatabaseSslEnabled() {
  return String(
    process.env.DATABASE_SSL ||
    "false"
  )
    .trim()
    .toLowerCase() ===
    "true";
}

/*
|--------------------------------------------------------------------------
| Create / Return Pool
|--------------------------------------------------------------------------
*/

function getPool() {
  if (pool) {
    return pool;
  }

  const databaseUrl =
    getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  const sslEnabled =
    getDatabaseSslEnabled();

  pool =
    new Pool({
      connectionString:
        databaseUrl,

      ssl:
        sslEnabled
          ? {
              rejectUnauthorized:
                false
            }
          : false,

      max:
        5,

      idleTimeoutMillis:
        30000,

      connectionTimeoutMillis:
        15000
    });

  pool.on(
    "error",
    function (
      error
    ) {
      console.error(
        "Unexpected PostgreSQL pool error:",
        error
      );
    }
  );

  return pool;
}

/*
|--------------------------------------------------------------------------
| Query Helper
|--------------------------------------------------------------------------
*/

async function query(
  text,
  parameters
) {
  const database =
    getPool();

  return database.query(
    text,
    parameters
  );
}

/*
|--------------------------------------------------------------------------
| Transaction Helper
|--------------------------------------------------------------------------
*/

async function withTransaction(
  callback
) {
  if (
    typeof callback !==
    "function"
  ) {
    throw new Error(
      "Transaction callback is required."
    );
  }

  const database =
    getPool();

  const client =
    await database.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const result =
      await callback(
        client
      );

    await client.query(
      "COMMIT"
    );

    return result;
  } catch (
    error
  ) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (
      rollbackError
    ) {
      console.error(
        "PostgreSQL rollback error:",
        rollbackError
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

async function checkConnection() {
  const result =
    await query(
      `
        SELECT
          NOW() AS database_time;
      `
    );

  return {
    connected:
      true,

    databaseTime:
      result.rows[0]
        .database_time
  };
}

/*
|--------------------------------------------------------------------------
| Close Pool
|--------------------------------------------------------------------------
*/

async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();

  pool =
    null;
}

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  getPool,
  query,
  withTransaction,
  checkConnection,
  closePool
};