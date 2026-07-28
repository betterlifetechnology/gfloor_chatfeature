"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Chat Review Test Data
|--------------------------------------------------------------------------
|
| STEP 20D.1
|
| Creates SAFE FAKE review records for testing the knowledge approval
| dashboard.
|
| This script does NOT read real customer emails.
|
| Commands:
|
| node scripts/seed-review-test-data.js
|
| Creates test records.
|
| node scripts/seed-review-test-data.js --cleanup
|
| Removes test reviews and any approved knowledge created from them.
|
| node scripts/seed-review-test-data.js --reset
|
| Removes old test data and creates fresh pending test records.
|
|--------------------------------------------------------------------------
*/

const {
  Pool
} =
  require("pg");

require("dotenv")
  .config();

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const TEST_SOURCE_TYPE =
  "manual-test";

const TEST_MESSAGE_IDS = [
  "GFLOOR-TEST-20D-NORMAL",
  "GFLOOR-TEST-20D-SENSITIVE",
  "GFLOOR-TEST-20D-DUPLICATE"
];

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
| Create Pool
|--------------------------------------------------------------------------
*/

function createPool() {
  const config =
    getDatabaseConfiguration();

  return new Pool({
    connectionString:
      config.connectionString,

    ssl:
      config.ssl,

    max:
      2,

    connectionTimeoutMillis:
      15000,

    idleTimeoutMillis:
      10000
  });
}

/*
|--------------------------------------------------------------------------
| Test Records
|--------------------------------------------------------------------------
*/

function getTestRecords() {
  return [
    /*
    |--------------------------------------------------------------------------
    | TEST 1 - NORMAL APPROVAL
    |--------------------------------------------------------------------------
    */

    {
      sourceMessageId:
        "GFLOOR-TEST-20D-NORMAL",

      sourceThreadId:
        "GFLOOR-TEST-THREAD-001",

      sourceFolder:
        "TEST DATA",

      sourceSubject:
        "TEST - Installing G-Floor over plywood",

      sourceSender:
        "test-customer@example.com",

      customerQuestion:
        "Can I install G-Floor over plywood?",

      customerServiceResponse:
        "Installation requirements can vary based on the product, subfloor condition, and installation method. The customer should review the applicable installation instructions before installation.",

      suggestedQuestion:
        "Can G-Floor be installed over plywood?",

      suggestedAnswer:
        "G-Floor installation requirements can vary by product, subfloor condition, and installation method. Review the installation instructions for the specific G-Floor product before installing over plywood. Contact G-Floor Customer Service when substrate-specific guidance is needed.",

      suggestedCategory:
        "Installation",

      suggestedVariations: [
        "Can I put G-Floor over plywood?",
        "Can G-Floor go over wood?",
        "Can I install G-Floor on plywood?",
        "Does G-Floor work on a plywood subfloor?"
      ],

      suggestedSourceUrl:
        "https://gfloor.com/",

      suggestedResponseType:
        "AUTO",

      sensitiveInformationDetected:
        [],

      requiresSensitiveReview:
        false,

      sensitiveReviewCompleted:
        false,

      possibleDuplicate:
        false,

      duplicateKnowledgeId:
        null
    },

    /*
    |--------------------------------------------------------------------------
    | TEST 2 - SENSITIVE INFORMATION
    |--------------------------------------------------------------------------
    |
    | This intentionally includes FAKE customer-specific information in the
    | source email.
    |
    | The proposed chatbot answer does NOT contain the fake information.
    |
    |--------------------------------------------------------------------------
    */

    {
      sourceMessageId:
        "GFLOOR-TEST-20D-SENSITIVE",

      sourceThreadId:
        "GFLOOR-TEST-THREAD-002",

      sourceFolder:
        "TEST DATA",

      sourceSubject:
        "TEST - Cleaning question with customer information",

      sourceSender:
        "jane.test@example.com",

      customerQuestion:
        "Hi, this is Jane Test. My phone number is 555-010-2020. How should I clean my G-Floor after something spills on it?",

      customerServiceResponse:
        "Hi Jane, sweep or vacuum loose dirt first. Mop or rinse the G-Floor with cool water and a mild detergent. A soft brush may be used on textured surfaces. Avoid harsh solvents and undiluted bleach.",

      suggestedQuestion:
        "How should I clean spills from G-Floor?",

      suggestedAnswer:
        "Sweep or vacuum loose dirt, then mop or rinse G-Floor with cool water and a mild detergent. A soft brush can be used on textured surfaces. Rinse away cleaner residue and allow the floor to dry before use. Avoid harsh solvents and undiluted bleach.",

      suggestedCategory:
        "Cleaning & Maintenance",

      suggestedVariations: [
        "How do I clean a spill on G-Floor?",
        "What should I use to clean G-Floor?",
        "How do I clean G-Floor?",
        "Can I mop G-Floor?"
      ],

      suggestedSourceUrl:
        "https://gfloor.com/",

      suggestedResponseType:
        "AUTO",

      sensitiveInformationDetected: [
        "fake customer name",
        "fake email address",
        "fake phone number"
      ],

      requiresSensitiveReview:
        true,

      sensitiveReviewCompleted:
        false,

      possibleDuplicate:
        false,

      duplicateKnowledgeId:
        null
    },

    /*
    |--------------------------------------------------------------------------
    | TEST 3 - POSSIBLE DUPLICATE
    |--------------------------------------------------------------------------
    */

    {
      sourceMessageId:
        "GFLOOR-TEST-20D-DUPLICATE",

      sourceThreadId:
        "GFLOOR-TEST-THREAD-003",

      sourceFolder:
        "TEST DATA",

      sourceSubject:
        "TEST - Existing cleaning information",

      sourceSender:
        "test-customer-2@example.com",

      customerQuestion:
        "What cleaner should I use on G-Floor?",

      customerServiceResponse:
        "Use cool water and a mild detergent for routine cleaning. Avoid harsh solvents and undiluted bleach.",

      suggestedQuestion:
        "How do I clean G-Floor?",

      suggestedAnswer:
        "For routine cleaning, sweep or vacuum loose dirt and use cool water with a mild detergent. Rinse away cleaner residue and allow the floor to dry before use.",

      suggestedCategory:
        "Cleaning & Maintenance",

      suggestedVariations: [
        "What cleaner can I use on G-Floor?",
        "How should G-Floor be cleaned?"
      ],

      suggestedSourceUrl:
        "https://gfloor.com/",

      suggestedResponseType:
        "AUTO",

      sensitiveInformationDetected:
        [],

      requiresSensitiveReview:
        false,

      sensitiveReviewCompleted:
        false,

      possibleDuplicate:
        true,

      duplicateKnowledgeId:
        "existing-cleaning-knowledge"
    }
  ];
}

/*
|--------------------------------------------------------------------------
| Cleanup Test Data
|--------------------------------------------------------------------------
*/

async function cleanupTestData(
  client
) {
  console.log("");
  console.log(
    "Removing Step 20D test data..."
  );

  /*
   * Delete approved knowledge that originated from our test reviews FIRST.
   *
   * This prevents fake approved knowledge from remaining in the chatbot
   * knowledge table after testing.
   */

  const approvedResult =
    await client.query(
      `
        DELETE FROM
          chat_approved_knowledge
        WHERE
          training_review_id IN (
            SELECT
              id
            FROM
              chat_training_reviews
            WHERE
              source_type = $1
              AND source_message_id = ANY($2::text[])
          )
        RETURNING
          knowledge_id;
      `,
      [
        TEST_SOURCE_TYPE,
        TEST_MESSAGE_IDS
      ]
    );

  console.log(
    "Approved test knowledge removed:",
    approvedResult.rowCount
  );

  /*
   * Delete review records.
   */

  const reviewResult =
    await client.query(
      `
        DELETE FROM
          chat_training_reviews
        WHERE
          source_type = $1
          AND source_message_id = ANY($2::text[])
        RETURNING
          id;
      `,
      [
        TEST_SOURCE_TYPE,
        TEST_MESSAGE_IDS
      ]
    );

  console.log(
    "Test review records removed:",
    reviewResult.rowCount
  );

  return {
    approvedKnowledgeRemoved:
      approvedResult.rowCount,

    reviewsRemoved:
      reviewResult.rowCount
  };
}

/*
|--------------------------------------------------------------------------
| Insert One Test Record
|--------------------------------------------------------------------------
*/

async function insertTestRecord(
  client,
  record
) {
  const result =
    await client.query(
      `
        INSERT INTO
          chat_training_reviews
          (
            source_type,
            source_message_id,
            source_thread_id,
            source_folder,
            source_subject,
            source_sender,
            source_received_at,

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

            status
          )

        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            NOW(),

            $7,
            $8,

            $9,
            $10,
            $11,
            $12::jsonb,
            $13,
            $14,

            $15::jsonb,
            $16,
            $17,

            $18,
            $19,

            'pending-review'
          )

        ON CONFLICT (
          source_message_id
        )
        WHERE
          source_message_id IS NOT NULL

        DO NOTHING

        RETURNING
          id,
          source_message_id,
          suggested_question,
          status;
      `,
      [
        TEST_SOURCE_TYPE,

        record.sourceMessageId,

        record.sourceThreadId,

        record.sourceFolder,

        record.sourceSubject,

        record.sourceSender,

        record.customerQuestion,

        record.customerServiceResponse,

        record.suggestedQuestion,

        record.suggestedAnswer,

        record.suggestedCategory,

        JSON.stringify(
          record.suggestedVariations
        ),

        record.suggestedSourceUrl,

        record.suggestedResponseType,

        JSON.stringify(
          record.sensitiveInformationDetected
        ),

        record.requiresSensitiveReview,

        record.sensitiveReviewCompleted,

        record.possibleDuplicate,

        record.duplicateKnowledgeId
      ]
    );

  if (
    !result.rows.length
  ) {
    return {
      created:
        false,

      sourceMessageId:
        record.sourceMessageId
    };
  }

  return {
    created:
      true,

    review:
      result.rows[0]
  };
}

/*
|--------------------------------------------------------------------------
| Verify Test Data
|--------------------------------------------------------------------------
*/

async function getTestReviews(
  client
) {
  const result =
    await client.query(
      `
        SELECT
          id,
          source_message_id,
          suggested_question,
          suggested_category,
          requires_sensitive_review,
          possible_duplicate,
          status
        FROM
          chat_training_reviews
        WHERE
          source_type = $1
          AND source_message_id = ANY($2::text[])
        ORDER BY
          id;
      `,
      [
        TEST_SOURCE_TYPE,
        TEST_MESSAGE_IDS
      ]
    );

  return result.rows;
}

/*
|--------------------------------------------------------------------------
| Review Counts
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

  return (
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
    }
  );
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

async function main() {
  const args =
    process.argv
      .slice(2)
      .map(
        function (
          argument
        ) {
          return String(
            argument
          )
            .trim()
            .toLowerCase();
        }
      );

  const cleanupOnly =
    args.includes(
      "--cleanup"
    );

  const reset =
    args.includes(
      "--reset"
    );

  const pool =
    createPool();

  let client;

  try {
    console.log("");
    console.log(
      "=============================================="
    );

    console.log(
      "G-FLOOR CHAT REVIEW TEST DATA"
    );

    console.log(
      "STEP 20D.1"
    );

    console.log(
      "=============================================="
    );

    console.log("");

    client =
      await pool.connect();

    console.log(
      "Connected to PostgreSQL."
    );

    await client.query(
      "BEGIN"
    );

    try {
      /*
      |--------------------------------------------------------------------------
      | Cleanup Only
      |--------------------------------------------------------------------------
      */

      if (cleanupOnly) {
        await cleanupTestData(
          client
        );

        await client.query(
          "COMMIT"
        );

        console.log("");
        console.log(
          "=============================================="
        );

        console.log(
          "TEST DATA CLEANUP COMPLETE"
        );

        console.log(
          "=============================================="
        );

        console.log("");

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | Reset Existing Test Data
      |--------------------------------------------------------------------------
      */

      if (reset) {
        await cleanupTestData(
          client
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Seed
      |--------------------------------------------------------------------------
      */

      const records =
        getTestRecords();

      console.log("");
      console.log(
        "Creating test review records..."
      );

      let createdCount =
        0;

      for (
        const record
        of records
      ) {
        const result =
          await insertTestRecord(
            client,
            record
          );

        if (
          result.created
        ) {
          createdCount +=
            1;

          console.log(
            "  ✓ Created:",
            result.review.id,
            "-",
            result.review
              .suggested_question
          );

        } else {
          console.log(
            "  - Already exists:",
            result
              .sourceMessageId
          );
        }
      }

      await client.query(
        "COMMIT"
      );

      /*
      |--------------------------------------------------------------------------
      | Verification
      |--------------------------------------------------------------------------
      */

      const reviews =
        await getTestReviews(
          client
        );

      const counts =
        await getReviewCounts(
          client
        );

      console.log("");
      console.log(
        "Test reviews currently available:"
      );

      reviews.forEach(
        function (
          review
        ) {
          console.log(
            "",
            "#" +
            review.id
          );

          console.log(
            "   Question:",
            review
              .suggested_question
          );

          console.log(
            "   Category:",
            review
              .suggested_category
          );

          console.log(
            "   Status:",
            review.status
          );

          console.log(
            "   Sensitive Review:",
            review
              .requires_sensitive_review
              ? "YES"
              : "No"
          );

          console.log(
            "   Possible Duplicate:",
            review
              .possible_duplicate
              ? "YES"
              : "No"
          );
        }
      );

      console.log("");
      console.log(
        "Current dashboard counts:"
      );

      console.log(
        "  Pending Review:",
        counts.pending_review
      );

      console.log(
        "  Approved:",
        counts.approved
      );

      console.log(
        "  Denied:",
        counts.denied
      );

      console.log(
        "  Total:",
        counts.total
      );

      console.log("");
      console.log(
        "New records created:",
        createdCount
      );

      console.log("");
      console.log(
        "=============================================="
      );

      console.log(
        "STEP 20D.1 PASSED"
      );

      console.log(
        "Open the Knowledge Approval Dashboard."
      );

      console.log(
        "=============================================="
      );

      console.log("");
      console.log(
        "When testing is finished, remove the fake data with:"
      );

      console.log("");
      console.log(
        "node scripts/seed-review-test-data.js --cleanup"
      );

      console.log("");

    } catch (
      error
    ) {
      await client.query(
        "ROLLBACK"
      );

      throw error;
    }

  } catch (
    error
  ) {
    console.error("");
    console.error(
      "=============================================="
    );

    console.error(
      "STEP 20D.1 FAILED"
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
    if (client) {
      client.release();
    }

    await pool.end();
  }
}

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

main();