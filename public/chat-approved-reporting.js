(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Approved Knowledge PostgreSQL Reporting
  |--------------------------------------------------------------------------
  |
  | STEP 20J.3
  |
  | This module listens for approved-knowledge events that are already pushed
  | into window.dataLayer by the working analytics module.
  |
  | It does not:
  |
  | - control chatbot answers
  | - observe the chatbot response DOM
  | - intercept question submission
  | - alter widget state
  | - send raw customer questions
  | - send chatbot answer text
  |
  |--------------------------------------------------------------------------
  */

  const VERSION = "20.11";

  const REPORTING_ENDPOINT =
    "https://gfloor-chatfeature.onrender.com/chat/approved-knowledge/events";

  const SUPPORTED_EVENTS = new Set([
    "gfloor_chat_approved_knowledge_answer",
    "gfloor_chat_approved_knowledge_helpful_yes",
    "gfloor_chat_approved_knowledge_helpful_no"
  ]);

  const processedObjects = new WeakSet();
  const processedSignatures = new Set();

  window.dataLayer = window.dataLayer || [];

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(value, maximumLength) {
    const text = String(
      value === null || value === undefined
        ? ""
        : value
    )
      .replace(/\s+/g, " ")
      .trim();

    if (
      Number.isInteger(maximumLength) &&
      maximumLength > 0
    ) {
      return text.slice(0, maximumLength);
    }

    return text;
  }

  function createRandomId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return [
      Date.now().toString(36),
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2)
    ].join("-");
  }

  function getConversationId() {
    const element = document.querySelector(
      ".gfloor-conversation-id"
    );

    return element
      ? cleanText(element.textContent, 150)
      : "";
  }

  function getProductHandle() {
    const match = window.location.pathname.match(
      /\/products\/([^/?#]+)/
    );

    if (!match || !match[1]) {
      return "";
    }

    try {
      return cleanText(
        decodeURIComponent(match[1]),
        300
      );
    } catch (error) {
      return cleanText(match[1], 300);
    }
  }

  function getCollectionHandle() {
    const match = window.location.pathname.match(
      /\/collections\/([^/?#]+)/
    );

    if (!match || !match[1]) {
      return "";
    }

    try {
      return cleanText(
        decodeURIComponent(match[1]),
        300
      );
    } catch (error) {
      return cleanText(match[1], 300);
    }
  }

  function getVariantId() {
    try {
      return cleanText(
        new URLSearchParams(
          window.location.search
        ).get("variant") || "",
        100
      );
    } catch (error) {
      return "";
    }
  }

  function getPageType() {
    const path = window.location.pathname;

    if (path === "/" || path === "") {
      return "home";
    }

    if (path.includes("/products/")) {
      return "product";
    }

    if (path.includes("/collections/")) {
      return "collection";
    }

    if (path.includes("/cart")) {
      return "cart";
    }

    if (path.includes("/search")) {
      return "search";
    }

    if (path.includes("/pages/")) {
      return "page";
    }

    if (path.includes("/blogs/")) {
      return "article";
    }

    return "other";
  }

  function getViewportGroup() {
    const width = window.innerWidth || 0;

    if (width <= 767) {
      return "mobile";
    }

    if (width <= 1024) {
      return "tablet";
    }

    return "desktop";
  }

  function normalizeEventType(eventName) {
    return cleanText(eventName, 100).replace(
      /^gfloor_chat_/,
      ""
    );
  }

  function createSignature(eventObject) {
    return [
      cleanText(eventObject.event, 100),
      cleanText(
        eventObject.approved_knowledge_id,
        150
      ),
      cleanText(
        eventObject.conversation_id ||
          getConversationId(),
        150
      ),
      cleanText(
        eventObject.helpful_response,
        20
      ),
      Date.now()
    ].join("|");
  }

  function createPayload(eventObject) {
    const eventName = cleanText(
      eventObject.event,
      100
    );

    const eventType = normalizeEventType(
      eventName
    );

    const approvedKnowledgeId = cleanText(
      eventObject.approved_knowledge_id,
      150
    );

    return {
      client_event_id: [
        "gfloor",
        VERSION,
        eventType,
        approvedKnowledgeId,
        createRandomId()
      ].join("-"),

      event_type: eventType,

      approved_knowledge_id:
        approvedKnowledgeId,

      approved_knowledge_category:
        cleanText(
          eventObject.approved_knowledge_category,
          150
        ),

      approved_response_type:
        cleanText(
          eventObject.approved_response_type,
          50
        ),

      knowledge_source:
        "approved_database",

      response_mode:
        "approved_database",

      conversation_id:
        cleanText(
          eventObject.conversation_id ||
            getConversationId(),
          150
        ),

      chat_page_type:
        cleanText(
          eventObject.chat_page_type ||
            eventObject.page_type ||
            getPageType(),
          100
        ),

      product_handle:
        cleanText(
          eventObject.product_handle ||
            getProductHandle(),
          300
        ),

      collection_handle:
        cleanText(
          eventObject.collection_handle ||
            getCollectionHandle(),
          300
        ),

      variant_id:
        cleanText(
          eventObject.variant_id ||
            getVariantId(),
          100
        ),

      occurred_at:
        new Date().toISOString(),

      metadata: {
        analytics_version:
          VERSION,

        browser_language:
          cleanText(
            navigator.language,
            100
          ),

        viewport_group:
          getViewportGroup()
      }
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Reporting Delivery
  |--------------------------------------------------------------------------
  */

  async function sendReportingEvent(eventObject) {
    const eventName = cleanText(
      eventObject && eventObject.event,
      100
    );

    if (!SUPPORTED_EVENTS.has(eventName)) {
      return;
    }

    const approvedKnowledgeId = cleanText(
      eventObject.approved_knowledge_id,
      150
    );

    if (!approvedKnowledgeId) {
      console.warn(
        "G-Floor reporting skipped because approved_knowledge_id is missing."
      );

      return;
    }

    const signature = createSignature(
      eventObject
    );

    if (processedSignatures.has(signature)) {
      return;
    }

    processedSignatures.add(signature);

    const payload = createPayload(
      eventObject
    );

    try {
      const response = await fetch(
        REPORTING_ENDPOINT,
        {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          keepalive: true,

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

      let result = null;

      try {
        result = await response.json();
      } catch (error) {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result && result.error
            ? result.error
            : `Reporting request failed with HTTP ${response.status}.`
        );
      }

      console.log(
        "G-Floor PostgreSQL reporting event stored:",
        {
          event: eventName,
          approvedKnowledgeId,
          stored:
            result &&
            result.stored === true,
          duplicate:
            result &&
            result.duplicate === true
        }
      );
    } catch (error) {
      /*
       * Analytics failure must never affect the chatbot.
       */

      console.warn(
        "G-Floor PostgreSQL reporting event failed:",
        error.message
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Existing Events
  |--------------------------------------------------------------------------
  */

  function processExistingEvents() {
    window.dataLayer.forEach(
      function (item) {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return;
        }

        if (processedObjects.has(item)) {
          return;
        }

        processedObjects.add(item);

        sendReportingEvent(item);
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Future Events
  |--------------------------------------------------------------------------
  */

  const originalPush =
    window.dataLayer.push.bind(
      window.dataLayer
    );

  window.dataLayer.push =
    function () {
      const items =
        Array.prototype.slice.call(
          arguments
        );

      const result =
        originalPush.apply(
          window.dataLayer,
          items
        );

      items.forEach(
        function (item) {
          if (
            !item ||
            typeof item !== "object"
          ) {
            return;
          }

          if (processedObjects.has(item)) {
            return;
          }

          processedObjects.add(item);

          sendReportingEvent(item);
        }
      );

      return result;
    };

  processExistingEvents();

  console.log(
    "G-Floor approved knowledge PostgreSQL reporting loaded:",
    VERSION
  );
})();