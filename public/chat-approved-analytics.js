(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Approved Knowledge Analytics and PostgreSQL Reporting
  |--------------------------------------------------------------------------
  |
  | STEP 20J.2
  |
  | This file performs two functions:
  |
  | 1. Pushes approved-knowledge events into window.dataLayer for GTM/GA4.
  | 2. Sends anonymous approved-knowledge events to PostgreSQL reporting.
  |
  | Events:
  |
  | gfloor_chat_approved_knowledge_answer
  | gfloor_chat_approved_knowledge_helpful_yes
  | gfloor_chat_approved_knowledge_helpful_no
  |
  | Privacy:
  |
  | This file does not send or store:
  |
  | - raw customer questions
  | - raw chatbot answers
  | - names
  | - email addresses
  | - phone numbers
  | - order numbers
  | - chat transcripts
  |
  |--------------------------------------------------------------------------
  */

  const VERSION = "20.10";

  const API_BASE_URL =
    "https://gfloor-chatfeature.onrender.com";

  const REPORTING_ENDPOINT =
    API_BASE_URL +
    "/chat/approved-knowledge/events";

  const ANSWER_EVENT =
    "gfloor_chat_approved_knowledge_answer";

  const HELPFUL_YES_EVENT =
    "gfloor_chat_approved_knowledge_helpful_yes";

  const HELPFUL_NO_EVENT =
    "gfloor_chat_approved_knowledge_helpful_no";

  const APPROVED_STATE_MAX_AGE =
    30 * 60 * 1000;

  const state = {
    initialized: false,

    responseObserver: null,

    lastApprovedKnowledgeId: "",

    lastApprovedCategory: "",

    lastApprovedResponseType: "",

    lastApprovedSignature: "",

    lastApprovedTimestamp: 0,

    sentClientEventIds:
      new Set(),

    submittedFeedback:
      new Set()
  };

  /*
  |--------------------------------------------------------------------------
  | dataLayer
  |--------------------------------------------------------------------------
  */

  window.dataLayer =
    window.dataLayer || [];

  /*
  |--------------------------------------------------------------------------
  | General Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(
    value,
    maximumLength
  ) {
    const cleaned =
      String(
        value == null
          ? ""
          : value
      )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (
      typeof maximumLength ===
        "number" &&
      maximumLength > 0
    ) {
      return cleaned.slice(
        0,
        maximumLength
      );
    }

    return cleaned;
  }

  function normalizeText(
    value
  ) {
    return cleanText(
      value
    )
      .toLowerCase()
      .replace(
        /g-floor/g,
        "gfloor"
      )
      .replace(
        /g floor/g,
        "gfloor"
      )
      .replace(
        /®/g,
        ""
      )
      .replace(
        /™/g,
        ""
      )
      .replace(
        /[^a-z0-9\s]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function createRandomId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      return window.crypto
        .randomUUID();
    }

    return (
      Date.now()
        .toString(36) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2)
    );
  }

  function createClientEventId(
    eventType,
    approvedKnowledgeId
  ) {
    return [
      "gf",
      VERSION,
      eventType,
      approvedKnowledgeId,
      Date.now(),
      createRandomId()
    ].join("-");
  }

  /*
  |--------------------------------------------------------------------------
  | Page Context
  |--------------------------------------------------------------------------
  */

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

  function getProductHandle() {
    const match =
      window.location.pathname.match(
        /\/products\/([^/?#]+)/
      );

    if (
      !match ||
      !match[1]
    ) {
      return "";
    }

    try {
      return cleanText(
        decodeURIComponent(
          match[1]
        ),
        300
      );
    } catch (
      error
    ) {
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

    if (
      !match ||
      !match[1]
    ) {
      return "";
    }

    try {
      return cleanText(
        decodeURIComponent(
          match[1]
        ),
        300
      );
    } catch (
      error
    ) {
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
        ).get(
          "variant"
        ) || "",
        100
      );
    } catch (
      error
    ) {
      return "";
    }
  }

  function detectPageType() {
    const path =
      window.location.pathname;

    if (
      path === "/" ||
      path === ""
    ) {
      return "home";
    }

    if (
      path.includes(
        "/products/"
      )
    ) {
      return "product";
    }

    if (
      path.includes(
        "/collections/"
      )
    ) {
      return "collection";
    }

    if (
      path.includes(
        "/cart"
      )
    ) {
      return "cart";
    }

    if (
      path.includes(
        "/search"
      )
    ) {
      return "search";
    }

    if (
      path.includes(
        "/pages/"
      )
    ) {
      return "page";
    }

    if (
      path.includes(
        "/blogs/"
      )
    ) {
      return "article";
    }

    return "other";
  }

  function getViewportGroup() {
    const width =
      window.innerWidth || 0;

    if (
      width <= 767
    ) {
      return "mobile";
    }

    if (
      width <= 1024
    ) {
      return "tablet";
    }

    return "desktop";
  }

  function getBaseContext() {
    return {
      conversation_id:
        getConversationId(),

      chat_page_type:
        detectPageType(),

      product_handle:
        getProductHandle(),

      collection_handle:
        getCollectionHandle(),

      variant_id:
        getVariantId()
    };
  }

  /*
  |--------------------------------------------------------------------------
  | GTM / GA4 Event Push
  |--------------------------------------------------------------------------
  */

  function pushDataLayerEvent(
    eventName,
    parameters
  ) {
    const payload =
      Object.assign(
        {
          event:
            eventName,

          chat_analytics_version:
            VERSION,

          chat_source:
            "gfloor_custom_chat",

          knowledge_source:
            "approved_database",

          response_mode:
            "approved_database",

          page_location:
            window.location.href,

          page_path:
            window.location.pathname,

          page_title:
            document.title
        },
        parameters || {}
      );

    window.dataLayer.push(
      payload
    );

    console.log(
      "G-Floor approved knowledge analytics:",
      payload
    );

    return payload;
  }

  /*
  |--------------------------------------------------------------------------
  | PostgreSQL Reporting Payload
  |--------------------------------------------------------------------------
  */

  function createReportingPayload(
    eventName,
    parameters
  ) {
    const eventType =
      cleanText(
        eventName,
        100
      ).replace(
        /^gfloor_chat_/,
        ""
      );

    const context =
      getBaseContext();

    return {
      client_event_id:
        createClientEventId(
          eventType,
          parameters
            .approved_knowledge_id
        ),

      event_type:
        eventType,

      approved_knowledge_id:
        cleanText(
          parameters
            .approved_knowledge_id,
          150
        ),

      approved_knowledge_category:
        cleanText(
          parameters
            .approved_knowledge_category,
          150
        ),

      approved_response_type:
        cleanText(
          parameters
            .approved_response_type,
          50
        ),

      knowledge_source:
        "approved_database",

      response_mode:
        "approved_database",

      conversation_id:
        context.conversation_id,

      chat_page_type:
        context.chat_page_type,

      product_handle:
        context.product_handle,

      collection_handle:
        context.collection_handle,

      variant_id:
        context.variant_id,

      occurred_at:
        new Date()
          .toISOString(),

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
  | PostgreSQL Event Delivery
  |--------------------------------------------------------------------------
  */

  async function sendReportingEvent(
    eventName,
    parameters
  ) {
    const approvedKnowledgeId =
      cleanText(
        parameters &&
        parameters
          .approved_knowledge_id,
        150
      );

    if (
      !approvedKnowledgeId
    ) {
      console.warn(
        "Approved reporting event skipped: approved_knowledge_id is missing."
      );

      return {
        success: false,
        skipped: true
      };
    }

    const payload =
      createReportingPayload(
        eventName,
        parameters
      );

    if (
      state.sentClientEventIds.has(
        payload.client_event_id
      )
    ) {
      return {
        success: true,
        duplicate: true
      };
    }

    state.sentClientEventIds.add(
      payload.client_event_id
    );

    try {
      const response =
        await fetch(
          REPORTING_ENDPOINT,
          {
            method:
              "POST",

            mode:
              "cors",

            credentials:
              "omit",

            cache:
              "no-store",

            keepalive:
              true,

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );

      let result = null;

      try {
        result =
          await response.json();
      } catch (
        error
      ) {
        result = null;
      }

      if (
        !response.ok
      ) {
        throw new Error(
          result &&
          result.error
            ? result.error
            : "Reporting request failed with HTTP " +
              response.status
        );
      }

      console.log(
        "G-Floor approved knowledge reporting stored:",
        {
          event:
            eventName,

          approvedKnowledgeId,

          stored:
            result &&
            result.stored === true,

          duplicate:
            result &&
            result.duplicate === true
        }
      );

      return {
        success: true,
        result
      };
    } catch (
      error
    ) {
      /*
       * Reporting failure must never interrupt the customer chat.
       */

      console.warn(
        "G-Floor approved knowledge reporting could not be stored:",
        error.message
      );

      return {
        success: false,
        error:
          error.message
      };
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Combined Analytics Tracking
  |--------------------------------------------------------------------------
  */

  function trackEvent(
    eventName,
    parameters
  ) {
    pushDataLayerEvent(
      eventName,
      parameters
    );

    sendReportingEvent(
      eventName,
      parameters
    );
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

  function getResponseBox() {
    return document.querySelector(
      "#gfloor-response-box"
    );
  }

  function getVisibleResponseText() {
    const responseBox =
      getResponseBox();

    if (
      !responseBox ||
      !responseBox.classList.contains(
        "show"
      )
    ) {
      return "";
    }

    return cleanText(
      responseBox.textContent
    );
  }

  function getVisibleResponseCategory() {
    const responseBox =
      getResponseBox();

    if (!responseBox) {
      return "";
    }

    const category =
      responseBox.querySelector(
        ".gfloor-response-category"
      );

    return category
      ? cleanText(
          category.textContent,
          150
        )
      : "";
  }

  function getApprovedKnowledgeId(
    item
  ) {
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

  function getApprovedResponseType(
    item
  ) {
    return cleanText(
      item &&
      (
        item.responseType ||
        item.response_type
      ),
      50
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Match Displayed Answer to Approved Knowledge
  |--------------------------------------------------------------------------
  */

  function findDisplayedApprovedKnowledge() {
    const approvedKnowledge =
      getApprovedKnowledge();

    if (
      approvedKnowledge.length ===
        0
    ) {
      return null;
    }

    const responseText =
      normalizeText(
        getVisibleResponseText()
      );

    const responseCategory =
      normalizeText(
        getVisibleResponseCategory()
      );

    if (!responseText) {
      return null;
    }

    /*
     * Strongest match:
     * approved answer appears in the displayed response.
     */

    const answerMatch =
      approvedKnowledge.find(
        function (
          item
        ) {
          const approvedAnswer =
            normalizeText(
              item &&
              item.answer
            );

          return (
            approvedAnswer &&
            approvedAnswer.length >=
              10 &&
            responseText.includes(
              approvedAnswer
            )
          );
        }
      );

    if (answerMatch) {
      return answerMatch;
    }

    /*
     * Fallback:
     * only one approved entry uses the displayed category.
     */

    if (
      responseCategory
    ) {
      const categoryMatches =
        approvedKnowledge.filter(
          function (
            item
          ) {
            return (
              normalizeText(
                item &&
                item.category
              ) ===
              responseCategory
            );
          }
        );

      if (
        categoryMatches.length ===
          1
      ) {
        return categoryMatches[0];
      }
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Approved Answer Tracking
  |--------------------------------------------------------------------------
  */

  function trackApprovedAnswer() {
    const item =
      findDisplayedApprovedKnowledge();

    const approvedKnowledgeId =
      getApprovedKnowledgeId(
        item
      );

    if (
      !item ||
      !approvedKnowledgeId
    ) {
      return;
    }

    const responseCategory =
      getVisibleResponseCategory();

    const signature =
      [
        getConversationId(),
        approvedKnowledgeId,
        normalizeText(
          getVisibleResponseText()
        )
      ].join(
        "|"
      );

    if (
      signature ===
      state.lastApprovedSignature
    ) {
      return;
    }

    state.lastApprovedSignature =
      signature;

    state.lastApprovedKnowledgeId =
      approvedKnowledgeId;

    state.lastApprovedCategory =
      cleanText(
        item.category ||
        responseCategory,
        150
      );

    state.lastApprovedResponseType =
      getApprovedResponseType(
        item
      ) || "AUTO";

    state.lastApprovedTimestamp =
      Date.now();

    state.submittedFeedback.clear();

    trackEvent(
      ANSWER_EVENT,
      Object.assign(
        {},
        getBaseContext(),
        {
          approved_knowledge_id:
            state
              .lastApprovedKnowledgeId,

          approved_knowledge_category:
            state
              .lastApprovedCategory ||
            "unknown",

          approved_response_type:
            state
              .lastApprovedResponseType ||
            "AUTO",

          answer_status:
            "answered",

          response_mode:
            "approved_database",

          response_category:
            normalizeText(
              state
                .lastApprovedCategory
            )
              .replace(
                /\s+/g,
                "_"
              ) ||
            "unknown"
        }
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Helpful Feedback Tracking
  |--------------------------------------------------------------------------
  */

  function trackApprovedHelpful(
    helpful
  ) {
    if (
      !state.lastApprovedKnowledgeId
    ) {
      return;
    }

    const age =
      Date.now() -
      state.lastApprovedTimestamp;

    if (
      age >
      APPROVED_STATE_MAX_AGE
    ) {
      return;
    }

    const eventName =
      helpful
        ? HELPFUL_YES_EVENT
        : HELPFUL_NO_EVENT;

    const feedbackSignature =
      [
        state
          .lastApprovedSignature,
        eventName
      ].join(
        "|"
      );

    if (
      state.submittedFeedback.has(
        feedbackSignature
      )
    ) {
      return;
    }

    state.submittedFeedback.add(
      feedbackSignature
    );

    trackEvent(
      eventName,
      Object.assign(
        {},
        getBaseContext(),
        {
          approved_knowledge_id:
            state
              .lastApprovedKnowledgeId,

          approved_knowledge_category:
            state
              .lastApprovedCategory ||
            "unknown",

          approved_response_type:
            state
              .lastApprovedResponseType ||
            "AUTO",

          response_mode:
            "approved_database",

          helpful_response:
            helpful
              ? "yes"
              : "no"
        }
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Response Observer
  |--------------------------------------------------------------------------
  */

  function observeResponses() {
    const responseBox =
      getResponseBox();

    if (!responseBox) {
      return false;
    }

    if (
      state.responseObserver
    ) {
      return true;
    }

    state.responseObserver =
      new MutationObserver(
        function () {
          window.setTimeout(
            trackApprovedAnswer,
            75
          );
        }
      );

    state.responseObserver.observe(
      responseBox,
      {
        attributes:
          true,

        attributeFilter: [
          "class"
        ],

        childList:
          true,

        subtree:
          true,

        characterData:
          true
      }
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Helpful Button Listener
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "click",
    function (
      event
    ) {
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
          "#gfloor-helpful-yes"
        )
      ) {
        trackApprovedHelpful(
          true
        );

        return;
      }

      if (
        target.closest(
          "#gfloor-helpful-no"
        )
      ) {
        trackApprovedHelpful(
          false
        );
      }
    },
    true
  );

  /*
  |--------------------------------------------------------------------------
  | Approved Knowledge Loaded Event
  |--------------------------------------------------------------------------
  |
  | This event remains GTM-only because it does not represent an approved
  | answer being shown to a customer.
  |
  |--------------------------------------------------------------------------
  */

  window.addEventListener(
    "gfloor-approved-knowledge-loaded",
    function (
      event
    ) {
      const count =
        event &&
        event.detail
          ? Number(
              event.detail.count ||
              0
            )
          : getApprovedKnowledge()
              .length;

      pushDataLayerEvent(
        "gfloor_chat_approved_knowledge_loaded",
        Object.assign(
          {},
          getBaseContext(),
          {
            approved_knowledge_count:
              count
          }
        )
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Initialize
  |--------------------------------------------------------------------------
  */

  function initialize() {
    if (
      state.initialized
    ) {
      return;
    }

    if (
      !observeResponses()
    ) {
      return;
    }

    state.initialized =
      true;

    pushDataLayerEvent(
      "gfloor_chat_approved_analytics_loaded",
      Object.assign(
        {},
        getBaseContext(),
        {
          approved_knowledge_count:
            getApprovedKnowledge()
              .length,

          reporting_endpoint_enabled:
            true
        }
      )
    );

    trackApprovedAnswer();

    console.log(
      "G-Floor approved knowledge analytics and reporting loaded:",
      VERSION
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Retry Until Widget Exists
  |--------------------------------------------------------------------------
  */

  let attempts = 0;

  const initializationTimer =
    window.setInterval(
      function () {
        attempts += 1;

        initialize();

        if (
          state.initialized ||
          attempts >= 60
        ) {
          window.clearInterval(
            initializationTimer
          );
        }
      },
      250
    );
})();