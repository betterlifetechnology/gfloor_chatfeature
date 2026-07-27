"use strict";

/*
|--------------------------------------------------------------------------
| G-Floor Customer Service Training Importer
|--------------------------------------------------------------------------
|
| Purpose:
|
| Convert Customer Service training data into a controlled review queue.
|
| IMPORTANT:
|
| This script DOES NOT publish answers to the chatbot.
|
| Imported records must be reviewed and approved before they can become
| part of the approved G-Floor knowledge base.
|
|--------------------------------------------------------------------------
*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| File Paths
|--------------------------------------------------------------------------
*/

const ROOT_DIRECTORY = path.resolve(
  __dirname,
  ".."
);

const DATA_DIRECTORY = path.join(
  ROOT_DIRECTORY,
  "data"
);

const TRAINING_QUEUE_FILE = path.join(
  DATA_DIRECTORY,
  "training-queue.json"
);

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const VALID_STATUSES = new Set([
  "pending-review",
  "approved",
  "rejected"
]);

const DEFAULT_CATEGORY =
  "Needs Classification";

const MAX_QUESTION_LENGTH =
  500;

const MAX_RESPONSE_LENGTH =
  5000;

/*
|--------------------------------------------------------------------------
| Generic Helpers
|--------------------------------------------------------------------------
*/

function cleanText(value) {
  return String(
    value == null
      ? ""
      : value
  )
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeText(value) {
  return cleanText(
    value
  )
    .toLowerCase()
    .replace(/g-floor/g, "gfloor")
    .replace(/g floor/g, "gfloor")
    .replace(/®/g, "")
    .replace(/™/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function today() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );
}

function ensureDirectory(
  directory
) {
  if (
    !fs.existsSync(
      directory
    )
  ) {
    fs.mkdirSync(
      directory,
      {
        recursive: true
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| ID Generation
|--------------------------------------------------------------------------
*/

function createTrainingId(
  question,
  response
) {
  const fingerprint =
    normalizeText(
      question
    ) +
    "|" +
    normalizeText(
      response
    );

  const hash =
    crypto
      .createHash(
        "sha256"
      )
      .update(
        fingerprint
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        12
      );

  return (
    "training-" +
    hash
  );
}

/*
|--------------------------------------------------------------------------
| Sensitive Information Detection
|--------------------------------------------------------------------------
|
| This is intentionally conservative.
|
| Records are flagged for review rather than silently cleaned and published.
|--------------------------------------------------------------------------
*/

function detectSensitiveInformation(
  text
) {
  const value =
    cleanText(
      text
    );

  const findings = [];

  const emailPattern =
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

  const phonePattern =
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;

  const possibleOrderPattern =
    /\b(?:order|invoice|reference|confirmation)[\s#:.-]*[A-Z0-9-]{4,}\b/gi;

  const streetAddressPattern =
    /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|court|ct|way|parkway|pkwy)\b/gi;

  if (
    emailPattern.test(
      value
    )
  ) {
    findings.push(
      "email-address"
    );
  }

  if (
    phonePattern.test(
      value
    )
  ) {
    findings.push(
      "phone-number"
    );
  }

  if (
    possibleOrderPattern.test(
      value
    )
  ) {
    findings.push(
      "possible-order-number"
    );
  }

  if (
    streetAddressPattern.test(
      value
    )
  ) {
    findings.push(
      "possible-address"
    );
  }

  return findings;
}

/*
|--------------------------------------------------------------------------
| Category Suggestion
|--------------------------------------------------------------------------
*/

function suggestCategory(
  question,
  response
) {
  const value =
    normalizeText(
      question +
      " " +
      response
    );

  const rules = [
    {
      category:
        "Installation",

      keywords: [
        "install",
        "installation",
        "adhesive",
        "glue",
        "tape",
        "seam",
        "subfloor",
        "concrete",
        "wood",
        "threshold"
      ]
    },

    {
      category:
        "Cleaning & Maintenance",

      keywords: [
        "clean",
        "cleaner",
        "cleaning",
        "wash",
        "stain",
        "scrub",
        "maintenance",
        "chemical"
      ]
    },

    {
      category:
        "Shipping & Delivery",

      keywords: [
        "shipping",
        "ship",
        "delivery",
        "freight",
        "tracking"
      ]
    },

    {
      category:
        "Order Help",

      keywords: [
        "order",
        "purchase",
        "buy",
        "checkout"
      ]
    },

    {
      category:
        "Warranty & Returns",

      keywords: [
        "warranty",
        "return",
        "refund",
        "claim",
        "defect"
      ]
    },

    {
      category:
        "Outdoor & Marine",

      keywords: [
        "outdoor",
        "outside",
        "marine",
        "boat",
        "pontoon",
        "uv"
      ]
    },

    {
      category:
        "Garage Flooring",

      keywords: [
        "garage",
        "parking",
        "vehicle",
        "car",
        "truck"
      ]
    },

    {
      category:
        "Pet Flooring",

      keywords: [
        "pet",
        "dog",
        "cat",
        "kennel",
        "crate"
      ]
    },

    {
      category:
        "Product Details",

      keywords: [
        "size",
        "color",
        "sku",
        "price",
        "stock",
        "available",
        "material",
        "made"
      ]
    }
  ];

  for (
    let i = 0;
    i < rules.length;
    i += 1
  ) {
    const rule =
      rules[i];

    const found =
      rule.keywords.some(
        function (
          keyword
        ) {
          return (
            value.includes(
              keyword
            )
          );
        }
      );

    if (
      found
    ) {
      return (
        rule.category
      );
    }
  }

  return (
    DEFAULT_CATEGORY
  );
}

/*
|--------------------------------------------------------------------------
| Existing Training Queue
|--------------------------------------------------------------------------
*/

function createEmptyQueue() {
  return {
    version:
      "1.0",

    brand:
      "G-Floor",

    purpose:
      "Customer Service training review queue for the G-Floor custom chat feature.",

    lastUpdated:
      today(),

    rules: {
      autoPublish:
        false,

      requiresHumanApproval:
        true,

      allowCustomerPersonalInformation:
        false,

      allowOrderSpecificInformation:
        false,

      allowPrivatePricing:
        false
    },

    items:
      []
  };
}

function loadTrainingQueue() {
  ensureDirectory(
    DATA_DIRECTORY
  );

  if (
    !fs.existsSync(
      TRAINING_QUEUE_FILE
    )
  ) {
    return (
      createEmptyQueue()
    );
  }

  const raw =
    fs.readFileSync(
      TRAINING_QUEUE_FILE,
      "utf8"
    );

  if (
    !raw.trim()
  ) {
    return (
      createEmptyQueue()
    );
  }

  const queue =
    JSON.parse(
      raw
    );

  if (
    !Array.isArray(
      queue.items
    )
  ) {
    queue.items =
      [];
  }

  return queue;
}

function saveTrainingQueue(
  queue
) {
  queue.lastUpdated =
    today();

  fs.writeFileSync(
    TRAINING_QUEUE_FILE,
    JSON.stringify(
      queue,
      null,
      2
    ) + "\n",
    "utf8"
  );
}

/*
|--------------------------------------------------------------------------
| Record Validation
|--------------------------------------------------------------------------
*/

function validateInputRecord(
  record
) {
  const errors = [];

  const question =
    cleanText(
      record.customerQuestion ||
      record.question
    );

  const response =
    cleanText(
      record.customerServiceResponse ||
      record.response ||
      record.answer
    );

  if (
    !question
  ) {
    errors.push(
      "Customer question is missing."
    );
  }

  if (
    !response
  ) {
    errors.push(
      "Customer Service response is missing."
    );
  }

  if (
    question.length >
    MAX_QUESTION_LENGTH
  ) {
    errors.push(
      "Customer question is longer than " +
      MAX_QUESTION_LENGTH +
      " characters."
    );
  }

  if (
    response.length >
    MAX_RESPONSE_LENGTH
  ) {
    errors.push(
      "Customer Service response is longer than " +
      MAX_RESPONSE_LENGTH +
      " characters."
    );
  }

  return {
    valid:
      errors.length ===
      0,

    errors:
      errors,

    question:
      question,

    response:
      response
  };
}

/*
|--------------------------------------------------------------------------
| Convert Imported Record
|--------------------------------------------------------------------------
*/

function createTrainingRecord(
  sourceRecord
) {
  const validation =
    validateInputRecord(
      sourceRecord
    );

  if (
    !validation.valid
  ) {
    return {
      success:
        false,

      errors:
        validation.errors
    };
  }

  const question =
    validation.question;

  const response =
    validation.response;

  const sensitiveFindings =
    Array.from(
      new Set(
        detectSensitiveInformation(
          question
        ).concat(
          detectSensitiveInformation(
            response
          )
        )
      )
    );

  const category =
    cleanText(
      sourceRecord.suggestedCategory ||
      sourceRecord.category
    ) ||
    suggestCategory(
      question,
      response
    );

  const sourceDate =
    cleanText(
      sourceRecord.sourceDate ||
      sourceRecord.date
    ) ||
    today();

  const record = {
    id:
      createTrainingId(
        question,
        response
      ),

    source:
      cleanText(
        sourceRecord.source
      ) ||
      "manual-import",

    sourceDate:
      sourceDate,

    customerQuestion:
      question,

    customerServiceResponse:
      response,

    suggestedQuestion:
      cleanText(
        sourceRecord.suggestedQuestion
      ) ||
      question,

    suggestedAnswer:
      cleanText(
        sourceRecord.suggestedAnswer
      ) ||
      response,

    suggestedCategory:
      category,

    suggestedVariations:
      Array.isArray(
        sourceRecord.suggestedVariations
      )
        ? sourceRecord.suggestedVariations
            .map(
              cleanText
            )
            .filter(Boolean)
        : [],

    sourceUrl:
      cleanText(
        sourceRecord.sourceUrl
      ),

    sensitiveInformationDetected:
      sensitiveFindings,

    requiresSensitiveDataReview:
      sensitiveFindings.length >
      0,

    status:
      "pending-review",

    approved:
      false,

    reviewedBy:
      "",

    reviewedDate:
      "",

    notes:
      cleanText(
        sourceRecord.notes
      )
  };

  return {
    success:
      true,

    record:
      record
  };
}

/*
|--------------------------------------------------------------------------
| Import Records
|--------------------------------------------------------------------------
*/

function importRecords(
  records
) {
  if (
    !Array.isArray(
      records
    )
  ) {
    throw new Error(
      "Training input must be an array."
    );
  }

  const queue =
    loadTrainingQueue();

  const existingIds =
    new Set(
      queue.items.map(
        function (
          item
        ) {
          return item.id;
        }
      )
    );

  let added = 0;
  let duplicates = 0;
  let invalid = 0;

  const invalidRecords = [];

  records.forEach(
    function (
      sourceRecord,
      index
    ) {
      const result =
        createTrainingRecord(
          sourceRecord
        );

      if (
        !result.success
      ) {
        invalid += 1;

        invalidRecords.push({
          index:
            index,

          errors:
            result.errors
        });

        return;
      }

      if (
        existingIds.has(
          result.record.id
        )
      ) {
        duplicates += 1;

        return;
      }

      queue.items.push(
        result.record
      );

      existingIds.add(
        result.record.id
      );

      added += 1;
    }
  );

  saveTrainingQueue(
    queue
  );

  return {
    added:
      added,

    duplicates:
      duplicates,

    invalid:
      invalid,

    totalQueueItems:
      queue.items.length,

    invalidRecords:
      invalidRecords
  };
}

/*
|--------------------------------------------------------------------------
| JSON Input
|--------------------------------------------------------------------------
*/

function readJsonInput(
  filename
) {
  const resolved =
    path.resolve(
      process.cwd(),
      filename
    );

  if (
    !fs.existsSync(
      resolved
    )
  ) {
    throw new Error(
      "Input file does not exist: " +
      resolved
    );
  }

  const raw =
    fs.readFileSync(
      resolved,
      "utf8"
    );

  const parsed =
    JSON.parse(
      raw
    );

  if (
    Array.isArray(
      parsed
    )
  ) {
    return parsed;
  }

  if (
    parsed &&
    Array.isArray(
      parsed.items
    )
  ) {
    return parsed.items;
  }

  throw new Error(
    "Input JSON must either be an array or contain an items array."
  );
}

/*
|--------------------------------------------------------------------------
| Command-Line Runner
|--------------------------------------------------------------------------
*/

function printUsage() {
  console.log("");
  console.log(
    "G-Floor Customer Service Training Importer"
  );
  console.log("");
  console.log(
    "Usage:"
  );
  console.log("");
  console.log(
    "  node scripts/import-training-data.js <input.json>"
  );
  console.log("");
  console.log(
    "Example:"
  );
  console.log("");
  console.log(
    "  node scripts/import-training-data.js data/customer-service-import.json"
  );
  console.log("");
}

function run() {
  const filename =
    process.argv[2];

  if (
    !filename
  ) {
    printUsage();

    process.exitCode =
      1;

    return;
  }

  try {
    const records =
      readJsonInput(
        filename
      );

    const result =
      importRecords(
        records
      );

    console.log("");
    console.log(
      "G-Floor training import complete."
    );

    console.log(
      "Added:",
      result.added
    );

    console.log(
      "Duplicates skipped:",
      result.duplicates
    );

    console.log(
      "Invalid records:",
      result.invalid
    );

    console.log(
      "Total review queue:",
      result.totalQueueItems
    );

    if (
      result.invalidRecords.length
    ) {
      console.log("");
      console.log(
        "Invalid record details:"
      );

      console.log(
        JSON.stringify(
          result.invalidRecords,
          null,
          2
        )
      );
    }

    console.log("");
    console.log(
      "Nothing has been published to the live chatbot."
    );

    console.log(
      "Imported records are waiting in data/training-queue.json for review."
    );

    console.log("");
  } catch (error) {
    console.error("");
    console.error(
      "Training import failed:"
    );

    console.error(
      error.message
    );

    console.error("");

    process.exitCode =
      1;
  }
}

if (
  require.main ===
  module
) {
  run();
}

module.exports = {
  cleanText,
  normalizeText,
  detectSensitiveInformation,
  suggestCategory,
  createTrainingRecord,
  importRecords
};