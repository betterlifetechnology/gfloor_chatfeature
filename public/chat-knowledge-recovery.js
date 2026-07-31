(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Knowledge Recovery
  |--------------------------------------------------------------------------
  |
  | Version: 20.16
  |
  | Fixes:
  |
  | - prevents duplicate event listeners
  | - prevents duplicate answer rendering
  | - prevents duplicate analytics events
  | - prevents repeated submissions while an answer is loading
  | - remains safe if Shopify accidentally loads this script twice
  |
  |--------------------------------------------------------------------------
  */

  const VERSION =
    "20.16";

  const KNOWLEDGE_BASE_URL =
    "https://gfloor-chatfeature.onrender.com/knowledge-base.js?v=" +
    VERSION;

  const CLEANING_ENTRY_ID =
    "kb-010-how-to-clean-g-floor";

  const MAX_INITIALIZATION_ATTEMPTS =
    60;

  const INITIALIZATION_INTERVAL_MS =
    250;

  const DUPLICATE_SUBMISSION_WINDOW_MS =
    2000;

  const GLOBAL_STATE_KEY =
    "__GFloorChatKnowledgeRecovery";

  /*
  |--------------------------------------------------------------------------
  | Prevent Duplicate Script Initialization
  |--------------------------------------------------------------------------
  */

  if (
    window[GLOBAL_STATE_KEY] &&
    window[GLOBAL_STATE_KEY].initialized
  ) {
    console.log(
      "G-Floor chat knowledge recovery already initialized:",
      window[GLOBAL_STATE_KEY].version
    );

    return;
  }

  const state =
    window[GLOBAL_STATE_KEY] || {
      initialized:
        false,

      version:
        VERSION,

      knowledgeLoadPromise:
        null,

      cachedKnowledge:
        [],

      processing:
        false,

      lastQuestionSignature:
        "",

      lastSubmissionTime:
        0,

      lastRenderedSignature:
        "",

      lastAnalyticsSignature:
        "",

      initializationAttempts:
        0,

      listenersAttached:
        false
    };

  state.version =
    VERSION;

  window[GLOBAL_STATE_KEY] =
    state;

  /*
  |--------------------------------------------------------------------------
  | Text Helpers
  |--------------------------------------------------------------------------
  */

  function normalizeText(value) {
    return String(
      value || ""
    )
      .toLowerCase()
      .replace(/g-floor/g, "gfloor")
      .replace(/g floor/g, "gfloor")
      .replace(/®/g, "")
      .replace(/™/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(
      value || ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createSignature(
    question,
    entryId
  ) {
    return [
      normalizeText(
        question
      ),
      String(
        entryId ||
        CLEANING_ENTRY_ID
      )
    ].join(
      "::"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Cleaning Intent Detection
  |--------------------------------------------------------------------------
  */

  function isApprovedCleaningQuestion(question) {
    const normalized =
      normalizeText(
        question
      );

    if (
      !normalized
    ) {
      return false;
    }

    const exactQuestions =
      new Set([
        "how do i clean gfloor",
        "how do i clean my gfloor",
        "how should i clean gfloor",
        "how should i clean my gfloor",
        "how can i clean gfloor",
        "how can i clean my gfloor",
        "how to clean gfloor",
        "how do you clean gfloor",
        "what should i use to clean gfloor",
        "what can i use to clean gfloor",
        "what is the best way to clean gfloor",
        "how do i wash gfloor",
        "how should i wash gfloor",
        "how do i clean this floor",
        "how do i clean this flooring",
        "how do i clean this mat",
        "how do i clean this product"
      ]);

    if (
      exactQuestions.has(
        normalized
      )
    ) {
      return true;
    }

    const hasCleaningAction =
      /\b(clean|cleaning|wash|washing|mop|mopping|rinse|rinsing|scrub|scrubbing)\b/.test(
        normalized
      );

    const hasFlooringContext =
      /\b(gfloor|floor|flooring|vinyl|mat|garage)\b/.test(
        normalized
      );

    const hasDifferentSpecificIntent =
      /\b(glue|adhesive|tar|paint|oil|stain|chemical|mold|mildew)\b/.test(
        normalized
      );

    return (
      hasCleaningAction &&
      hasFlooringContext &&
      !hasDifferentSpecificIntent
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Knowledge Base Loader
  |--------------------------------------------------------------------------
  */

  function readGlobalKnowledgeBase() {
    if (
      Array.isArray(
        window.GFloorKnowledgeBase
      )
    ) {
      state.cachedKnowledge =
        window.GFloorKnowledgeBase.slice();

      return state.cachedKnowledge;
    }

    return [];
  }

  function loadKnowledgeBase() {
    const existingKnowledge =
      readGlobalKnowledgeBase();

    if (
      existingKnowledge.length
    ) {
      return Promise.resolve(
        existingKnowledge
      );
    }

    if (
      state.knowledgeLoadPromise
    ) {
      return state.knowledgeLoadPromise;
    }

    state.knowledgeLoadPromise =
      new Promise(
        function (
          resolve
        ) {
          const existingScript =
            document.querySelector(
              'script[data-gfloor-knowledge-recovery-loader="true"]'
            );

          if (
            existingScript
          ) {
            const existingKnowledgeAfterScript =
              readGlobalKnowledgeBase();

            if (
              existingKnowledgeAfterScript.length
            ) {
              resolve(
                existingKnowledgeAfterScript
              );

              return;
            }

            existingScript.remove();
          }

          const script =
            document.createElement(
              "script"
            );

          script.src =
            KNOWLEDGE_BASE_URL;

          script.async =
            true;

          script.dataset.gfloorKnowledgeRecoveryLoader =
            "true";

          script.onload =
            function () {
              const loadedKnowledge =
                readGlobalKnowledgeBase();

              console.log(
                "G-Floor knowledge recovery database loaded:",
                {
                  version:
                    VERSION,

                  count:
                    loadedKnowledge.length
                }
              );

              resolve(
                loadedKnowledge
              );
            };

          script.onerror =
            function (
              error
            ) {
              console.error(
                "G-Floor knowledge recovery database failed to load:",
                error
              );

              resolve(
                []
              );
            };

          document.head.appendChild(
            script
          );
        }
      )
        .finally(
          function () {
            state.knowledgeLoadPromise =
              null;
          }
        );

    return state.knowledgeLoadPromise;
  }

  /*
  |--------------------------------------------------------------------------
  | Cleaning Entry
  |--------------------------------------------------------------------------
  */

  function getCleaningEntry(
    knowledge
  ) {
    const entries =
      Array.isArray(
        knowledge
      )
        ? knowledge
        : [];

    const exactEntry =
      entries.find(
        function (
          item
        ) {
          return (
            item &&
            item.id ===
              CLEANING_ENTRY_ID
          );
        }
      );

    if (
      exactEntry
    ) {
      return exactEntry;
    }

    return entries.find(
      function (
        item
      ) {
        if (
          !item
        ) {
          return false;
        }

        const question =
          normalizeText(
            item.question ||
            item.title ||
            ""
          );

        return (
          question ===
            "how to clean gfloor" ||
          question ===
            "how do i clean gfloor"
        );
      }
    ) || null;
  }

  function getApprovedCleaningAnswer(
    entry
  ) {
    const approvedAnswer =
      entry &&
      String(
        entry.answer || ""
      ).trim();

    if (
      approvedAnswer
    ) {
      return approvedAnswer;
    }

    return (
      "Sweep or vacuum loose dirt, then mop or rinse G-Floor® " +
      "with cool water and a mild detergent. A soft or deck brush " +
      "can be used on textured surfaces. Rinse away cleaner residue " +
      "and let the floor dry before use. Avoid harsh solvents and " +
      "undiluted bleach."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Element Helpers
  |--------------------------------------------------------------------------
  */

  function getElements() {
    return {
      questionInput:
        document.getElementById(
          "gfloor-chat-question"
        ),

      questionButton:
        document.getElementById(
          "gfloor-question-submit"
        ),

      responseBox:
        document.getElementById(
          "gfloor-response-box"
        ),

      helpfulActions:
        document.getElementById(
          "gfloor-helpful-actions"
        )
    };
  }

  function hideProcessingState() {
    const processingElements =
      document.querySelectorAll(
        [
          ".gfloor-mascot-processing",
          ".gfloor-chat-processing",
          "[data-gfloor-processing]",
          "#gfloor-mascot-processing"
        ].join(",")
      );

    processingElements.forEach(
      function (
        element
      ) {
        element.classList.remove(
          "show"
        );

        element.hidden =
          true;

        element.setAttribute(
          "aria-hidden",
          "true"
        );

        element.style.display =
          "none";
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Duplicate Protection
  |--------------------------------------------------------------------------
  */

  function isDuplicateSubmission(
    signature
  ) {
    const now =
      Date.now();

    const isSameQuestion =
      state.lastQuestionSignature ===
      signature;

    const isWithinWindow =
      (
        now -
        state.lastSubmissionTime
      ) <
      DUPLICATE_SUBMISSION_WINDOW_MS;

    if (
      state.processing
    ) {
      return true;
    }

    if (
      isSameQuestion &&
      isWithinWindow
    ) {
      return true;
    }

    state.lastQuestionSignature =
      signature;

    state.lastSubmissionTime =
      now;

    return false;
  }

  /*
  |--------------------------------------------------------------------------
  | Analytics
  |--------------------------------------------------------------------------
  */

  function pushAnalytics(
    question,
    entry
  ) {
    const entryId =
      entry &&
      entry.id
        ? entry.id
        : CLEANING_ENTRY_ID;

    const analyticsSignature =
      createSignature(
        question,
        entryId
      );

    if (
      state.lastAnalyticsSignature ===
      analyticsSignature
    ) {
      console.log(
        "Duplicate G-Floor recovery analytics prevented:",
        analyticsSignature
      );

      return;
    }

    state.lastAnalyticsSignature =
      analyticsSignature;

    window.dataLayer =
      window.dataLayer || [];

    window.dataLayer.push({
      event:
        "gfloor_chat_question_result",

      chat_source:
        "gfloor_custom_chat",

      response_mode:
        "knowledge_recovery",

      response_category:
        "Cleaning & Maintenance",

      answer_status:
        "answered",

      escalation_status:
        "not_escalated",

      knowledge_entry_id:
        entryId,

      recovery_version:
        VERSION
    });

    window.dataLayer.push({
      event:
        "gfloor_chat_knowledge_recovery",

      chat_source:
        "gfloor_custom_chat",

      recovery_version:
        VERSION,

      recovery_type:
        "approved_cleaning_answer",

      knowledge_entry_id:
        entryId
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Render Approved Cleaning Answer
  |--------------------------------------------------------------------------
  */

  function renderCleaningAnswer(
    question,
    entry
  ) {
    const elements =
      getElements();

    if (
      !elements.responseBox
    ) {
      return;
    }

    const entryId =
      entry &&
      entry.id
        ? entry.id
        : CLEANING_ENTRY_ID;

    const renderSignature =
      createSignature(
        question,
        entryId
      );

    if (
      state.lastRenderedSignature ===
      renderSignature
    ) {
      hideProcessingState();

      console.log(
        "Duplicate G-Floor recovery rendering prevented:",
        renderSignature
      );

      return;
    }

    state.lastRenderedSignature =
      renderSignature;

    const answer =
      getApprovedCleaningAnswer(
        entry
      );

    const sourceUrl =
      entry &&
      String(
        entry.sourceUrl ||
        entry.source_url ||
        ""
      ).trim();

    const sourceLink =
      sourceUrl
        ? (
            '<a class="gfloor-response-link" ' +
            'href="' +
            escapeHtml(
              sourceUrl
            ) +
            '" target="_blank" rel="noopener noreferrer">' +
            "Learn More" +
            "</a>"
          )
        : "";

    elements.responseBox.dataset.mode =
      "knowledge_recovery";

    elements.responseBox.dataset.category =
      "Cleaning & Maintenance";

    elements.responseBox.dataset.knowledgeEntryId =
      entryId;

    elements.responseBox.innerHTML =
      [
        '<div class="gfloor-response-title">',
        "G-Floor Support",
        "</div>",

        '<div class="gfloor-response-category">',
        "Cleaning &amp; Maintenance",
        "</div>",

        '<div class="gfloor-response-answer">',
        escapeHtml(
          answer
        ),
        "</div>",

        sourceLink,

        '<div class="gfloor-response-helpful-question">',
        "Did this answer your question?",
        "</div>"
      ].join("");

    elements.responseBox.classList.add(
      "show"
    );

    elements.responseBox.hidden =
      false;

    elements.responseBox.setAttribute(
      "aria-hidden",
      "false"
    );

    if (
      elements.helpfulActions
    ) {
      elements.helpfulActions.dataset.mode =
        "knowledge_recovery";

      elements.helpfulActions.classList.add(
        "show"
      );

      elements.helpfulActions.hidden =
        false;

      elements.helpfulActions.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    hideProcessingState();

    pushAnalytics(
      question,
      entry
    );

    try {
      elements.responseBox.scrollIntoView({
        behavior:
          "smooth",

        block:
          "nearest"
      });
    } catch (
      error
    ) {
      elements.responseBox.scrollIntoView();
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Handle Cleaning Submission
  |--------------------------------------------------------------------------
  */

  async function handleCleaningQuestion(
    event
  ) {
    const elements =
      getElements();

    if (
      !elements.questionInput ||
      !elements.questionButton
    ) {
      return;
    }

    const question =
      String(
        elements.questionInput.value ||
        ""
      ).trim();

    if (
      !isApprovedCleaningQuestion(
        question
      )
    ) {
      return;
    }

    const submissionSignature =
      createSignature(
        question,
        CLEANING_ENTRY_ID
      );

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (
      isDuplicateSubmission(
        submissionSignature
      )
    ) {
      console.log(
        "Duplicate G-Floor recovery submission prevented:",
        submissionSignature
      );

      return;
    }

    state.processing =
      true;

    elements.questionButton.disabled =
      true;

    elements.questionButton.setAttribute(
      "aria-busy",
      "true"
    );

    try {
      const knowledge =
        await loadKnowledgeBase();

      const cleaningEntry =
        getCleaningEntry(
          knowledge
        );

      renderCleaningAnswer(
        question,
        cleaningEntry
      );
    } catch (
      error
    ) {
      console.error(
        "G-Floor approved cleaning recovery failed:",
        error
      );

      renderCleaningAnswer(
        question,
        null
      );
    } finally {
      state.processing =
        false;

      elements.questionButton.disabled =
        false;

      elements.questionButton.removeAttribute(
        "aria-busy"
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Enter-Key Submission
  |--------------------------------------------------------------------------
  */

  function handleQuestionKeydown(
    event
  ) {
    if (
      event.key !==
        "Enter" ||
      event.shiftKey
    ) {
      return;
    }

    const elements =
      getElements();

    if (
      !elements.questionInput ||
      !elements.questionButton ||
      event.target !==
        elements.questionInput
    ) {
      return;
    }

    if (
      !isApprovedCleaningQuestion(
        elements.questionInput.value
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    /*
    |--------------------------------------------------------------------------
    | Dispatch One Controlled Click
    |--------------------------------------------------------------------------
    */

    elements.questionButton.click();
  }

  /*
  |--------------------------------------------------------------------------
  | Reset Duplicate State When Question Changes
  |--------------------------------------------------------------------------
  */

  function handleQuestionInput() {
    const elements =
      getElements();

    if (
      !elements.questionInput
    ) {
      return;
    }

    const currentQuestion =
      normalizeText(
        elements.questionInput.value
      );

    const previousQuestion =
      String(
        state.lastQuestionSignature ||
        ""
      ).split(
        "::"
      )[0];

    if (
      currentQuestion !==
      previousQuestion
    ) {
      state.lastRenderedSignature =
        "";

      state.lastAnalyticsSignature =
        "";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  function initialize() {
    if (
      state.initialized &&
      state.listenersAttached
    ) {
      return true;
    }

    const elements =
      getElements();

    if (
      !elements.questionInput ||
      !elements.questionButton ||
      !elements.responseBox
    ) {
      return false;
    }

    if (
      elements.questionButton.dataset
        .gfloorKnowledgeRecoveryAttached ===
      "true"
    ) {
      state.initialized =
        true;

      state.listenersAttached =
        true;

      return true;
    }

    elements.questionButton.dataset
      .gfloorKnowledgeRecoveryAttached =
      "true";

    elements.questionInput.dataset
      .gfloorKnowledgeRecoveryAttached =
      "true";

    /*
    |--------------------------------------------------------------------------
    | Capture-Phase Listeners
    |--------------------------------------------------------------------------
    |
    | Capture phase allows this approved recovery handler to stop widget.js
    | before widget.js produces a zero-confidence fallback.
    |
    |--------------------------------------------------------------------------
    */

    elements.questionButton.addEventListener(
      "click",
      handleCleaningQuestion,
      true
    );

    elements.questionInput.addEventListener(
      "keydown",
      handleQuestionKeydown,
      true
    );

    elements.questionInput.addEventListener(
      "input",
      handleQuestionInput,
      true
    );

    state.initialized =
      true;

    state.listenersAttached =
      true;

    loadKnowledgeBase();

    console.log(
      "G-Floor chat knowledge recovery initialized:",
      {
        version:
          VERSION,

        duplicateProtection:
          true
      }
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization Retry
  |--------------------------------------------------------------------------
  */

  function beginInitialization() {
    if (
      initialize()
    ) {
      return;
    }

    const initializationTimer =
      window.setInterval(
        function () {
          state.initializationAttempts +=
            1;

          const initializedNow =
            initialize();

          if (
            initializedNow ||
            state.initializationAttempts >=
              MAX_INITIALIZATION_ATTEMPTS
          ) {
            window.clearInterval(
              initializationTimer
            );
          }
        },
        INITIALIZATION_INTERVAL_MS
      );
  }

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      beginInitialization,
      {
        once:
          true
      }
    );
  } else {
    beginInitialization();
  }
})();