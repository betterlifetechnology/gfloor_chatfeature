"use strict";

const express = require("express");
const crypto = require("crypto");
const { query } = require("../db/review-db");

const publicRouter = express.Router();
const adminRouter = express.Router();

const BUSINESS_HOURS = "Monday-Friday, 8 AM-5 PM Central Time";
const ACTIVE_AGENT_WINDOW_MS = 45000;
const MAX_MESSAGE_LENGTH = 5000;

let schemaReadyPromise = null;

function cleanText(value, maximumLength) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().slice(0, maximumLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function createCustomerToken() {
  return crypto.randomBytes(32).toString("hex");
}

function isWithinBusinessHours() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const central = {};
  parts.forEach(function (part) {
    if (part.type !== "literal") {
      central[part.type] = part.value;
    }
  });

  const weekdays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const minutes = Number(central.hour) * 60 + Number(central.minute);

  return weekdays.has(central.weekday) && minutes >= 8 * 60 && minutes < 17 * 60;
}

async function ensureSchema() {
  if (schemaReadyPromise) {
    return schemaReadyPromise;
  }

  schemaReadyPromise = (async function () {
    await query(`
      CREATE TABLE IF NOT EXISTS live_chat_conversations (
        conversation_id VARCHAR(100) PRIMARY KEY,
        customer_token_hash VARCHAR(64) NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        customer_email VARCHAR(254) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        initial_message TEXT NOT NULL,
        page_url TEXT,
        page_title VARCHAR(500),
        status VARCHAR(20) NOT NULL DEFAULT 'waiting',
        assigned_agent_id VARCHAR(100),
        assigned_agent_name VARCHAR(100),
        requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accepted_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT live_chat_status_check CHECK (status IN ('waiting', 'active', 'closed'))
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS live_chat_messages (
        id BIGSERIAL PRIMARY KEY,
        conversation_id VARCHAR(100) NOT NULL REFERENCES live_chat_conversations(conversation_id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL,
        sender_name VARCHAR(100),
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT live_chat_sender_check CHECK (sender_type IN ('customer', 'agent', 'system'))
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS live_chat_agents (
        agent_id VARCHAR(100) PRIMARY KEY,
        agent_name VARCHAR(100) NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS live_chat_conversations_status_idx
      ON live_chat_conversations(status, requested_at);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS live_chat_messages_conversation_idx
      ON live_chat_messages(conversation_id, id);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS live_chat_agents_seen_idx
      ON live_chat_agents(last_seen_at);
    `);
  })().catch(function (error) {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

function getAllowedOrigins() {
  const origins = ["https://gfloor.com", "https://www.gfloor.com"];
  const configured = cleanText(process.env.SHOPIFY_ALLOWED_ORIGIN, 500);
  if (configured && !origins.includes(configured)) {
    origins.push(configured);
  }
  return origins;
}

publicRouter.use(function liveChatCors(request, response, next) {
  const origin = cleanText(request.get("Origin"), 500);
  if (origin && getAllowedOrigins().includes(origin)) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
  }

  response.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  next();
});

publicRouter.use(express.json({ limit: "50kb", strict: true }));
adminRouter.use(express.json({ limit: "50kb", strict: true }));

function getConfiguredAdminToken() {
  return cleanText(process.env.ADMIN_TOKEN, 2000);
}

function getSuppliedAdminToken(request) {
  const header = cleanText(request.get("X-Admin-Token"), 2000);
  if (header) {
    return header;
  }

  const authorization = cleanText(request.get("Authorization"), 3000);
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return "";
}

function secureTokenMatch(supplied, expected) {
  if (!supplied || !expected) {
    return false;
  }

  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function requireAdmin(request, response, next) {
  const expected = getConfiguredAdminToken();
  if (!expected) {
    return response.status(503).json({ success: false, error: "Admin access is not configured." });
  }

  if (!secureTokenMatch(getSuppliedAdminToken(request), expected)) {
    return response.status(401).json({ success: false, error: "Unauthorized." });
  }

  next();
}

adminRouter.use(requireAdmin);

async function countActiveAgents() {
  await ensureSchema();

  const result = await query(
    `
      SELECT COUNT(*)::int AS count
      FROM live_chat_agents
      WHERE last_seen_at >= NOW() - ($1::text || ' milliseconds')::interval;
    `,
    [String(ACTIVE_AGENT_WINDOW_MS)]
  );

  return Number(result.rows[0] && result.rows[0].count) || 0;
}

async function countWaitingChats() {
  await ensureSchema();
  const result = await query(`SELECT COUNT(*)::int AS count FROM live_chat_conversations WHERE status = 'waiting';`);
  return Number(result.rows[0] && result.rows[0].count) || 0;
}

async function getLiveSupportStatus() {
  try {
    const businessHoursOpen = isWithinBusinessHours();
    const activeAgents = businessHoursOpen ? await countActiveAgents() : 0;
    const waitingCount = businessHoursOpen && activeAgents > 0 ? await countWaitingChats() : 0;
    const available = businessHoursOpen && activeAgents > 0;
    const normalWait = cleanText(process.env.LIVE_AGENT_NORMAL_WAIT, 50) || "2-5";
    const busyWait = cleanText(process.env.LIVE_AGENT_BUSY_WAIT, 50) || "5-10";
    const queueStatus = available ? (waitingCount >= 3 ? "busy" : "normal") : "offline";
    const wait = available ? (queueStatus === "busy" ? busyWait : normalWait) : null;

    return {
      success: true,
      liveAgentAvailable: available,
      businessHours: BUSINESS_HOURS,
      queueStatus,
      estimatedWaitMinutes: wait,
      activeAgents,
      waitingCount,
      message: available
        ? "A Customer Service representative is online. Estimated wait time: approximately " + wait + " minutes."
        : "Our Customer Service team is currently offline. Live support hours are " + BUSINESS_HOURS + ". Please leave a message and our team will follow up."
    };
  } catch (error) {
    console.error("Live support status error:", error);
    return {
      success: false,
      liveAgentAvailable: false,
      businessHours: BUSINESS_HOURS,
      queueStatus: "unavailable",
      estimatedWaitMinutes: null,
      activeAgents: 0,
      waitingCount: 0,
      message: "Live support status is temporarily unavailable."
    };
  }
}

async function getConversation(conversationId) {
  const result = await query(
    `
      SELECT
        conversation_id,
        customer_token_hash,
        customer_name,
        customer_email,
        customer_phone,
        initial_message,
        page_url,
        page_title,
        status,
        assigned_agent_id,
        assigned_agent_name,
        requested_at,
        accepted_at,
        closed_at,
        updated_at
      FROM live_chat_conversations
      WHERE conversation_id = $1;
    `,
    [conversationId]
  );

  return result.rows[0] || null;
}

async function getMessages(conversationId, afterId) {
  const numericAfterId = Number.isFinite(Number(afterId)) ? Number(afterId) : 0;
  const result = await query(
    `
      SELECT id, sender_type, sender_name, message, created_at
      FROM live_chat_messages
      WHERE conversation_id = $1 AND id > $2
      ORDER BY id ASC
      LIMIT 250;
    `,
    [conversationId, numericAfterId]
  );

  return result.rows;
}

function verifyCustomerToken(conversation, suppliedToken) {
  return Boolean(
    conversation &&
    suppliedToken &&
    secureTokenMatch(hashToken(suppliedToken), conversation.customer_token_hash)
  );
}

publicRouter.post("/request", async function (request, response) {
  try {
    await ensureSchema();

    const body = request.body || {};
    const conversationId = cleanText(body.conversationId, 100);
    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 254);
    const phone = cleanText(body.phone, 50);
    const message = cleanText(body.message, MAX_MESSAGE_LENGTH);
    const pageUrl = cleanText(body.pageUrl, 2000);
    const pageTitle = cleanText(body.pageTitle, 500);

    if (!conversationId || !name || !email || !phone || !message) {
      return response.status(400).json({ success: false, error: "Conversation ID, name, email, phone, and message are required." });
    }

    if (!isValidEmail(email)) {
      return response.status(400).json({ success: false, error: "Please enter a valid email address." });
    }

    const support = await getLiveSupportStatus();
    if (!support.liveAgentAvailable) {
      return response.status(409).json({ success: false, error: "A live representative is not currently online.", liveAgentAvailable: false });
    }

    const existing = await getConversation(conversationId);
    if (existing) {
      return response.status(409).json({ success: false, error: "This live chat request already exists." });
    }

    const customerToken = createCustomerToken();

    await query(
      `
        INSERT INTO live_chat_conversations (
          conversation_id,
          customer_token_hash,
          customer_name,
          customer_email,
          customer_phone,
          initial_message,
          page_url,
          page_title,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting');
      `,
      [conversationId, hashToken(customerToken), name, email, phone, message, pageUrl || null, pageTitle || null]
    );

    await query(
      `INSERT INTO live_chat_messages (conversation_id, sender_type, sender_name, message) VALUES ($1, 'customer', $2, $3);`,
      [conversationId, name, message]
    );

    return response.status(201).json({
      success: true,
      conversationId,
      customerToken,
      status: "waiting",
      estimatedWaitMinutes: support.estimatedWaitMinutes
    });
  } catch (error) {
    console.error("Create live chat request error:", error);
    return response.status(500).json({ success: false, error: "Live chat could not be started." });
  }
});

publicRouter.get("/:conversationId", async function (request, response) {
  try {
    await ensureSchema();

    const conversationId = cleanText(request.params.conversationId, 100);
    const token = cleanText(request.query.token, 500);
    const conversation = await getConversation(conversationId);

    if (!conversation || !verifyCustomerToken(conversation, token)) {
      return response.status(404).json({ success: false, error: "Conversation was not found." });
    }

    const messages = await getMessages(conversationId, request.query.after);

    return response.json({
      success: true,
      conversation: {
        conversationId: conversation.conversation_id,
        status: conversation.status,
        assignedAgentName: conversation.assigned_agent_name,
        requestedAt: conversation.requested_at,
        acceptedAt: conversation.accepted_at,
        closedAt: conversation.closed_at
      },
      messages
    });
  } catch (error) {
    console.error("Customer live chat poll error:", error);
    return response.status(500).json({ success: false, error: "Conversation could not be loaded." });
  }
});

publicRouter.post("/:conversationId/messages", async function (request, response) {
  try {
    await ensureSchema();

    const conversationId = cleanText(request.params.conversationId, 100);
    const token = cleanText(request.body && request.body.token, 500);
    const message = cleanText(request.body && request.body.message, MAX_MESSAGE_LENGTH);
    const conversation = await getConversation(conversationId);

    if (!conversation || !verifyCustomerToken(conversation, token)) {
      return response.status(404).json({ success: false, error: "Conversation was not found." });
    }

    if (!message) {
      return response.status(400).json({ success: false, error: "Message is required." });
    }

    if (conversation.status === "closed") {
      return response.status(409).json({ success: false, error: "This conversation is closed." });
    }

    const inserted = await query(
      `
        INSERT INTO live_chat_messages (conversation_id, sender_type, sender_name, message)
        VALUES ($1, 'customer', $2, $3)
        RETURNING id, sender_type, sender_name, message, created_at;
      `,
      [conversationId, conversation.customer_name, message]
    );

    await query(`UPDATE live_chat_conversations SET updated_at = NOW() WHERE conversation_id = $1;`, [conversationId]);

    return response.status(201).json({ success: true, message: inserted.rows[0] });
  } catch (error) {
    console.error("Customer live message error:", error);
    return response.status(500).json({ success: false, error: "Message could not be sent." });
  }
});

adminRouter.get("/health", async function (request, response) {
  try {
    await ensureSchema();
    return response.json({ success: true, database: true });
  } catch (error) {
    console.error("Live admin health error:", error);
    return response.status(503).json({ success: false, error: "Live chat database is unavailable." });
  }
});

adminRouter.post("/presence", async function (request, response) {
  try {
    await ensureSchema();

    const agentId = cleanText(request.body && request.body.agentId, 100);
    const agentName = cleanText(request.body && request.body.agentName, 100);

    if (!agentId || !agentName) {
      return response.status(400).json({ success: false, error: "Agent ID and name are required." });
    }

    await query(
      `
        INSERT INTO live_chat_agents (agent_id, agent_name, last_seen_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (agent_id)
        DO UPDATE SET agent_name = EXCLUDED.agent_name, last_seen_at = NOW();
      `,
      [agentId, agentName]
    );

    const status = await getLiveSupportStatus();
    return response.json(status);
  } catch (error) {
    console.error("Live agent presence error:", error);
    return response.status(500).json({ success: false, error: "Agent presence could not be updated." });
  }
});

adminRouter.get("/conversations", async function (request, response) {
  try {
    await ensureSchema();

    const result = await query(`
      SELECT
        c.conversation_id,
        c.customer_name,
        c.customer_email,
        c.customer_phone,
        c.initial_message,
        c.page_url,
        c.page_title,
        c.status,
        c.assigned_agent_id,
        c.assigned_agent_name,
        c.requested_at,
        c.accepted_at,
        c.closed_at,
        c.updated_at,
        COALESCE(m.message_count, 0)::int AS message_count
      FROM live_chat_conversations c
      LEFT JOIN (
        SELECT conversation_id, COUNT(*) AS message_count
        FROM live_chat_messages
        GROUP BY conversation_id
      ) m ON m.conversation_id = c.conversation_id
      WHERE c.status <> 'closed' OR c.closed_at >= NOW() - INTERVAL '7 days'
      ORDER BY
        CASE c.status WHEN 'waiting' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
        CASE WHEN c.status = 'waiting' THEN c.requested_at END ASC,
        c.updated_at DESC
      LIMIT 200;
    `);

    return response.json({ success: true, conversations: result.rows });
  } catch (error) {
    console.error("List live conversations error:", error);
    return response.status(500).json({ success: false, error: "Conversations could not be loaded." });
  }
});

adminRouter.get("/conversations/:conversationId", async function (request, response) {
  try {
    await ensureSchema();

    const conversationId = cleanText(request.params.conversationId, 100);
    const conversation = await getConversation(conversationId);
    if (!conversation) {
      return response.status(404).json({ success: false, error: "Conversation was not found." });
    }

    const messages = await getMessages(conversationId, request.query.after);
    delete conversation.customer_token_hash;

    return response.json({ success: true, conversation, messages });
  } catch (error) {
    console.error("Load live conversation error:", error);
    return response.status(500).json({ success: false, error: "Conversation could not be loaded." });
  }
});

adminRouter.post("/conversations/:conversationId/accept", async function (request, response) {
  try {
    await ensureSchema();

    const conversationId = cleanText(request.params.conversationId, 100);
    const agentId = cleanText(request.body && request.body.agentId, 100);
    const agentName = cleanText(request.body && request.body.agentName, 100);

    if (!agentId || !agentName) {
      return response.status(400).json({ success: false, error: "Agent ID and name are required." });
    }

    const updated = await query(
      `
        UPDATE live_chat_conversations
        SET
          status = 'active',
          assigned_agent_id = $2,
          assigned_agent_name = $3,
          accepted_at = COALESCE(accepted_at, NOW()),
          updated_at = NOW()
        WHERE conversation_id = $1 AND status = 'waiting'
        RETURNING conversation_id, status, assigned_agent_id, assigned_agent_name, accepted_at;
      `,
      [conversationId, agentId, agentName]
    );

    if (!updated.rows[0]) {
      const current = await getConversation(conversationId);
      if (!current) {
        return response.status(404).json({ success: false, error: "Conversation was not found." });
      }
      return response.status(409).json({ success: false, error: "This conversation is no longer waiting." });
    }

    await query(
      `INSERT INTO live_chat_messages (conversation_id, sender_type, sender_name, message) VALUES ($1, 'system', 'G-Floor', $2);`,
      [conversationId, agentName + " joined the conversation."]
    );

    return response.json({ success: true, conversation: updated.rows[0] });
  } catch (error) {
    console.error("Accept live conversation error:", error);
    return response.status(500).json({ success: false, error: "Conversation could not be accepted." });
  }
});

adminRouter.post("/conversations/:conversationId/messages", async function (request, response) {
  try {
    await ensureSchema();

    const conversationId = cleanText(request.params.conversationId, 100);
    const agentId = cleanText(request.body && request.body.agentId, 100);
    const agentName = cleanText(request.body && request.body.agentName, 100);
    const message = cleanText(request.body && request.body.message, MAX_MESSAGE_LENGTH);
    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return response.status(404).json({ success: false, error: "Conversation was not found." });
    }

    if (conversation.status !== "active") {
      return response.status(409).json({ success: false, error: "Accept the conversation before replying." });
    }

    if (!agentId || !agentName || !message) {
      return response.status(400).json({ success: false, error: "Agent ID, name, and message are required." });
    }

    const inserted = await query(
      `
        INSERT INTO live_chat_messages (conversation_id, sender_type, sender_name, message)
        VALUES ($1, 'agent', $2, $3)
        RETURNING id, sender_type, sender_name, message, created_at;
      `,
      [conversationId, agentName, message]
    );

    await query(
      `
        UPDATE live_chat_conversations
        SET assigned_agent_id = COALESCE(assigned_agent_id, $2), assigned_agent_name = COALESCE(assigned_agent_name, $3), updated_at = NOW()
        WHERE conversation_id = $1;
      `,
      [conversationId, agentId, agentName]
    );

    return response.status(201).json({ success: true, message: inserted.rows[0] });
  } catch (error) {
    console.error("Agent live message error:", error);
    return response.status(500).json({ success: false, error: "Message could not be sent." });
  }
});

adminRouter.post("/conversations/:conversationId/close", async function (request, response) {
  try {
    await ensureSchema();

    const conversationId = cleanText(request.params.conversationId, 100);
    const agentName = cleanText(request.body && request.body.agentName, 100) || "Customer Service";

    const updated = await query(
      `
        UPDATE live_chat_conversations
        SET status = 'closed', closed_at = NOW(), updated_at = NOW()
        WHERE conversation_id = $1 AND status <> 'closed'
        RETURNING conversation_id, status, closed_at;
      `,
      [conversationId]
    );

    if (!updated.rows[0]) {
      const existing = await getConversation(conversationId);
      if (!existing) {
        return response.status(404).json({ success: false, error: "Conversation was not found." });
      }
      return response.json({ success: true, conversation: { conversation_id: conversationId, status: "closed", closed_at: existing.closed_at } });
    }

    await query(
      `INSERT INTO live_chat_messages (conversation_id, sender_type, sender_name, message) VALUES ($1, 'system', 'G-Floor', $2);`,
      [conversationId, agentName + " closed the conversation."]
    );

    return response.json({ success: true, conversation: updated.rows[0] });
  } catch (error) {
    console.error("Close live conversation error:", error);
    return response.status(500).json({ success: false, error: "Conversation could not be closed." });
  }
});

module.exports = {
  publicRouter,
  adminRouter,
  getLiveSupportStatus,
  ensureSchema
};
