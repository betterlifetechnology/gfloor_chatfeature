(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Knowledge Recovery
  |--------------------------------------------------------------------------
  |
  | Version: 20.15
  |
  | Purpose:
  |
  | - Loads the approved static knowledge base independently of widget.js
  | - Provides a reliable fallback when widget.js fails to populate its
  |   private knowledgeBase array
  | - Handles approved cleaning questions before widget.js returns a
  |   zero-confidence escalation
  | - Does not interfere with Shopify product questions, small talk,
  |   unrelated questions, or Customer Service handoff
  |
  |--------------------------------------------------------------------------
  */

  const VERSION =
    "20.15";

  const KNOWLEDGE_BASE_URL =
    "https://gfloor-chatfeature.onrender.com/knowledge-base.js?v=" +
    VERSION;

  const CLEANING_ENTRY_ID =
    "kb-010-how-to-clean-g-floor";

  const MAX_INITIALIZATION_ATTEMPTS =
    60;

  const INITIALIZATION_INTERVAL_MS =
    250;

  let initialized =
    false;

  let knowledgeLoadPromise =
    null;

  let cachedKnowledge =
    [];

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

  /*
  |--------------------------------------------------------------------------
  | Approved Cleaning Intent
  |--------------------------------------------------------------------------
  |
  | This is intentionally narrow so product price, SKU, availability,
  | installation, small talk, and unrelated questions continue through
  | the normal widget logic.
  |
  |--------------------------------------------------------------------------
  */

  function isApprovedCleaningQuestion(question) {
    const normalized =
      normalizeText(question);

    const exactCleaningQuestions =
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
      exactCleaningQuestions.has(
        normalized
      )
    ) {
      return true;
    }

    const hasCleaningAction =
      /\b(clean|cleaning|wash|washing|mop|mopping|rinse|scrub)\b/.test(
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
      cachedKnowledge =
        window.GFloorKnowledgeBase.slice();

      return cachedKnowledge;
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
      knowledgeLoadPromise
    ) {
      return knowledgeLoadPromise;
    }

    knowledgeLoadPromise =
      new Promise(
        function (
          resolve
        ) {
          const existingScript =
            document.querySelector(
              'script[data-gfloor-knowledge-recovery="true"]'
            );

          if (
            existingScript
          ) {
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

          script.dataset.gfloorKnowledgeRecovery =
            "true";

          script.onload =
            function () {
              const loadedKnowledge =
                readGlobalKnowledgeBase();

              console.log(
                "G-Floor knowledge recovery loaded:",
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
                "G-Floor knowledge recovery could not load the knowledge base:",
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
            knowledgeLoadPromise =
              null;
          }
        );

    return knowledgeLoadPromise;
  }

  /*
  |--------------------------------------------------------------------------
  | Approved Cleaning Entry
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

    const byId =
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
      byId
    ) {
      return byId;
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
  | Chat Elements
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
  | Analytics
  |--------------------------------------------------------------------------
  */

  function pushAnalytics(
    entry
  ) {
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
        entry &&
        entry.id
          ? entry.id
          : CLEANING_ENTRY_ID
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
        entry &&
        entry.id
          ? entry.id
          : CLEANING_ENTRY_ID
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Render Approved Answer
  |--------------------------------------------------------------------------
  */

  function renderCleaningAnswer(
    entry
  ) {
    const elements =
      getElements();

    if (
      !elements.responseBox
    ) {
      return;
    }

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
      entry &&
      entry.id
        ? entry.id
        : CLEANING_ENTRY_ID;

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
      entry
    );

    elements.responseBox.scrollIntoView({
      behavior:
        "smooth",

      block:
        "nearest"
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Question Submission
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
      elements.questionInput.value;

    if (
      !isApprovedCleaningQuestion(
        question
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

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
        null
      );
    } finally {
      elements.questionButton.disabled =
        false;

      elements.questionButton.removeAttribute(
        "aria-busy"
      );
    }
  }

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

    elements.questionButton.click();
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  function initialize() {
    if (
      initialized
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

    /*
    |--------------------------------------------------------------------------
    | Capture Phase
    |--------------------------------------------------------------------------
    |
    | The recovery handler must run before widget.js receives the click.
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

    initialized =
      true;

    loadKnowledgeBase();

    console.log(
      "G-Floor chat knowledge recovery loaded:",
      VERSION
    );

    return true;
  }

  let attempts =
    0;

  const initializationTimer =
    window.setInterval(
      function () {
        attempts +=
          1;

        if (
          initialize() ||
          attempts >=
            MAX_INITIALIZATION_ATTEMPTS
        ) {
          window.clearInterval(
            initializationTimer
          );
        }
      },
      INITIALIZATION_INTERVAL_MS
    );

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once:
          true
      }
    );
  } else {
    initialize();
  }
})();