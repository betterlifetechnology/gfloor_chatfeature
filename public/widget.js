(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | API Configuration
  |--------------------------------------------------------------------------
  */

  const API_BASE_URL =
    "https://gfloor-chatfeature.onrender.com";

  const MESSAGE_API_URL =
    API_BASE_URL + "/chat/message";

  const STATUS_API_URL =
    API_BASE_URL + "/chat/status";

  const KNOWLEDGE_BASE_URL =
    API_BASE_URL + "/knowledge-base.js";

  /*
  |--------------------------------------------------------------------------
  | Knowledge Base Matching Configuration
  |--------------------------------------------------------------------------
  */

  const MATCH_CONFIG = {
    strongMatchScore: 0.72,
    minimumMatchScore: 0.43,
    intentMatchBonus: 0.32,
    intentMismatchPenalty: 0.24,
    exactPhraseBonus: 0.3,
    importantWordBonus: 0.08
  };

  const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "can",
    "could",
    "do",
    "does",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "the",
    "this",
    "to",
    "use",
    "what",
    "where",
    "which",
    "with",
    "would",
    "you",
    "your"
  ]);

  const GENERIC_WORDS = new Set([
    "floor",
    "floors",
    "flooring",
    "gfloor",
    "g",
    "product",
    "products",
    "vinyl"
  ]);

  let knowledgeBase = [];
  let knowledgeBaseLoaded = false;
  let knowledgeBaseLoading = false;
  let knowledgeBaseLoadPromise = null;

  /*
  |--------------------------------------------------------------------------
  | Styles
  |--------------------------------------------------------------------------
  */

  const style =
    document.createElement("style");

  style.textContent = `
    #gfloor-chat-button {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999998;
      border: 0;
      border-radius: 999px;
      background: #d2232a;
      color: #ffffff;
      padding: 14px 20px;
      font: 700 16px Arial, sans-serif;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(0,0,0,.25);
    }

    #gfloor-chat-button:hover,
    #gfloor-chat-button:focus {
      background: #b91f25;
      outline: none;
    }

    #gfloor-chat-panel {
      position: fixed;
      right: 24px;
      bottom: 84px;
      z-index: 999999;
      display: none;
      width: min(390px, calc(100vw - 32px));
      max-height: calc(100vh - 110px);
      box-sizing: border-box;
      border-radius: 12px;
      background: #ffffff;
      color: #222222;
      box-shadow: 0 8px 30px rgba(0,0,0,.28);
      font-family: Arial, sans-serif;
      overflow: hidden;
    }

    #gfloor-chat-panel.open {
      display: flex;
      flex-direction: column;
    }

    .gfloor-chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex: 0 0 auto;
      padding: 16px;
      background: #333e48;
      color: #ffffff;
    }

    .gfloor-chat-header strong {
      font-size: 18px;
    }

    #gfloor-chat-close {
      border: 0;
      background: transparent;
      color: #ffffff;
      font-size: 26px;
      line-height: 1;
      cursor: pointer;
    }

    #gfloor-chat-close:hover,
    #gfloor-chat-close:focus {
      opacity: .8;
      outline: none;
    }

    .gfloor-chat-body {
      padding: 16px;
      overflow-y: auto;
      scroll-behavior: smooth;
    }

    .gfloor-chat-intro {
      margin: 0 0 14px;
      font-size: 15px;
      line-height: 1.5;
    }

    .gfloor-topic-list {
      display: grid;
      gap: 8px;
      margin-bottom: 16px;
    }

    .gfloor-topic-button,
    .gfloor-secondary-button,
    .gfloor-primary-button {
      width: 100%;
      box-sizing: border-box;
      border-radius: 6px;
      padding: 11px 12px;
      font: 700 14px Arial, sans-serif;
      cursor: pointer;
    }

    .gfloor-topic-button {
      border: 1px solid #c9c9c9;
      background: #ffffff;
      color: #222222;
      text-align: center;
    }

    .gfloor-topic-button:hover,
    .gfloor-topic-button:focus {
      border-color: #d2232a;
      background: #fff7f7;
      outline: none;
    }

    .gfloor-primary-button {
      border: 0;
      background: #d2232a;
      color: #ffffff;
      text-align: center;
    }

    .gfloor-primary-button:hover,
    .gfloor-primary-button:focus {
      background: #b91f25;
      outline: none;
    }

    .gfloor-primary-button:disabled {
      opacity: .65;
      cursor: wait;
    }

    .gfloor-secondary-button {
      border: 1px solid #333e48;
      background: #ffffff;
      color: #333e48;
      text-align: center;
    }

    .gfloor-secondary-button:hover,
    .gfloor-secondary-button:focus {
      border-color: #d2232a;
      color: #d2232a;
      outline: none;
    }

    .gfloor-question-row {
      margin-top: 16px;
    }

    .gfloor-question-row label,
    .gfloor-chat-field label {
      display: block;
      margin-bottom: 5px;
      font-size: 13px;
      font-weight: 700;
    }

    .gfloor-question-row textarea,
    .gfloor-chat-field input,
    .gfloor-chat-field textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #b7b7b7;
      border-radius: 6px;
      padding: 10px;
      color: #222222;
      background: #ffffff;
      font: 14px Arial, sans-serif;
    }

    .gfloor-question-row textarea:focus,
    .gfloor-chat-field input:focus,
    .gfloor-chat-field textarea:focus {
      border-color: #d2232a;
      outline: 2px solid rgba(210,35,42,.12);
      outline-offset: 1px;
    }

    .gfloor-question-row textarea,
    .gfloor-chat-field textarea {
      min-height: 92px;
      resize: vertical;
    }

    .gfloor-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 16px 0;
      color: #777777;
      font-size: 12px;
      text-transform: uppercase;
    }

    .gfloor-divider::before,
    .gfloor-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #dddddd;
    }

    .gfloor-response-box {
      display: none;
      margin-top: 14px;
      padding: 12px;
      border-radius: 8px;
      background: #f4f5f6;
      font-size: 14px;
      line-height: 1.5;
    }

    .gfloor-response-box.show {
      display: block;
    }

    .gfloor-response-title {
      display: block;
      margin-bottom: 6px;
      font-weight: 700;
      font-size: 15px;
    }

    .gfloor-response-category {
      display: inline-block;
      margin-bottom: 8px;
      padding: 3px 7px;
      border-radius: 999px;
      background: #e7e9eb;
      color: #4c5156;
      font-size: 11px;
      font-weight: 700;
    }

    .gfloor-response-answer {
      margin-top: 2px;
    }

    .gfloor-response-source {
      margin-top: 12px;
    }

    .gfloor-response-source a {
      color: #b91f25;
      font-weight: 700;
      text-decoration: underline;
    }

    .gfloor-response-source a:hover,
    .gfloor-response-source a:focus {
      color: #8f171c;
    }

    .gfloor-escalation-note {
      margin-top: 12px;
      padding: 10px;
      border-left: 4px solid #d2232a;
      background: #fff7f7;
      font-size: 13px;
      line-height: 1.45;
    }

    .gfloor-match-note {
      margin-top: 10px;
      color: #666666;
      font-size: 12px;
      line-height: 1.4;
    }

    .gfloor-helpful-question {
      margin-top: 12px;
      font-weight: 700;
    }

    .gfloor-helpful-actions {
      display: none;
      gap: 8px;
      margin-top: 12px;
    }

    .gfloor-helpful-actions.show {
      display: flex;
    }

    .gfloor-small-button {
      flex: 1;
      border: 1px solid #b7b7b7;
      border-radius: 6px;
      padding: 9px 10px;
      background: #ffffff;
      color: #222222;
      font: 700 13px Arial, sans-serif;
      cursor: pointer;
    }

    .gfloor-small-button:hover,
    .gfloor-small-button:focus {
      border-color: #d2232a;
      color: #d2232a;
      outline: none;
    }

    .gfloor-back {
      margin-bottom: 12px;
      border: 0;
      background: transparent;
      color: #333e48;
      font: 700 13px Arial, sans-serif;
      cursor: pointer;
      padding: 0;
    }

    .gfloor-back:hover,
    .gfloor-back:focus {
      color: #d2232a;
      outline: none;
    }

    .gfloor-chat-field {
      margin-bottom: 12px;
    }

    .gfloor-status-box {
      padding: 12px;
      margin-bottom: 14px;
      border-radius: 6px;
      background: #f2f3f4;
      font-size: 13px;
      line-height: 1.5;
    }

    .gfloor-status-box.loading {
      color: #666666;
    }

    .gfloor-status-box.available {
      border-left: 4px solid #16733c;
    }

    .gfloor-status-box.offline {
      border-left: 4px solid #d2232a;
    }

    .gfloor-human-title {
      margin: 0 0 10px;
      color: #222222;
      font-size: 18px;
      line-height: 1.35;
    }

    .gfloor-human-actions {
      display: grid;
      gap: 9px;
      margin-top: 16px;
    }

    .gfloor-wait-time {
      margin-top: 8px;
      font-weight: 700;
    }

    .gfloor-form-note {
      margin: 0 0 14px;
      font-size: 14px;
      line-height: 1.5;
    }

    .gfloor-kb-status {
      margin-top: 8px;
      color: #777777;
      font-size: 11px;
      line-height: 1.4;
      text-align: center;
    }

    #gfloor-chat-result {
      margin-top: 12px;
      font-size: 14px;
      line-height: 1.4;
    }

    @media (max-width: 480px) {
      #gfloor-chat-button {
        right: 16px;
        bottom: 16px;
      }

      #gfloor-chat-panel {
        right: 16px;
        bottom: 76px;
        width: calc(100vw - 32px);
      }
    }
  `;

  document.head.appendChild(style);

  /*
  |--------------------------------------------------------------------------
  | Chat HTML
  |--------------------------------------------------------------------------
  */

  const panel =
    document.createElement("section");

  panel.id =
    "gfloor-chat-panel";

  panel.setAttribute(
    "aria-label",
    "G-Floor customer support chat"
  );

  panel.innerHTML = `
    <div class="gfloor-chat-header">
      <strong>Chat with G-Floor</strong>

      <button
        id="gfloor-chat-close"
        type="button"
        aria-label="Close chat"
      >
        &times;
      </button>
    </div>

    <div class="gfloor-chat-body">

      <div id="gfloor-chat-home">

        <p class="gfloor-chat-intro">
          Hi! How can we help you today?
        </p>

        <div class="gfloor-topic-list">

          <button
            class="gfloor-topic-button"
            type="button"
            data-topic="flooring"
          >
            Find the Right Flooring
          </button>

          <button
            class="gfloor-topic-button"
            type="button"
            data-topic="installation"
          >
            Installation Questions
          </button>

          <button
            class="gfloor-topic-button"
            type="button"
            data-topic="shipping"
          >
            Shipping & Delivery
          </button>

          <button
            class="gfloor-topic-button"
            type="button"
            data-topic="order"
          >
            Order Help
          </button>

          <button
            class="gfloor-topic-button"
            type="button"
            data-topic="cleaning"
          >
            Cleaning & Maintenance
          </button>

          <button
            class="gfloor-topic-button"
            type="button"
            data-topic="warranty"
          >
            Warranty & Returns
          </button>

          <button
            class="gfloor-topic-button"
            type="button"
            data-topic="other"
          >
            Something Else
          </button>

        </div>

        <div class="gfloor-question-row">

          <label for="gfloor-chat-question">
            Or type your question
          </label>

          <textarea
            id="gfloor-chat-question"
            placeholder="Type your question here..."
          ></textarea>

        </div>

        <button
          id="gfloor-question-submit"
          class="gfloor-primary-button"
          type="button"
          style="margin-top:10px;"
        >
          Ask a Question
        </button>

        <div
          id="gfloor-response-box"
          class="gfloor-response-box"
          role="status"
          aria-live="polite"
        ></div>

        <div
          id="gfloor-helpful-actions"
          class="gfloor-helpful-actions"
        >

          <button
            id="gfloor-helpful-yes"
            class="gfloor-small-button"
            type="button"
          >
            Yes
          </button>

          <button
            id="gfloor-helpful-no"
            class="gfloor-small-button"
            type="button"
          >
            No
          </button>

        </div>

        <div class="gfloor-divider">
          or
        </div>

        <button
          id="gfloor-human-button"
          class="gfloor-secondary-button"
          type="button"
        >
          Talk to a Customer Service Representative
        </button>

        <div
          id="gfloor-kb-status"
          class="gfloor-kb-status"
          aria-live="polite"
        ></div>

      </div>

      <div
        id="gfloor-human-view"
        hidden
      >

        <button
          id="gfloor-human-back-button"
          class="gfloor-back"
          type="button"
        >
          &larr; Back
        </button>

        <h2 class="gfloor-human-title">
          Connect with Customer Service
        </h2>

        <div
          id="gfloor-human-status"
          class="gfloor-status-box loading"
          role="status"
          aria-live="polite"
        >
          Checking Customer Service availability...
        </div>

        <div
          id="gfloor-human-actions"
          class="gfloor-human-actions"
          hidden
        >

          <button
            id="gfloor-connect-button"
            class="gfloor-primary-button"
            type="button"
          >
            Yes, connect me
          </button>

          <button
            id="gfloor-stay-chat-button"
            class="gfloor-secondary-button"
            type="button"
          >
            No, keep using chat
          </button>

        </div>

      </div>

      <div
        id="gfloor-contact-view"
        hidden
      >

        <button
          id="gfloor-contact-back-button"
          class="gfloor-back"
          type="button"
        >
          &larr; Back
        </button>

        <p class="gfloor-form-note">
          Please provide your contact information so our Customer Service team can help.
        </p>

        <div
          id="gfloor-agent-status"
          class="gfloor-status-box"
          role="status"
          aria-live="polite"
        ></div>

        <form id="gfloor-chat-form">

          <div class="gfloor-chat-field">
            <label for="gfloor-chat-name">
              Name
            </label>

            <input
              id="gfloor-chat-name"
              name="name"
              type="text"
              autocomplete="name"
              required
            >
          </div>

          <div class="gfloor-chat-field">
            <label for="gfloor-chat-email">
              Email
            </label>

            <input
              id="gfloor-chat-email"
              name="email"
              type="email"
              autocomplete="email"
              required
            >
          </div>

          <div class="gfloor-chat-field">
            <label for="gfloor-chat-phone">
              Phone
            </label>

            <input
              id="gfloor-chat-phone"
              name="phone"
              type="tel"
              autocomplete="tel"
              required
            >
          </div>

          <div class="gfloor-chat-field">
            <label for="gfloor-chat-message">
              How can we help?
            </label>

            <textarea
              id="gfloor-chat-message"
              name="message"
              required
            ></textarea>
          </div>

          <button
            id="gfloor-chat-submit"
            class="gfloor-primary-button"
            type="submit"
          >
            Send Message
          </button>

          <div
            id="gfloor-chat-result"
            role="status"
            aria-live="polite"
          ></div>

        </form>

      </div>

    </div>
  `;

  /*
  |--------------------------------------------------------------------------
  | Launcher
  |--------------------------------------------------------------------------
  */

  const button =
    document.createElement("button");

  button.id =
    "gfloor-chat-button";

  button.type =
    "button";

  button.textContent =
    "Chat with us";

  button.setAttribute(
    "aria-expanded",
    "false"
  );

  button.setAttribute(
    "aria-controls",
    "gfloor-chat-panel"
  );

  document.body.appendChild(panel);
  document.body.appendChild(button);

  /*
  |--------------------------------------------------------------------------
  | Element References
  |--------------------------------------------------------------------------
  */

  const chatBody =
    panel.querySelector(
      ".gfloor-chat-body"
    );

  const closeButton =
    panel.querySelector(
      "#gfloor-chat-close"
    );

  const homeView =
    panel.querySelector(
      "#gfloor-chat-home"
    );

  const humanView =
    panel.querySelector(
      "#gfloor-human-view"
    );

  const contactView =
    panel.querySelector(
      "#gfloor-contact-view"
    );

  const topicButtons =
    panel.querySelectorAll(
      ".gfloor-topic-button"
    );

  const questionInput =
    panel.querySelector(
      "#gfloor-chat-question"
    );

  const questionSubmit =
    panel.querySelector(
      "#gfloor-question-submit"
    );

  const responseBox =
    panel.querySelector(
      "#gfloor-response-box"
    );

  const helpfulActions =
    panel.querySelector(
      "#gfloor-helpful-actions"
    );

  const helpfulYes =
    panel.querySelector(
      "#gfloor-helpful-yes"
    );

  const helpfulNo =
    panel.querySelector(
      "#gfloor-helpful-no"
    );

  const humanButton =
    panel.querySelector(
      "#gfloor-human-button"
    );

  const humanBackButton =
    panel.querySelector(
      "#gfloor-human-back-button"
    );

  const humanStatus =
    panel.querySelector(
      "#gfloor-human-status"
    );

  const humanActions =
    panel.querySelector(
      "#gfloor-human-actions"
    );

  const connectButton =
    panel.querySelector(
      "#gfloor-connect-button"
    );

  const stayChatButton =
    panel.querySelector(
      "#gfloor-stay-chat-button"
    );

  const contactBackButton =
    panel.querySelector(
      "#gfloor-contact-back-button"
    );

  const agentStatus =
    panel.querySelector(
      "#gfloor-agent-status"
    );

  const form =
    panel.querySelector(
      "#gfloor-chat-form"
    );

  const messageField =
    panel.querySelector(
      "#gfloor-chat-message"
    );

  const submitButton =
    panel.querySelector(
      "#gfloor-chat-submit"
    );

  const result =
    panel.querySelector(
      "#gfloor-chat-result"
    );

  const kbStatus =
    panel.querySelector(
      "#gfloor-kb-status"
    );

  /*
  |--------------------------------------------------------------------------
  | Conversation State
  |--------------------------------------------------------------------------
  */

  let lastQuestion = "";
  let lastMatchedIntent = null;
  let lastMatchScore = 0;

  let currentSupportStatus = {
    liveAgentAvailable: false,
    estimatedWaitMinutes: null,
    businessHours:
      "Monday-Friday, 8 AM-5 PM Central Time",
    queueStatus: "unknown",
    message: ""
  };

  /*
  |--------------------------------------------------------------------------
  | Utility Functions
  |--------------------------------------------------------------------------
  */

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/g-floor/g, "gfloor")
      .replace(/g floor/g, "gfloor")
      .replace(/®/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\\s]/g, " ")
      .replace(/\\s+/g, " ")
      .trim();
  }

  function getWords(value) {
    const normalized =
      normalizeText(value);

    if (!normalized) {
      return [];
    }

    return normalized
      .split(" ")
      .filter(function (word) {
        return (
          word.length > 1 &&
          !STOP_WORDS.has(word)
        );
      });
  }

  function uniqueWords(words) {
    return Array.from(
      new Set(words)
    );
  }

  function hasAnyPhrase(
    text,
    phrases
  ) {
    const normalized =
      normalizeText(text);

    return phrases.some(
      function (phrase) {
        return normalized.includes(
          normalizeText(phrase)
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Specific Intent Phrase Groups
  |--------------------------------------------------------------------------
  */

  const GLUE_REMOVAL_PHRASES = [
    "get glue off",
    "remove glue",
    "removing glue",
    "clean glue",
    "clean off glue",
    "glue residue",
    "adhesive residue",
    "remove adhesive",
    "get adhesive off",
    "adhesive off",
    "glue stain"
  ];

  const GLUE_INSTALLATION_PHRASES = [
    "glue down",
    "glue it down",
    "have to glue",
    "need to glue",
    "need glue",
    "require glue",
    "requires glue",
    "need adhesive",
    "require adhesive",
    "requires adhesive",
    "use adhesive",
    "install with adhesive",
    "fully adhere",
    "floating install",
    "floating installation",
    "loose lay"
  ];

  /*
  |--------------------------------------------------------------------------
  | Intent Detection
  |--------------------------------------------------------------------------
  */

  function detectQuestionIntent(
    question
  ) {
    /*
     * Removal intent MUST be checked before generic "glue".
     */

    if (
      hasAnyPhrase(
        question,
        GLUE_REMOVAL_PHRASES
      )
    ) {
      return "cleaning";
    }

    if (
      hasAnyPhrase(
        question,
        GLUE_INSTALLATION_PHRASES
      )
    ) {
      return "installation";
    }

    const normalized =
      normalizeText(question);

    const intentRules = [
      {
        intent: "cleaning",

        phrases: [
          "clean",
          "cleaning",
          "wash",
          "washing",
          "stain",
          "stains",
          "tar",
          "scrub",
          "cleaner",
          "bleach",
          "chalk",
          "yellowing",
          "remove stain"
        ]
      },

      {
        intent: "installation",

        phrases: [
          "adhesive",
          "install",
          "installation",
          "lay vinyl",
          "lay flooring",
          "seam",
          "seams",
          "seam tape",
          "floating floor",
          "floating flooring",
          "threshold",
          "trim",
          "subfloor",
          "acclimate"
        ]
      },

      {
        intent: "shipping",

        phrases: [
          "shipping",
          "ship",
          "delivery",
          "deliver",
          "freight",
          "tracking",
          "track my",
          "when will it arrive"
        ]
      },

      {
        intent: "ordering",

        phrases: [
          "order",
          "buy",
          "purchase",
          "price",
          "pricing",
          "cost",
          "where can i buy",
          "where to buy",
          "cancel my order"
        ]
      },

      {
        intent: "warranty",

        phrases: [
          "warranty",
          "return",
          "returns",
          "claim",
          "defect",
          "defective",
          "replacement"
        ]
      },

      {
        intent: "pet",

        phrases: [
          "dog",
          "dogs",
          "cat",
          "cats",
          "pet",
          "pets",
          "crate",
          "kennel",
          "litter",
          "food bowl",
          "water bowl"
        ]
      },

      {
        intent: "marine",

        phrases: [
          "boat",
          "boats",
          "pontoon",
          "marine",
          "dock",
          "deck",
          "outdoor",
          "outside"
        ]
      },

      {
        intent: "shed",

        phrases: [
          "shed",
          "sheds"
        ]
      },

      {
        intent: "garage",

        phrases: [
          "garage",
          "garages",
          "epoxy"
        ]
      },

      {
        intent: "sport",

        phrases: [
          "gym",
          "gymnastics",
          "cheer",
          "cheerleading",
          "tumbling",
          "sport",
          "sports",
          "exercise"
        ]
      }
    ];

    for (
      let i = 0;
      i < intentRules.length;
      i += 1
    ) {
      const rule =
        intentRules[i];

      if (
        rule.phrases.some(
          function (phrase) {
            return normalized.includes(
              normalizeText(phrase)
            );
          }
        )
      ) {
        return rule.intent;
      }
    }

    return null;
  }

  function getEntryIntent(entry) {
    const category =
      normalizeText(
        entry.category
      );

    const question =
      normalizeText(
        entry.question
      );

    if (
      category.includes(
        "installation"
      )
    ) {
      return "installation";
    }

    if (
      category.includes(
        "cleaning"
      )
    ) {
      return "cleaning";
    }

    if (
      category.includes(
        "shipping"
      )
    ) {
      return "shipping";
    }

    if (
      category.includes(
        "ordering"
      )
    ) {
      return "ordering";
    }

    if (
      category.includes(
        "warranty"
      ) ||
      question.includes(
        "warranty"
      ) ||
      question.includes(
        "return"
      )
    ) {
      return "warranty";
    }

    if (
      category.includes(
        "pet"
      )
    ) {
      return "pet";
    }

    if (
      category.includes(
        "marine"
      ) ||
      category.includes(
        "outdoor"
      )
    ) {
      return "marine";
    }

    if (
      category.includes(
        "shed"
      )
    ) {
      return "shed";
    }

    if (
      category.includes(
        "garage"
      )
    ) {
      return "garage";
    }

    if (
      category.includes(
        "sport"
      )
    ) {
      return "sport";
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Match Scoring
  |--------------------------------------------------------------------------
  */

  function calculateWeightedTokenScore(
    customerQuestion,
    knowledgePhrase
  ) {
    const questionWords =
      uniqueWords(
        getWords(
          customerQuestion
        )
      );

    const phraseWords =
      uniqueWords(
        getWords(
          knowledgePhrase
        )
      );

    if (
      questionWords.length === 0 ||
      phraseWords.length === 0
    ) {
      return 0;
    }

    let totalQuestionWeight =
      0;

    let totalPhraseWeight =
      0;

    let matchedWeight =
      0;

    const questionWeights =
      {};

    questionWords.forEach(
      function (word) {
        const weight =
          GENERIC_WORDS.has(word)
            ? 0.35
            : 1;

        questionWeights[word] =
          weight;

        totalQuestionWeight +=
          weight;
      }
    );

    phraseWords.forEach(
      function (word) {
        const weight =
          GENERIC_WORDS.has(word)
            ? 0.35
            : 1;

        totalPhraseWeight +=
          weight;

        if (
          Object.prototype.hasOwnProperty.call(
            questionWeights,
            word
          )
        ) {
          matchedWeight +=
            Math.min(
              weight,
              questionWeights[word]
            );
        }
      }
    );

    if (
      matchedWeight === 0
    ) {
      return 0;
    }

    const precision =
      matchedWeight /
      totalQuestionWeight;

    const recall =
      matchedWeight /
      totalPhraseWeight;

    return (
      2 *
      precision *
      recall
    ) /
    (
      precision +
      recall
    );
  }

  function calculatePhraseScore(
    customerQuestion,
    knowledgePhrase
  ) {
    const question =
      normalizeText(
        customerQuestion
      );

    const phrase =
      normalizeText(
        knowledgePhrase
      );

    if (
      !question ||
      !phrase
    ) {
      return 0;
    }

    if (
      question === phrase
    ) {
      return 1;
    }

    if (
      question.includes(
        phrase
      ) ||
      phrase.includes(
        question
      )
    ) {
      const shorterLength =
        Math.min(
          question.length,
          phrase.length
        );

      const longerLength =
        Math.max(
          question.length,
          phrase.length
        );

      return Math.max(
        0.82,
        shorterLength /
          longerLength
      );
    }

    return calculateWeightedTokenScore(
      customerQuestion,
      knowledgePhrase
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Knowledge Base Loader
  |--------------------------------------------------------------------------
  */

  function loadKnowledgeBase() {
    if (
      knowledgeBaseLoaded
    ) {
      return Promise.resolve(
        knowledgeBase
      );
    }

    if (
      knowledgeBaseLoading
    ) {
      return knowledgeBaseLoadPromise;
    }

    knowledgeBaseLoading =
      true;

    kbStatus.textContent =
      "Loading support answers...";

    knowledgeBaseLoadPromise =
      new Promise(
        function (
          resolve,
          reject
        ) {
          if (
            Array.isArray(
              window.GFloorKnowledgeBase
            )
          ) {
            knowledgeBase =
              window.GFloorKnowledgeBase;

            knowledgeBaseLoaded =
              true;

            knowledgeBaseLoading =
              false;

            kbStatus.textContent =
              "";

            resolve(
              knowledgeBase
            );

            return;
          }

          const script =
            document.createElement(
              "script"
            );

          script.src =
            KNOWLEDGE_BASE_URL +
            "?v=" +
            Date.now();

          script.async =
            true;

          script.onload =
            function () {
              if (
                Array.isArray(
                  window.GFloorKnowledgeBase
                )
              ) {
                knowledgeBase =
                  window.GFloorKnowledgeBase;

                knowledgeBaseLoaded =
                  true;

                knowledgeBaseLoading =
                  false;

                kbStatus.textContent =
                  "";

                console.log(
                  "G-Floor knowledge base loaded:",
                  knowledgeBase.length,
                  "intents"
                );

                resolve(
                  knowledgeBase
                );

                return;
              }

              knowledgeBaseLoading =
                false;

              kbStatus.textContent =
                "Support answers are temporarily unavailable.";

              reject(
                new Error(
                  "Knowledge base did not initialize."
                )
              );
            };

          script.onerror =
            function () {
              knowledgeBaseLoading =
                false;

              kbStatus.textContent =
                "Support answers are temporarily unavailable.";

              reject(
                new Error(
                  "Knowledge base could not be loaded."
                )
              );
            };

          document.head.appendChild(
            script
          );
        }
      );

    return knowledgeBaseLoadPromise;
  }

  /*
  |--------------------------------------------------------------------------
  | Knowledge Base Search
  |--------------------------------------------------------------------------
  */

  function searchKnowledgeBase(
    customerQuestion
  ) {
    if (
      !Array.isArray(
        knowledgeBase
      ) ||
      knowledgeBase.length === 0
    ) {
      return null;
    }

    const detectedIntent =
      detectQuestionIntent(
        customerQuestion
      );

    const normalizedQuestion =
      normalizeText(
        customerQuestion
      );

    const isGlueRemovalQuestion =
      hasAnyPhrase(
        customerQuestion,
        GLUE_REMOVAL_PHRASES
      );

    const isGlueInstallationQuestion =
      hasAnyPhrase(
        customerQuestion,
        GLUE_INSTALLATION_PHRASES
      );

    let bestResult =
      null;

    knowledgeBase.forEach(
      function (entry) {
        const phrases = [
          entry.question
        ];

        if (
          Array.isArray(
            entry.variations
          )
        ) {
          phrases.push.apply(
            phrases,
            entry.variations
          );
        }

        let entryBestScore =
          0;

        let bestPhrase =
          "";

        phrases.forEach(
          function (phrase) {
            let score =
              calculatePhraseScore(
                customerQuestion,
                phrase
              );

            const normalizedPhrase =
              normalizeText(
                phrase
              );

            if (
              normalizedQuestion ===
              normalizedPhrase
            ) {
              score +=
                MATCH_CONFIG
                  .exactPhraseBonus;
            }

            if (
              score >
              entryBestScore
            ) {
              entryBestScore =
                score;

              bestPhrase =
                phrase;
            }
          }
        );

        const entryIntent =
          getEntryIntent(
            entry
          );

        /*
         * Standard intent matching.
         */

        if (
          detectedIntent &&
          entryIntent
        ) {
          if (
            detectedIntent ===
            entryIntent
          ) {
            entryBestScore +=
              MATCH_CONFIG
                .intentMatchBonus;
          } else {
            entryBestScore -=
              MATCH_CONFIG
                .intentMismatchPenalty;
          }
        }

        /*
         * Explicit disambiguation:
         *
         * "Do I have to glue G-Floor down?"
         * should strongly favor kb-013.
         */

        if (
          isGlueInstallationQuestion
        ) {
          if (
            entry.id ===
            "kb-013-installation-adhesive-tape-and-seams"
          ) {
            entryBestScore +=
              0.5;
          }

          if (
            entry.id ===
            "kb-019-how-to-remove-stains-or-tar-from-vinyl"
          ) {
            entryBestScore -=
              0.5;
          }
        }

        /*
         * "How do I get glue off G-Floor?"
         * should strongly favor kb-019.
         */

        if (
          isGlueRemovalQuestion
        ) {
          if (
            entry.id ===
            "kb-019-how-to-remove-stains-or-tar-from-vinyl"
          ) {
            entryBestScore +=
              0.55;
          }

          if (
            entry.id ===
            "kb-013-installation-adhesive-tape-and-seams" ||
            entry.id ===
            "kb-039-glue-vinyl-to-wood"
          ) {
            entryBestScore -=
              0.55;
          }
        }

        /*
         * Prevent generic installation "glue"
         * matches from beating explicit removal.
         */

        if (
          isGlueRemovalQuestion &&
          entryIntent ===
          "installation"
        ) {
          entryBestScore -=
            0.35;
        }

        /*
         * Reward relevant cleaning entries.
         */

        if (
          isGlueRemovalQuestion &&
          entryIntent ===
          "cleaning"
        ) {
          entryBestScore +=
            0.25;
        }

        /*
         * Reward relevant installation entries.
         */

        if (
          isGlueInstallationQuestion &&
          entryIntent ===
          "installation"
        ) {
          entryBestScore +=
            0.25;
        }

        /*
         * Important non-generic shared words.
         */

        const customerWords =
          uniqueWords(
            getWords(
              customerQuestion
            )
          );

        const entryWords =
          uniqueWords(
            getWords(
              [
                entry.question,
                ...(Array.isArray(
                  entry.variations
                )
                  ? entry.variations
                  : [])
              ].join(" ")
            )
          );

        const entryWordSet =
          new Set(
            entryWords
          );

        let importantMatches =
          0;

        customerWords.forEach(
          function (word) {
            if (
              !GENERIC_WORDS.has(
                word
              ) &&
              entryWordSet.has(
                word
              )
            ) {
              importantMatches +=
                1;
            }
          }
        );

        entryBestScore +=
          Math.min(
            importantMatches *
              MATCH_CONFIG
                .importantWordBonus,
            0.24
          );

        entryBestScore =
          Math.max(
            0,
            Math.min(
              entryBestScore,
              1
            )
          );

        if (
          !bestResult ||
          entryBestScore >
            bestResult.score
        ) {
          bestResult = {
            entry:
              entry,

            score:
              entryBestScore,

            detectedIntent:
              detectedIntent,

            entryIntent:
              entryIntent,

            bestPhrase:
              bestPhrase
          };
        }
      }
    );

    if (
      !bestResult ||
      bestResult.score <
        MATCH_CONFIG
          .minimumMatchScore
    ) {
      return null;
    }

    return bestResult;
  }

  /*
  |--------------------------------------------------------------------------
  | View Controls
  |--------------------------------------------------------------------------
  */

  function togglePanel(open) {
    panel.classList.toggle(
      "open",
      open
    );

    button.setAttribute(
      "aria-expanded",
      String(open)
    );

    if (open) {
      loadKnowledgeBase()
        .catch(
          function (error) {
            console.error(
              "Knowledge base load error:",
              error
            );
          }
        );
    }
  }

  function hideAllViews() {
    homeView.hidden =
      true;

    humanView.hidden =
      true;

    contactView.hidden =
      true;
  }

  function scrollToTop() {
    setTimeout(
      function () {
        chatBody.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      },
      50
    );
  }

  function showHome() {
    hideAllViews();

    homeView.hidden =
      false;

    scrollToTop();
  }

  /*
  |--------------------------------------------------------------------------
  | Customer Service Availability
  |--------------------------------------------------------------------------
  */

  async function getAgentAvailability() {
    try {
      const response =
        await fetch(
          STATUS_API_URL,
          {
            method:
              "GET",

            headers: {
              Accept:
                "application/json"
            }
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
            "Availability could not be checked."
        );
      }

      currentSupportStatus = {
        liveAgentAvailable:
          data.liveAgentAvailable ===
          true,

        estimatedWaitMinutes:
          data.estimatedWaitMinutes,

        businessHours:
          data.businessHours,

        queueStatus:
          data.queueStatus ||
          "normal",

        message:
          data.message
      };

      return currentSupportStatus;
    } catch (error) {
      console.error(
        "G-Floor availability error:",
        error
      );

      currentSupportStatus = {
        liveAgentAvailable:
          false,

        estimatedWaitMinutes:
          null,

        businessHours:
          "Monday-Friday, 8 AM-5 PM Central Time",

        queueStatus:
          "unavailable",

        message:
          "Customer Service availability could not be checked right now."
      };

      return currentSupportStatus;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Human Confirmation
  |--------------------------------------------------------------------------
  */

  async function showHumanConfirmation() {
    hideAllViews();

    humanView.hidden =
      false;

    humanActions.hidden =
      true;

    humanStatus.className =
      "gfloor-status-box loading";

    humanStatus.textContent =
      "Checking Customer Service availability...";

    connectButton.disabled =
      true;

    scrollToTop();

    const status =
      await getAgentAvailability();

    connectButton.disabled =
      false;

    if (
      status.liveAgentAvailable
    ) {
      humanStatus.className =
        "gfloor-status-box available";

      humanStatus.innerHTML = `
        I can connect you with a G-Floor Customer Service representative.

        <div class="gfloor-wait-time">
          Estimated wait time: approximately
          ${escapeHtml(
            status.estimatedWaitMinutes ||
              "2-5"
          )} minutes.
        </div>
      `;

      connectButton.textContent =
        "Yes, connect me";

      stayChatButton.textContent =
        "No, keep using chat";
    } else {
      humanStatus.className =
        "gfloor-status-box offline";

      humanStatus.innerHTML = `
        Our Customer Service team is currently offline.

        <div style="margin-top:8px;">
          Live support hours are Monday-Friday,
          8 AM-5 PM Central Time.
        </div>

        <div style="margin-top:8px;">
          You can leave a message and our team will follow up.
        </div>
      `;

      connectButton.textContent =
        "Leave a Message";

      stayChatButton.textContent =
        "Keep Using Chat";
    }

    humanActions.hidden =
      false;
  }

  /*
  |--------------------------------------------------------------------------
  | Contact Form
  |--------------------------------------------------------------------------
  */

  function showContactForm() {
    hideAllViews();

    contactView.hidden =
      false;

    if (
      lastQuestion
    ) {
      messageField.value =
        lastQuestion;
    }

    if (
      currentSupportStatus
        .liveAgentAvailable
    ) {
      agentStatus.className =
        "gfloor-status-box available";

      agentStatus.textContent =
        "A Customer Service representative is currently available. Estimated wait time: approximately " +
        (
          currentSupportStatus
            .estimatedWaitMinutes ||
          "2-5"
        ) +
        " minutes.";
    } else {
      agentStatus.className =
        "gfloor-status-box offline";

      agentStatus.textContent =
        "Our Customer Service team is currently offline. Your message will be sent to Customer Service for follow-up.";
    }

    scrollToTop();

    setTimeout(
      function () {
        const firstField =
          panel.querySelector(
            "#gfloor-chat-name"
          );

        if (
          firstField
        ) {
          firstField.focus();
        }
      },
      150
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Topic Prompts
  |--------------------------------------------------------------------------
  */

  function getTopicPrompt(
    topic
  ) {
    const prompts = {
      flooring:
        "What is the best flooring for a garage?",

      installation:
        "Do I have to glue G-Floor down?",

      shipping:
        "What are your shipping and delivery details?",

      order:
        "Where can I buy G-Floor?",

      cleaning:
        "How do I clean G-Floor?",

      warranty:
        "I have a warranty or return question.",

      other:
        ""
    };

    return (
      prompts[topic] ||
      ""
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Response Rendering
  |--------------------------------------------------------------------------
  */

  function scrollToResponse() {
    setTimeout(
      function () {
        responseBox.scrollIntoView({
          behavior:
            "smooth",

          block:
            "nearest"
        });

        setTimeout(
          function () {
            helpfulActions.scrollIntoView({
              behavior:
                "smooth",

              block:
                "nearest"
            });
          },
          150
        );
      },
      100
    );
  }

  function showNoMatchResponse() {
    lastMatchedIntent =
      null;

    lastMatchScore =
      0;

    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      <div class="gfloor-response-answer">
        I couldn't find a confident answer to that question in our approved support information.
      </div>

      <div class="gfloor-escalation-note">
        A Customer Service representative can help with this question.
      </div>

      <div class="gfloor-helpful-question">
        Would you like help from Customer Service?
      </div>
    `;

    responseBox.classList.add(
      "show"
    );

    helpfulYes.textContent =
      "Yes";

    helpfulNo.textContent =
      "No";

    helpfulActions.classList.add(
      "show"
    );

    helpfulActions.dataset.mode =
      "escalation";

    scrollToResponse();
  }

  function showKnowledgeResponse(
    match
  ) {
    const entry =
      match.entry;

    const score =
      match.score;

    lastMatchedIntent =
      entry;

    lastMatchScore =
      score;

    const responseType =
      String(
        entry.responseType ||
        ""
      )
        .trim()
        .toUpperCase();

    const requiresReview =
      responseType ===
        "HUMAN REVIEW" ||
      responseType ===
        "ALWAYS ESCALATE";

    const sourceHtml =
      entry.sourceUrl
        ? `
          <div class="gfloor-response-source">
            <a
              href="${escapeAttribute(
                entry.sourceUrl
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn More
            </a>
          </div>
        `
        : "";

    const escalationHtml =
      requiresReview
        ? `
          <div class="gfloor-escalation-note">
            This question may depend on your specific situation. Customer Service can review the details with you before you make a final decision.
          </div>
        `
        : "";

    const confidenceHtml =
      score <
      MATCH_CONFIG.strongMatchScore
        ? `
          <div class="gfloor-match-note">
            I found a related answer, but your question may need additional review.
          </div>
        `
        : "";

    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      ${
        entry.category
          ? `
            <span class="gfloor-response-category">
              ${escapeHtml(
                entry.category
              )}
            </span>
          `
          : ""
      }

      <div class="gfloor-response-answer">
        ${escapeHtml(
          entry.answer
        )}
      </div>

      ${sourceHtml}

      ${escalationHtml}

      ${confidenceHtml}

      <div class="gfloor-helpful-question">
        Did this answer your question?
      </div>
    `;

    responseBox.classList.add(
      "show"
    );

    helpfulYes.textContent =
      "Yes";

    helpfulNo.textContent =
      "No";

    helpfulActions.dataset.mode =
      "helpful";

    helpfulActions.classList.add(
      "show"
    );

    scrollToResponse();
  }

  /*
  |--------------------------------------------------------------------------
  | Process Question
  |--------------------------------------------------------------------------
  */

  async function processQuestion(
    question
  ) {
    const cleanQuestion =
      String(
        question ||
        ""
      ).trim();

    if (
      !cleanQuestion
    ) {
      responseBox.innerHTML = `
        <span class="gfloor-response-title">
          Please enter a question.
        </span>
      `;

      responseBox.classList.add(
        "show"
      );

      helpfulActions.classList.remove(
        "show"
      );

      questionInput.focus();

      return;
    }

    lastQuestion =
      cleanQuestion;

    questionSubmit.disabled =
      true;

    questionSubmit.textContent =
      "Searching...";

    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      Searching our support information...
    `;

    responseBox.classList.add(
      "show"
    );

    helpfulActions.classList.remove(
      "show"
    );

    try {
      await loadKnowledgeBase();

      const match =
        searchKnowledgeBase(
          cleanQuestion
        );

      console.log(
        "G-Floor KB match:",
        {
          question:
            cleanQuestion,

          matchedQuestion:
            match
              ? match.entry.question
              : null,

          matchedId:
            match
              ? match.entry.id
              : null,

          category:
            match
              ? match.entry.category
              : null,

          score:
            match
              ? match.score
              : null,

          detectedIntent:
            match
              ? match.detectedIntent
              : detectQuestionIntent(
                  cleanQuestion
                ),

          matchedIntent:
            match
              ? match.entryIntent
              : null,

          bestPhrase:
            match
              ? match.bestPhrase
              : null
        }
      );

      if (
        !match
      ) {
        showNoMatchResponse();

        return;
      }

      showKnowledgeResponse(
        match
      );
    } catch (error) {
      console.error(
        "Knowledge search error:",
        error
      );

      showNoMatchResponse();
    } finally {
      questionSubmit.disabled =
        false;

      questionSubmit.textContent =
        "Ask a Question";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Chat Controls
  |--------------------------------------------------------------------------
  */

  button.addEventListener(
    "click",
    function () {
      togglePanel(
        !panel.classList.contains(
          "open"
        )
      );
    }
  );

  closeButton.addEventListener(
    "click",
    function () {
      togglePanel(
        false
      );

      button.focus();
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Topic Buttons
  |--------------------------------------------------------------------------
  */

  topicButtons.forEach(
    function (
      topicButton
    ) {
      topicButton.addEventListener(
        "click",
        async function () {
          const topic =
            topicButton.dataset
              .topic;

          if (
            topic ===
            "other"
          ) {
            questionInput.focus();

            chatBody.scrollTo({
              top:
                questionInput.offsetTop -
                20,

              behavior:
                "smooth"
            });

            return;
          }

          const prompt =
            getTopicPrompt(
              topic
            );

          questionInput.value =
            prompt;

          await processQuestion(
            prompt
          );
        }
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Typed Questions
  |--------------------------------------------------------------------------
  */

  questionSubmit.addEventListener(
    "click",
    function () {
      processQuestion(
        questionInput.value
      );
    }
  );

  questionInput.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key ===
          "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        processQuestion(
          questionInput.value
        );
      }
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Helpful Buttons
  |--------------------------------------------------------------------------
  */

  helpfulYes.addEventListener(
    "click",
    function () {
      const mode =
        helpfulActions
          .dataset
          .mode;

      if (
        mode ===
        "escalation"
      ) {
        showHumanConfirmation();

        return;
      }

      responseBox.innerHTML = `
        <span class="gfloor-response-title">
          Glad we could help!
        </span>

        <div class="gfloor-response-answer">
          You can choose another topic or ask another question anytime.
        </div>
      `;

      helpfulActions.classList.remove(
        "show"
      );
    }
  );

  helpfulNo.addEventListener(
    "click",
    function () {
      const mode =
        helpfulActions
          .dataset
          .mode;

      if (
        mode ===
        "escalation"
      ) {
        responseBox.innerHTML = `
          <span class="gfloor-response-title">
            No problem.
          </span>

          <div class="gfloor-response-answer">
            You can try another question or choose one of the support topics above.
          </div>
        `;

        helpfulActions.classList.remove(
          "show"
        );

        return;
      }

      showHumanConfirmation();
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Human Support
  |--------------------------------------------------------------------------
  */

  humanButton.addEventListener(
    "click",
    function () {
      showHumanConfirmation();
    }
  );

  humanBackButton.addEventListener(
    "click",
    function () {
      showHome();
    }
  );

  stayChatButton.addEventListener(
    "click",
    function () {
      showHome();
    }
  );

  connectButton.addEventListener(
    "click",
    function () {
      showContactForm();
    }
  );

  contactBackButton.addEventListener(
    "click",
    function () {
      showHumanConfirmation();
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Contact Form Submission
  |--------------------------------------------------------------------------
  */

  form.addEventListener(
    "submit",
    async function (
      event
    ) {
      event.preventDefault();

      result.textContent =
        "";

      submitButton.disabled =
        true;

      submitButton.textContent =
        "Sending...";

      await getAgentAvailability();

      const payload = {
        name:
          form.name.value.trim(),

        email:
          form.email.value.trim(),

        phone:
          form.phone.value.trim(),

        message:
          form.message.value.trim(),

        pageUrl:
          window.location.href,

        pageTitle:
          document.title,

        requestedLiveAgent:
          currentSupportStatus
            .liveAgentAvailable,

        matchedIntent:
          lastMatchedIntent
            ? lastMatchedIntent.id
            : null,

        matchedQuestion:
          lastMatchedIntent
            ? lastMatchedIntent.question
            : null,

        matchScore:
          lastMatchScore
      };

      try {
        const response =
          await fetch(
            MESSAGE_API_URL,
            {
              method:
                "POST",

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

        let data =
          {};

        try {
          data =
            await response.json();
        } catch (
          jsonError
        ) {
          data =
            {};
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              "Message could not be sent."
          );
        }

        result.style.color =
          "#16733c";

        result.textContent =
          "Thank you. Your message has been sent to G-Floor Customer Service.";

        form.reset();
      } catch (error) {
        console.error(
          "G-Floor chat submission error:",
          error
        );

        result.style.color =
          "#b42318";

        result.textContent =
          "Email delivery is not active yet. Your chat interface is working, but Microsoft Graph email delivery is still being configured.";
      } finally {
        submitButton.disabled =
          false;

        submitButton.textContent =
          "Send Message";
      }
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Escape Key
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key ===
          "Escape" &&
        panel.classList.contains(
          "open"
        )
      ) {
        togglePanel(
          false
        );

        button.focus();
      }
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Preload Knowledge Base
  |--------------------------------------------------------------------------
  */

  setTimeout(
    function () {
      loadKnowledgeBase()
        .catch(
          function (error) {
            console.error(
              "G-Floor knowledge base preload error:",
              error
            );
          }
        );
    },
    1000
  );
})();