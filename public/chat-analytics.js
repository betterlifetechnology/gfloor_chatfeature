(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Analytics
  |--------------------------------------------------------------------------
  |
  | Tracks interactions from the custom G-Floor chat into window.dataLayer.
  |
  | Designed for:
  | - Google Tag Manager
  | - GA4
  |
  | IMPORTANT:
  | Raw customer free-text questions are NOT sent to GA4 because customers
  | could enter names, emails, phone numbers, order numbers, addresses, etc.
  |
  | Instead we track:
  | - question category
  | - answer result
  | - escalation state
  | - helpful / not helpful
  | - live-agent requests
  | - product/page context
  |
  |--------------------------------------------------------------------------
  */

  const ANALYTICS_VERSION = "17.1";

  /*
  |--------------------------------------------------------------------------
  | State
  |--------------------------------------------------------------------------
  */

  const state = {
    initialized: false,
    chatOpened: false,

    lastQuestionCategory: "",
    lastQuestionIntent: "",
    lastQuestionTimestamp: 0,

    lastResultMode: "",
    lastResultSignature: "",

    lastPageUrl: window.location.href,

    eventsFired: {}
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
    const payload = Object.assign(
      {
        event: eventName,

        chat_analytics_version:
          ANALYTICS_VERSION,

        chat_source:
          "gfloor_custom_chat",

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
      "G-Floor chat analytics:",
      payload
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Generic Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(
    value
  ) {
    return String(
      value ||
      ""
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
  | Question Classification
  |--------------------------------------------------------------------------
  */

  function classifyQuestion(
    question
  ) {
    const value =
      normalizeText(
        question
      );

    if (
      !value
    ) {
      return {
        category:
          "unknown",

        intent:
          "unknown"
      };
    }

    if (
      value.includes(
        "sku"
      )
    ) {
      return {
        category:
          "product_details",

        intent:
          "sku"
      };
    }

    if (
      value.includes(
        "size"
      )
    ) {
      return {
        category:
          "product_details",

        intent:
          "size"
      };
    }

    if (
      value.includes(
        "color"
      )
    ) {
      return {
        category:
          "product_details",

        intent:
          "color"
      };
    }

    if (
      value.includes(
        "price"
      ) ||
      value.includes(
        "cost"
      ) ||
      value.includes(
        "how much"
      )
    ) {
      return {
        category:
          "product_details",

        intent:
          "price"
      };
    }

    if (
      value.includes(
        "stock"
      ) ||
      value.includes(
        "available"
      ) ||
      value.includes(
        "availability"
      )
    ) {
      return {
        category:
          "product_details",

        intent:
          "availability"
      };
    }

    if (
      value.includes(
        "clean"
      ) ||
      value.includes(
        "wash"
      ) ||
      value.includes(
        "stain"
      ) ||
      value.includes(
        "maintenance"
      )
    ) {
      return {
        category:
          "cleaning_maintenance",

        intent:
          "cleaning"
      };
    }

    if (
      value.includes(
        "glue"
      ) ||
      value.includes(
        "adhesive"
      ) ||
      value.includes(
        "install"
      ) ||
      value.includes(
        "installation"
      ) ||
      value.includes(
        "seam"
      ) ||
      value.includes(
        "subfloor"
      )
    ) {
      return {
        category:
          "installation",

        intent:
          "installation"
      };
    }

    if (
      value.includes(
        "outside"
      ) ||
      value.includes(
        "outdoor"
      ) ||
      value.includes(
        "marine"
      )
    ) {
      return {
        category:
          "product_use",

        intent:
          "outdoor"
      };
    }

    if (
      value.includes(
        "waterproof"
      ) ||
      value.includes(
        "water proof"
      ) ||
      value.includes(
        "get wet"
      )
    ) {
      return {
        category:
          "product_use",

        intent:
          "waterproof"
      };
    }

    if (
      value.includes(
        "shipping"
      ) ||
      value.includes(
        "delivery"
      ) ||
      value.includes(
        "freight"
      ) ||
      value.includes(
        "tracking"
      )
    ) {
      return {
        category:
          "shipping_delivery",

        intent:
          "shipping"
      };
    }

    if (
      value.includes(
        "warranty"
      )
    ) {
      return {
        category:
          "warranty_returns",

        intent:
          "warranty"
      };
    }

    if (
      value.includes(
        "return"
      ) ||
      value.includes(
        "refund"
      )
    ) {
      return {
        category:
          "warranty_returns",

        intent:
          "return"
      };
    }

    if (
      value.includes(
        "order"
      ) ||
      value.includes(
        "purchase"
      ) ||
      value.includes(
        "buy"
      )
    ) {
      return {
        category:
          "order_help",

        intent:
          "order"
      };
    }

    return {
      category:
        "other",

      intent:
        "unknown"
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Question Submitted
  |--------------------------------------------------------------------------
  */

  function trackQuestionSubmission() {
    const textarea =
      document.querySelector(
        "#gfloor-chat-question"
      );

    if (
      !textarea
    ) {
      return;
    }

    const question =
      cleanText(
        textarea.value
      );

    if (
      !question
    ) {
      return;
    }

    const classification =
      classifyQuestion(
        question
      );

    state.lastQuestionCategory =
      classification.category;

    state.lastQuestionIntent =
      classification.intent;

    state.lastQuestionTimestamp =
      Date.now();

    pushEvent(
      "gfloor_chat_question",
      Object.assign(
        {},
        getBaseContext(),
        {
          question_category:
            classification.category,

          question_intent:
            classification.intent
        }
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Response Classification
  |--------------------------------------------------------------------------
  */

  function getResponseMode() {
    const helpfulActions =
      document.querySelector(
        "#gfloor-helpful-actions"
      );

    if (
      helpfulActions &&
      helpfulActions.dataset &&
      helpfulActions.dataset.mode
    ) {
      return (
        helpfulActions.dataset.mode
      );
    }

    return "";
  }

  function classifyResponse() {
    const responseBox =
      document.querySelector(
        "#gfloor-response-box"
      );

    if (
      !responseBox
    ) {
      return null;
    }

    if (
      !responseBox.classList.contains(
        "show"
      )
    ) {
      return null;
    }

    const responseText =
      normalizeText(
        responseBox.textContent
      );

    if (
      !responseText
    ) {
      return null;
    }

    const mode =
      getResponseMode();

    let answerStatus =
      "answered";

    let escalationStatus =
      "none";

    if (
      mode ===
      "escalation"
    ) {
      answerStatus =
        "unanswered";

      escalationStatus =
        "required";
    } else if (
      mode ===
      "review"
    ) {
      answerStatus =
        "answered_with_review";

      escalationStatus =
        "recommended";
    } else if (
      responseText.includes(
        "dont have enough confidence"
      ) ||
      responseText.includes(
        "customer service representative can review"
      ) ||
      responseText.includes(
        "would you like help from customer service"
      )
    ) {
      answerStatus =
        "unanswered";

      escalationStatus =
        "required";
    } else if (
      responseText.includes(
        "may depend on your specific product"
      ) ||
      responseText.includes(
        "customer service can review"
      )
    ) {
      answerStatus =
        "answered_with_review";

      escalationStatus =
        "recommended";
    }

    const categoryElement =
      responseBox.querySelector(
        ".gfloor-response-category"
      );

    const responseCategory =
      categoryElement
        ? normalizeText(
            categoryElement
              .textContent
          )
            .replace(
              /\s+/g,
              "_"
            )
        : "";

    return {
      answerStatus:
        answerStatus,

      escalationStatus:
        escalationStatus,

      responseMode:
        mode ||
        "unknown",

      responseCategory:
        responseCategory ||
        "unknown"
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Response Tracking
  |--------------------------------------------------------------------------
  */

  function trackCurrentResponse() {
    const response =
      classifyResponse();

    if (
      !response
    ) {
      return;
    }

    const signature =
      [
        state.lastQuestionTimestamp,
        response.answerStatus,
        response.escalationStatus,
        response.responseCategory
      ].join(
        "|"
      );

    if (
      signature ===
      state.lastResultSignature
    ) {
      return;
    }

    state.lastResultSignature =
      signature;

    state.lastResultMode =
      response.responseMode;

    pushEvent(
      "gfloor_chat_question_result",
      Object.assign(
        {},
        getBaseContext(),
        {
          question_category:
            state.lastQuestionCategory ||
            "unknown",

          question_intent:
            state.lastQuestionIntent ||
            "unknown",

          answer_status:
            response.answerStatus,

          escalation_status:
            response.escalationStatus,

          response_mode:
            response.responseMode,

          response_category:
            response.responseCategory
        }
      )
    );

    if (
      response.answerStatus ===
      "unanswered"
    ) {
      pushEvent(
        "gfloor_chat_unanswered",
        Object.assign(
          {},
          getBaseContext(),
          {
            question_category:
              state.lastQuestionCategory ||
              "unknown",

            question_intent:
              state.lastQuestionIntent ||
              "unknown",

            escalation_status:
              response.escalationStatus
          }
        )
      );
    }

    if (
      response.answerStatus ===
      "answered_with_review"
    ) {
      pushEvent(
        "gfloor_chat_review_recommended",
        Object.assign(
          {},
          getBaseContext(),
          {
            question_category:
              state.lastQuestionCategory ||
              "unknown",

            question_intent:
              state.lastQuestionIntent ||
              "unknown",

            response_category:
              response.responseCategory
          }
        )
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Widget Open / Close
  |--------------------------------------------------------------------------
  */

  function trackChatOpen() {
    if (
      state.chatOpened
    ) {
      return;
    }

    state.chatOpened =
      true;

    pushEvent(
      "gfloor_chat_open",
      getBaseContext()
    );
  }

  function trackChatClose() {
    if (
      !state.chatOpened
    ) {
      return;
    }

    state.chatOpened =
      false;

    pushEvent(
      "gfloor_chat_close",
      getBaseContext()
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Helpful Feedback
  |--------------------------------------------------------------------------
  */

  function trackHelpful(
    helpful
  ) {
    pushEvent(
      helpful
        ? "gfloor_chat_helpful_yes"
        : "gfloor_chat_helpful_no",
      Object.assign(
        {},
        getBaseContext(),
        {
          question_category:
            state.lastQuestionCategory ||
            "unknown",

          question_intent:
            state.lastQuestionIntent ||
            "unknown",

          response_mode:
            state.lastResultMode ||
            "unknown"
        }
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Customer Service Tracking
  |--------------------------------------------------------------------------
  */

  function trackCustomerServiceRequest(
    source
  ) {
    pushEvent(
      "gfloor_chat_customer_service_request",
      Object.assign(
        {},
        getBaseContext(),
        {
          request_source:
            source ||
            "unknown",

          question_category:
            state.lastQuestionCategory ||
            "unknown",

          question_intent:
            state.lastQuestionIntent ||
            "unknown"
        }
      )
    );
  }

  function trackContactFormSubmit() {
    pushEvent(
      "gfloor_chat_contact_submit",
      Object.assign(
        {},
        getBaseContext(),
        {
          question_category:
            state.lastQuestionCategory ||
            "unknown",

          question_intent:
            state.lastQuestionIntent ||
            "unknown"
        }
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Topic Button Tracking
  |--------------------------------------------------------------------------
  */

  function trackTopicSelection(
    button
  ) {
    if (
      !button
    ) {
      return;
    }

    pushEvent(
      "gfloor_chat_topic_select",
      Object.assign(
        {},
        getBaseContext(),
        {
          topic:
            cleanText(
              button.dataset.topic ||
              button.textContent
            )
        }
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Click Listener
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

      const launcher =
        target.closest(
          "#gfloor-chat-button"
        );

      if (
        launcher
      ) {
        const panel =
          document.querySelector(
            "#gfloor-chat-panel"
          );

        const willOpen =
          !panel ||
          !panel.classList.contains(
            "open"
          );

        window.setTimeout(
          function () {
            if (
              willOpen
            ) {
              trackChatOpen();
            } else {
              trackChatClose();
            }
          },
          0
        );

        return;
      }

      if (
        target.closest(
          "#gfloor-chat-close"
        )
      ) {
        trackChatClose();

        return;
      }

      const topicButton =
        target.closest(
          ".gfloor-topic-button"
        );

      if (
        topicButton
      ) {
        trackTopicSelection(
          topicButton
        );

        return;
      }

      if (
        target.closest(
          "#gfloor-question-submit"
        )
      ) {
        trackQuestionSubmission();

        return;
      }

      if (
        target.closest(
          "#gfloor-helpful-yes"
        )
      ) {
        trackHelpful(
          true
        );

        return;
      }

      if (
        target.closest(
          "#gfloor-helpful-no"
        )
      ) {
        trackHelpful(
          false
        );

        return;
      }

      if (
        target.closest(
          "#gfloor-human-button"
        )
      ) {
        trackCustomerServiceRequest(
          "main_button"
        );

        return;
      }

      if (
        target.closest(
          "#gfloor-connect-button"
        )
      ) {
        trackCustomerServiceRequest(
          "connect_confirmation"
        );

        return;
      }
    },
    true
  );

  /*
  |--------------------------------------------------------------------------
  | Keyboard Question Submission
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "keydown",
    function (
      event
    ) {
      if (
        event.key !==
          "Enter" ||
        event.shiftKey
      ) {
        return;
      }

      if (
        !event.target ||
        event.target.id !==
          "gfloor-chat-question"
      ) {
        return;
      }

      trackQuestionSubmission();
    },
    true
  );

  /*
  |--------------------------------------------------------------------------
  | Contact Form Submission
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "submit",
    function (
      event
    ) {
      if (
        !event.target ||
        event.target.id !==
          "gfloor-chat-form"
      ) {
        return;
      }

      trackContactFormSubmit();
    },
    true
  );

  /*
  |--------------------------------------------------------------------------
  | Response Observer
  |--------------------------------------------------------------------------
  */

  function observeResponses() {
    const responseBox =
      document.querySelector(
        "#gfloor-response-box"
      );

    if (
      !responseBox
    ) {
      window.setTimeout(
        observeResponses,
        500
      );

      return;
    }

    const observer =
      new MutationObserver(
        function () {
          window.setTimeout(
            trackCurrentResponse,
            25
          );
        }
      );

    observer.observe(
      responseBox,
      {
        childList:
          true,

        subtree:
          true,

        characterData:
          true,

        attributes:
          true
      }
    );

    const helpfulActions =
      document.querySelector(
        "#gfloor-helpful-actions"
      );

    if (
      helpfulActions
    ) {
      const helpfulObserver =
        new MutationObserver(
          function () {
            window.setTimeout(
              trackCurrentResponse,
              25
            );
          }
        );

      helpfulObserver.observe(
        helpfulActions,
        {
          attributes:
            true,

          attributeFilter: [
            "class",
            "data-mode"
          ]
        }
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | URL / Variant Changes
  |--------------------------------------------------------------------------
  */

  function trackPageContextChange() {
    if (
      state.lastPageUrl ===
      window.location.href
    ) {
      return;
    }

    state.lastPageUrl =
      window.location.href;

    pushEvent(
      "gfloor_chat_page_context_change",
      getBaseContext()
    );
  }

  window.addEventListener(
    "popstate",
    trackPageContextChange
  );

  window.setInterval(
    trackPageContextChange,
    750
  );

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  function initialize() {
    if (
      state.initialized
    ) {
      return;
    }

    state.initialized =
      true;

    observeResponses();

    pushEvent(
      "gfloor_chat_analytics_loaded",
      getBaseContext()
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();