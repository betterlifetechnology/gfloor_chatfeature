(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Approved Knowledge PostgreSQL Reporting
  |--------------------------------------------------------------------------
  |
  | STEP 20J.3B
  |
  | Safe standalone reporting module.
  |
  | This file:
  |
  | - does not intercept question submission
  | - does not stop click propagation
  | - does not alter widget.js
  | - does not alter mascot processing
  | - does not wrap window.dataLayer.push
  | - does not store raw customer questions
  | - does not store chatbot answer text
  |
  |--------------------------------------------------------------------------
  */

  const VERSION = "20.13";

  const REPORTING_ENDPOINT =
    "https://gfloor-chatfeature.onrender.com/chat/approved-knowledge/events";

  const ANSWER_EVENT =
    "approved_knowledge_answer";

  const HELPFUL_YES_EVENT =
    "approved_knowledge_helpful_yes";

  const HELPFUL_NO_EVENT =
    "approved_knowledge_helpful_no";

  const RESPONSE_POLL_INTERVAL_MS = 200;
  const RESPONSE_POLL_MAX_ATTEMPTS = 75;
  const APPROVED_STATE_MAX_AGE_MS = 30 * 60 * 1000;

  const state = {
    initialized: false,
    activeKnowledgeId: "",
    activeCategory: "",
    activeResponseType: "",
    activeAnswerSignature: "",
    activeAnswerTimestamp: 0,
    recordedAnswerSignatures: new Set(),
    recordedFeedbackSignatures: new Set()
  };

  /*
  |--------------------------------------------------------------------------
  | Text Helpers
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

  function normalizeText(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/g-floor/g, "gfloor")
      .replace(/g floor/g, "gfloor")
      .replace(/[®™]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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

  /*
  |--------------------------------------------------------------------------
  | Approved Knowledge Helpers
  |--------------------------------------------------------------------------
  */

  function getApprovedKnowledge() {
    return Array.isArray(
      window.GFloorApprovedKnowledge
    )
      ? window.GFloorApprovedKnowledge
      : [];
  }

  function getKnowledgeId(item) {
    return cleanText(
      item &&
        (
          item.id ||
          item.knowledgeId ||
          item.knowledge_id
        ),
      150
    );
  }

  function getKnowledgeAnswer(item) {
    return cleanText(
      item && item.answer,
      10000
    );
  }

  function getKnowledgeCategory(item) {
    return cleanText(
      item && item.category,
      150
    );
  }

  function getKnowledgeResponseType(item) {
    return cleanText(
      item &&
        (
          item.responseType ||
          item.response_type
        ),
      50
    ) || "AUTO";
  }

  /*
  |--------------------------------------------------------------------------
  | Widget DOM Helpers
  |--------------------------------------------------------------------------
  */

  function getResponseBox() {
    return document.querySelector(
      "#gfloor-response-box"
    );
  }

  function responseBoxIsVisible(responseBox) {
    if (!responseBox) {
      return false;
    }

    return (
      responseBox.classList.contains("show") ||
      responseBox.offsetParent !== null
    );
  }

  function getVisibleResponseText() {
    const responseBox = getResponseBox();

    if (
      !responseBox ||
      !responseBoxIsVisible(responseBox)
    ) {
      return "";
    }

    return cleanText(
      responseBox.textContent,
      15000
    );
  }

  function getVisibleResponseCategory() {
    const responseBox = getResponseBox();

    if (!responseBox) {
      return "";
    }

    const categoryElement =
      responseBox.querySelector(
        ".gfloor-response-category"
      );

    return categoryElement
      ? cleanText(
          categoryElement.textContent,
          150
        )
      : "";
  }

  function getConversationId() {
    const element =
      document.querySelector(
        ".gfloor-conversation-id"
      );

    return element
      ? cleanText(
          element.textContent,
          150
        )
      : "";
  }

  /*
  |--------------------------------------------------------------------------
  | Page Context
  |--------------------------------------------------------------------------
  */

  function getProductHandle() {
    const match =
      window.location.pathname.match(
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
      return cleanText(
        match[1],
        300
      );
    }
  }

  function getCollectionHandle() {
    const match =
      window.location.pathname.match(
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
      return cleanText(
        match[1],
        300
      );
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
    const path =
      window.location.pathname;

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
    const width =
      window.innerWidth || 0;

    if (width <= 767) {
      return "mobile";
    }

    if (width <= 1024) {
      return "tablet";
    }

    return "desktop";
  }

  /*
  |--------------------------------------------------------------------------
  | Match Rendered Answer
  |--------------------------------------------------------------------------
  */

  function findRenderedApprovedKnowledge() {
    const approvedKnowledge =
      getApprovedKnowledge();

    if (approvedKnowledge.length === 0) {
      return null;
    }

    const visibleResponseText =
      normalizeText(
        getVisibleResponseText()
      );

    if (!visibleResponseText) {
      return null;
    }

    const exactAnswerMatch =
      approvedKnowledge.find(
        function (item) {
          const approvedAnswer =
            normalizeText(
              getKnowledgeAnswer(item)
            );

          return (
            approvedAnswer.length >= 10 &&
            visibleResponseText.includes(
              approvedAnswer
            )
          );
        }
      );

    if (exactAnswerMatch) {
      return exactAnswerMatch;
    }

    const visibleCategory =
      normalizeText(
        getVisibleResponseCategory()
      );

    if (!visibleCategory) {
      return null;
    }

    const categoryMatches =
      approvedKnowledge.filter(
        function (item) {
          return (
            normalizeText(
              getKnowledgeCategory(item)
            ) === visibleCategory
          );
        }
      );

    return categoryMatches.length === 1
      ? categoryMatches[0]
      : null;
  }

  /*
  |--------------------------------------------------------------------------
  | Reporting Payload
  |--------------------------------------------------------------------------
  */

  function createPayload(
    eventType,
    item
  ) {
    const knowledgeId =
      getKnowledgeId(item);

    return {
      client_event_id: [
        "gfloor",
        VERSION,
        eventType,
        knowledgeId,
        createRandomId()
      ].join("-"),

      event_type:
        eventType,

      approved_knowledge_id:
        knowledgeId,

      approved_knowledge_category:
        getKnowledgeCategory(item),

      approved_response_type:
        getKnowledgeResponseType(item),

      knowledge_source:
        "approved_database",

      response_mode:
        "approved_database",

      conversation_id:
        getConversationId(),

      chat_page_type:
        getPageType(),

      product_handle:
        getProductHandle(),

      collection_handle:
        getCollectionHandle(),

      variant_id:
        getVariantId(),

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

  async function sendReportingEvent(
    eventType,
    item
  ) {
    const knowledgeId =
      getKnowledgeId(item);

    if (!knowledgeId) {
      return;
    }

    const payload =
      createPayload(
        eventType,
        item
      );

    try {
      const response =
        await fetch(
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

            body:
              JSON.stringify(payload)
          }
        );

      let result = null;

      try {
        result =
          await response.json();
      } catch (error) {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          result && result.error
            ? result.error
            : "HTTP " + response.status
        );
      }

      console.log(
        "G-Floor approved reporting stored:",
        {
          eventType,
          knowledgeId,
          stored:
            Boolean(
              result && result.stored
            ),
          duplicate:
            Boolean(
              result && result.duplicate
            )
        }
      );
    } catch (error) {
      /*
       * Reporting must never interrupt the chatbot.
       */

      console.warn(
        "G-Floor approved reporting failed:",
        error.message
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Record Approved Answer
  |--------------------------------------------------------------------------
  */

  function recordRenderedApprovedAnswer() {
    const item =
      findRenderedApprovedKnowledge();

    if (!item) {
      return false;
    }

    const knowledgeId =
      getKnowledgeId(item);

    const answerSignature = [
      getConversationId(),
      knowledgeId,
      normalizeText(
        getVisibleResponseText()
      )
    ].join("|");

    state.activeKnowledgeId =
      knowledgeId;

    state.activeCategory =
      getKnowledgeCategory(item);

    state.activeResponseType =
      getKnowledgeResponseType(item);

    state.activeAnswerSignature =
      answerSignature;

    state.activeAnswerTimestamp =
      Date.now();

    if (
      state.recordedAnswerSignatures.has(
        answerSignature
      )
    ) {
      return true;
    }

    state.recordedAnswerSignatures.add(
      answerSignature
    );

    sendReportingEvent(
      ANSWER_EVENT,
      item
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Poll After Question Submission
  |--------------------------------------------------------------------------
  */

  function waitForRenderedAnswer() {
    let attempts = 0;

    const timer =
      window.setInterval(
        function () {
          attempts += 1;

          const recorded =
            recordRenderedApprovedAnswer();

          if (
            recorded ||
            attempts >=
              RESPONSE_POLL_MAX_ATTEMPTS
          ) {
            window.clearInterval(
              timer
            );
          }
        },
        RESPONSE_POLL_INTERVAL_MS
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Locate Active Knowledge Record
  |--------------------------------------------------------------------------
  */

  function getActiveKnowledgeItem() {
    const approvedKnowledge =
      getApprovedKnowledge();

    return approvedKnowledge.find(
      function (item) {
        return (
          getKnowledgeId(item) ===
          state.activeKnowledgeId
        );
      }
    ) || null;
  }

  /*
  |--------------------------------------------------------------------------
  | Record Helpful Feedback
  |--------------------------------------------------------------------------
  */

  function recordHelpfulFeedback(
    helpful
  ) {
    if (!state.activeKnowledgeId) {
      recordRenderedApprovedAnswer();
    }

    if (!state.activeKnowledgeId) {
      return;
    }

    const stateAge =
      Date.now() -
      state.activeAnswerTimestamp;

    if (
      stateAge >
      APPROVED_STATE_MAX_AGE_MS
    ) {
      return;
    }

    const item =
      getActiveKnowledgeItem();

    if (!item) {
      return;
    }

    const eventType =
      helpful
        ? HELPFUL_YES_EVENT
        : HELPFUL_NO_EVENT;

    const feedbackSignature = [
      state.activeAnswerSignature,
      eventType
    ].join("|");

    if (
      state.recordedFeedbackSignatures.has(
        feedbackSignature
      )
    ) {
      return;
    }

    state.recordedFeedbackSignatures.add(
      feedbackSignature
    );

    sendReportingEvent(
      eventType,
      item
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Passive Click Listener
  |--------------------------------------------------------------------------
  |
  | This listener does not call:
  |
  | - preventDefault
  | - stopPropagation
  | - stopImmediatePropagation
  |
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "click",
    function (event) {
      const target =
        event.target;

      if (
        !target ||
        typeof target.closest !==
          "function"
      ) {
        return;
      }

      if (
        target.closest(
          "#gfloor-question-submit"
        )
      ) {
        waitForRenderedAnswer();
        return;
      }

      if (
        target.closest(
          "#gfloor-helpful-yes"
        )
      ) {
        recordHelpfulFeedback(true);
        return;
      }

      if (
        target.closest(
          "#gfloor-helpful-no"
        )
      ) {
        recordHelpfulFeedback(false);
      }
    },
    false
  );

  /*
  |--------------------------------------------------------------------------
  | Enter-Key Submission Support
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "keydown",
    function (event) {
      const target =
        event.target;

      if (
        !target ||
        target.id !==
          "gfloor-chat-question"
      ) {
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        waitForRenderedAnswer();
      }
    },
    false
  );

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  state.initialized = true;

  console.log(
    "G-Floor safe approved knowledge reporting loaded:",
    VERSION
  );
})();