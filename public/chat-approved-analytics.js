(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Approved Knowledge Analytics
  |--------------------------------------------------------------------------
  |
  | STEP 20H
  |
  | Tracks when the live chatbot answers from human-approved PostgreSQL
  | knowledge.
  |
  | Events:
  |
  | gfloor_chat_approved_knowledge_answer
  | gfloor_chat_approved_knowledge_helpful_yes
  | gfloor_chat_approved_knowledge_helpful_no
  |
  | PRIVACY
  |
  | This file does NOT send:
  |
  | - raw customer questions
  | - raw chatbot answers
  | - names
  | - email addresses
  | - phone numbers
  | - order numbers
  |
  |--------------------------------------------------------------------------
  */

  const VERSION =
    "20.8";

  const state = {
    initialized:
      false,

    lastApprovedKnowledgeId:
      "",

    lastApprovedCategory:
      "",

    lastApprovedResponseType:
      "",

    lastApprovedSignature:
      "",

    lastApprovedTimestamp:
      0
  };

  /*
  |--------------------------------------------------------------------------
  | dataLayer
  |--------------------------------------------------------------------------
  */

  window.dataLayer =
    window.dataLayer ||
    [];

  function pushEvent(
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

          page_location:
            window.location.href,

          page_path:
            window.location.pathname,

          page_title:
            document.title
        },
        parameters ||
        {}
      );

    window.dataLayer.push(
      payload
    );

    console.log(
      "G-Floor approved knowledge analytics:",
      payload
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(
    value
  ) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
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

  function getConversationId() {
    const element =
      document.querySelector(
        ".gfloor-conversation-id"
      );

    return element
      ? cleanText(
          element.textContent
        )
      : "";
  }

  function getProductHandle() {
    const match =
      window.location.pathname.match(
        /\/products\/([^/?#]+)/
      );

    return (
      match &&
      match[1]
        ? decodeURIComponent(
            match[1]
          )
        : ""
    );
  }

  function getCollectionHandle() {
    const match =
      window.location.pathname.match(
        /\/collections\/([^/?#]+)/
      );

    return (
      match &&
      match[1]
        ? decodeURIComponent(
            match[1]
          )
        : ""
    );
  }

  function getVariantId() {
    try {
      return (
        new URLSearchParams(
          window.location.search
        ).get(
          "variant"
        ) ||
        ""
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
  | Approved Knowledge
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
          category.textContent
        )
      : "";
  }

  /*
  |--------------------------------------------------------------------------
  | Match the displayed answer to approved knowledge
  |--------------------------------------------------------------------------
  |
  | The widget displays:
  |
  | category
  | answer
  | Learn More
  | helpful prompt
  |
  | We match by approved answer first, then category.
  |
  |--------------------------------------------------------------------------
  */

  function findDisplayedApprovedKnowledge() {
    const approvedKnowledge =
      getApprovedKnowledge();

    if (
      !approvedKnowledge.length
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
     * approved answer appears inside the displayed response.
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
     * unique approved category matches the displayed category.
     */

    if (responseCategory) {
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
  | Answer Tracking
  |--------------------------------------------------------------------------
  */

  function trackApprovedAnswer() {
    const item =
      findDisplayedApprovedKnowledge();

    if (
      !item ||
      !item.id
    ) {
      return;
    }

    const responseCategory =
      getVisibleResponseCategory();

    const signature =
      [
        getConversationId(),
        item.id,
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
      cleanText(
        item.id
      );

    state.lastApprovedCategory =
      cleanText(
        item.category ||
        responseCategory
      );

    state.lastApprovedResponseType =
      cleanText(
        item.responseType
      );

    state.lastApprovedTimestamp =
      Date.now();

    pushEvent(
      "gfloor_chat_approved_knowledge_answer",
      Object.assign(
        {},
        getBaseContext(),
        {
          approved_knowledge_id:
            state.lastApprovedKnowledgeId,

          approved_knowledge_category:
            state.lastApprovedCategory ||
            "unknown",

          approved_response_type:
            state.lastApprovedResponseType ||
            "unknown",

          answer_status:
            "answered",

          response_mode:
            "approved_database",

          response_category:
            normalizeText(
              state.lastApprovedCategory
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

    /*
     * Prevent old approved-answer state from attaching to feedback much later.
     */

    const age =
      Date.now() -
      state.lastApprovedTimestamp;

    if (
      age >
      30 * 60 * 1000
    ) {
      return;
    }

    pushEvent(
      helpful
        ? "gfloor_chat_approved_knowledge_helpful_yes"
        : "gfloor_chat_approved_knowledge_helpful_no",
      Object.assign(
        {},
        getBaseContext(),
        {
          approved_knowledge_id:
            state.lastApprovedKnowledgeId,

          approved_knowledge_category:
            state.lastApprovedCategory ||
            "unknown",

          approved_response_type:
            state.lastApprovedResponseType ||
            "unknown",

          response_mode:
            "approved_database"
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

    const observer =
      new MutationObserver(
        function () {
          window.setTimeout(
            trackApprovedAnswer,
            50
          );
        }
      );

    observer.observe(
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
        !target.closest
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
  | Approved Knowledge Load Event
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

      pushEvent(
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

    const responseObserverReady =
      observeResponses();

    if (
      !responseObserverReady
    ) {
      return;
    }

    state.initialized =
      true;

    pushEvent(
      "gfloor_chat_approved_analytics_loaded",
      Object.assign(
        {},
        getBaseContext(),
        {
          approved_knowledge_count:
            getApprovedKnowledge()
              .length
        }
      )
    );

    /*
     * Check whether an approved answer was already visible.
     */

    trackApprovedAnswer();

    console.log(
      "G-Floor approved knowledge analytics loaded:",
      VERSION
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Retry until widget exists
  |--------------------------------------------------------------------------
  */

  let attempts =
    0;

  const initializationTimer =
    window.setInterval(
      function () {
        attempts +=
          1;

        initialize();

        if (
          state.initialized ||
          attempts >=
            60
        ) {
          window.clearInterval(
            initializationTimer
          );
        }
      },
      250
    );

})();