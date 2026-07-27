(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Small Talk
  |--------------------------------------------------------------------------
  |
  | STEP 19B
  |
  | Handles basic conversational/customer-service messages BEFORE they are
  | passed into the G-Floor product knowledge-base matching system.
  |
  | Examples:
  |
  | Hello
  | Hi
  | Good morning
  | How are you?
  | How are you today?
  | Thank you
  | Thanks
  | Goodbye
  | Who are you?
  | Are you a real person?
  | Can you help me?
  | What can you help with?
  |
  | Product/support questions continue through widget.js normally.
  |
  |--------------------------------------------------------------------------
  */

  const SMALL_TALK_VERSION =
    "19.2";

  /*
  |--------------------------------------------------------------------------
  | Configuration
  |--------------------------------------------------------------------------
  */

  const MAX_SMALL_TALK_WORDS =
    14;

  /*
  |--------------------------------------------------------------------------
  | G-Floor Support Keywords
  |--------------------------------------------------------------------------
  |
  | If a message contains one of these AND has a real support question,
  | we allow widget.js to handle it instead of small talk.
  |
  |--------------------------------------------------------------------------
  */

  const SUPPORT_WORDS =
    new Set([
      "floor",
      "flooring",
      "gfloor",
      "garage",
      "vinyl",
      "mat",
      "mats",
      "trailer",
      "marine",
      "outdoor",
      "outside",
      "pet",
      "kennel",

      "install",
      "installation",
      "glue",
      "adhesive",
      "tape",
      "seam",
      "seams",
      "subfloor",
      "substrate",
      "wood",
      "concrete",

      "clean",
      "cleaning",
      "wash",
      "stain",
      "chemical",

      "waterproof",
      "water",
      "wet",

      "size",
      "sizes",
      "color",
      "colors",
      "sku",
      "price",
      "cost",
      "stock",
      "available",
      "availability",

      "shipping",
      "delivery",
      "freight",
      "tracking",

      "order",
      "purchase",

      "warranty",
      "return",
      "refund"
    ]);

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(
    value
  ) {
    return String(
      value || ""
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
        /[^a-z0-9'\s]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function getWords(
    value
  ) {
    const normalized =
      normalizeText(
        value
      );

    if (
      !normalized
    ) {
      return [];
    }

    return normalized.split(
      " "
    );
  }

  function containsSupportWord(
    value
  ) {
    const words =
      getWords(
        value
      );

    return words.some(
      function (
        word
      ) {
        return SUPPORT_WORDS.has(
          word
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Element Getters
  |--------------------------------------------------------------------------
  */

  function getQuestionInput() {
    return document.getElementById(
      "gfloor-chat-question"
    );
  }

  function getQuestionButton() {
    return document.getElementById(
      "gfloor-question-submit"
    );
  }

  function getResponseBox() {
    return document.getElementById(
      "gfloor-response-box"
    );
  }

  function getHelpfulActions() {
    return document.getElementById(
      "gfloor-helpful-actions"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Small Talk Detection
  |--------------------------------------------------------------------------
  */

  function detectSmallTalk(
    rawMessage
  ) {
    const message =
      normalizeText(
        rawMessage
      );

    if (
      !message
    ) {
      return null;
    }

    const words =
      getWords(
        message
      );

    /*
     * Avoid treating long messages as casual conversation.
     */

    if (
      words.length >
      MAX_SMALL_TALK_WORDS
    ) {
      return null;
    }

    /*
    |--------------------------------------------------------------------------
    | Greetings
    |--------------------------------------------------------------------------
    */

    if (
      /^(hi|hello|hey|hiya|howdy)$/.test(
        message
      ) ||
      /^(hi|hello|hey)\s+(there|gfloor|g floor)$/.test(
        message
      )
    ) {
      return {
        type:
          "greeting",

        response:
          "Hi! Thanks for visiting G-Floor. I'm here to help with product questions, installation, cleaning, shipping, orders, warranties, and finding the right flooring."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Good Morning
    |--------------------------------------------------------------------------
    */

    if (
      /^good morning/.test(
        message
      )
    ) {
      return {
        type:
          "good_morning",

        response:
          "Good morning! Thanks for visiting G-Floor. What can I help you with today?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Good Afternoon
    |--------------------------------------------------------------------------
    */

    if (
      /^good afternoon/.test(
        message
      )
    ) {
      return {
        type:
          "good_afternoon",

        response:
          "Good afternoon! I'm happy to help. What can I help you with today?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Good Evening
    |--------------------------------------------------------------------------
    */

    if (
      /^good evening/.test(
        message
      )
    ) {
      return {
        type:
          "good_evening",

        response:
          "Good evening! I'm here to help with your G-Floor questions."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | How Are You?
    |--------------------------------------------------------------------------
    */

    if (
      /^(how are you|how are you doing|how are you today|how's it going|hows it going|how is it going|how have you been)$/.test(
        message
      )
    ) {
      return {
        type:
          "how_are_you",

        response:
          "I'm doing great, thank you for asking! I'm ready to help with your G-Floor questions. What can I help you with today?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | What's Up?
    |--------------------------------------------------------------------------
    */

    if (
      /^(what's up|whats up|what is up|sup)$/.test(
        message
      )
    ) {
      return {
        type:
          "whats_up",

        response:
          "Not much—just here and ready to help with G-Floor! What can I help you find?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Thank You
    |--------------------------------------------------------------------------
    */

    if (
      /^(thank you|thank you so much|thanks|thanks so much|thank you very much|thanks a lot|appreciate it|i appreciate it|perfect thanks|great thanks)$/.test(
        message
      )
    ) {
      return {
        type:
          "thanks",

        response:
          "You're very welcome! I'm glad I could help. Let me know if you have another G-Floor question."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Compliments
    |--------------------------------------------------------------------------
    */

    if (
      /^(great|awesome|perfect|excellent|nice|cool|sounds good|that helps|very helpful|you are helpful|you're helpful|youre helpful)$/.test(
        message
      )
    ) {
      return {
        type:
          "compliment",

        response:
          "Glad to hear it! I'm here if you need help with anything else."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Goodbye
    |--------------------------------------------------------------------------
    */

    if (
      /^(bye|goodbye|good bye|see you|see ya|talk to you later|have a good day|have a great day|have a nice day)$/.test(
        message
      )
    ) {
      return {
        type:
          "goodbye",

        response:
          "Thanks for visiting G-Floor! Have a great day."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Who Are You?
    |--------------------------------------------------------------------------
    */

    if (
      /^(who are you|what are you|what's your name|whats your name|what is your name)$/.test(
        message
      )
    ) {
      return {
        type:
          "identity",

        response:
          "I'm G-Floor's automated support assistant. I can help answer common G-Floor product and customer-service questions, and I can connect you with our Customer Service team when you need additional help."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Are You Human?
    |--------------------------------------------------------------------------
    */

    if (
      /^(are you human|are you a human|are you real|are you a real person|am i talking to a person|am i talking to a human|is this a real person|are you a bot|are you an ai|are you ai)$/.test(
        message
      )
    ) {
      return {
        type:
          "human_question",

        response:
          "I'm G-Floor's automated support assistant, not a live Customer Service representative. I can answer many common questions, or you can select “Talk to a Customer Service Representative” below whenever you'd like help from our team."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Can You Help?
    |--------------------------------------------------------------------------
    */

    if (
      /^(can you help|can you help me|could you help|could you help me|i need help|help me|i have a question|can i ask a question|can i ask you something)$/.test(
        message
      )
    ) {
      return {
        type:
          "help_request",

        response:
          "Absolutely! Ask me your G-Floor question and I'll do my best to help. I can also connect you with Customer Service if your question needs additional review."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | What Can You Help With?
    |--------------------------------------------------------------------------
    */

    if (
      /^(what can you do|what can you help with|how can you help|how can you help me|what do you know|what questions can you answer)$/.test(
        message
      )
    ) {
      return {
        type:
          "capabilities",

        response:
          "I can help with G-Floor product selection, sizes, colors, SKUs, pricing, availability, installation, cleaning and maintenance, outdoor use, shipping and delivery, orders, warranties, and returns. I can also connect you with a Customer Service representative."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Sorry / Apology
    |--------------------------------------------------------------------------
    */

    if (
      /^(sorry|i'm sorry|im sorry|my bad|sorry about that)$/.test(
        message
      )
    ) {
      return {
        type:
          "apology",

        response:
          "No problem at all! What can I help you with?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Yes / No Conversation
    |--------------------------------------------------------------------------
    |
    | Do NOT intercept generic Yes/No because those can be important answers
    | inside other customer-service flows.
    |--------------------------------------------------------------------------
    */

    /*
    |--------------------------------------------------------------------------
    | Greeting + Actual Product Question
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | "Hi, how do I clean G-Floor?"
    |
    | This should go through widget.js rather than being treated as a simple
    | greeting.
    |--------------------------------------------------------------------------
    */

    if (
      containsSupportWord(
        message
      )
    ) {
      return null;
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Render Small Talk
  |--------------------------------------------------------------------------
  */

  function renderSmallTalk(
    smallTalk
  ) {
    const responseBox =
      getResponseBox();

    const helpfulActions =
      getHelpfulActions();

    if (
      !responseBox ||
      !smallTalk
    ) {
      return;
    }

    responseBox.innerHTML = `
      <span
        class="gfloor-response-title"
      >
        G-Floor Support
      </span>

      <span
        class="gfloor-response-category"
      >
        Customer Service
      </span>

      <div
        class="gfloor-smalltalk-response"
      >
        ${escapeHtml(
          smallTalk.response
        )}
      </div>
    `;

    responseBox.classList.add(
      "show"
    );

    /*
     * Small talk does not need the
     * "Did this answer your question?"
     * workflow.
     */

    if (
      helpfulActions
    ) {
      helpfulActions.classList.remove(
        "show"
      );

      helpfulActions.dataset.mode =
        "smalltalk";
    }

    /*
     * Scroll response into view.
     */

    window.setTimeout(
      function () {
        responseBox.scrollIntoView({
          behavior:
            "smooth",

          block:
            "nearest"
        });
      },
      50
    );

    /*
     * Custom analytics event.
     *
     * Does NOT include the customer's
     * raw typed message.
     */

    window.dataLayer =
      window.dataLayer ||
      [];

    window.dataLayer.push({
      event:
        "gfloor_chat_smalltalk",

      smalltalk_type:
        smallTalk.type,

      chat_source:
        "gfloor_custom_chat",

      page_location:
        window.location.href,

      page_path:
        window.location.pathname
    });

    console.log(
      "G-Floor small talk:",
      {
        version:
          SMALL_TALK_VERSION,

        type:
          smallTalk.type
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | HTML Escape
  |--------------------------------------------------------------------------
  */

  function escapeHtml(
    value
  ) {
    const element =
      document.createElement(
        "div"
      );

    element.textContent =
      String(
        value || ""
      );

    return element.innerHTML;
  }

  /*
  |--------------------------------------------------------------------------
  | Attempt Small Talk
  |--------------------------------------------------------------------------
  */

  function handleQuestion() {
    const questionInput =
      getQuestionInput();

    if (
      !questionInput
    ) {
      return false;
    }

    const question =
      cleanText(
        questionInput.value
      );

    if (
      !question
    ) {
      return false;
    }

    const smallTalk =
      detectSmallTalk(
        question
      );

    if (
      !smallTalk
    ) {
      return false;
    }

    renderSmallTalk(
      smallTalk
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Question Button Interception
  |--------------------------------------------------------------------------
  |
  | Capture phase is intentional.
  |
  | For small talk:
  | - stop before widget.js product matching runs
  |
  | For normal questions:
  | - do nothing
  | - widget.js continues normally
  |--------------------------------------------------------------------------
  */

  function bindQuestionButton() {
    const questionButton =
      getQuestionButton();

    if (
      !questionButton
    ) {
      return false;
    }

    questionButton.addEventListener(
      "click",
      function (
        event
      ) {
        const handled =
          handleQuestion();

        if (
          !handled
        ) {
          return;
        }

        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();
      },
      true
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Optional Enter Key Support
  |--------------------------------------------------------------------------
  |
  | Enter submits.
  | Shift + Enter creates a new line.
  |--------------------------------------------------------------------------
  */

  function bindKeyboard() {
    const questionInput =
      getQuestionInput();

    if (
      !questionInput
    ) {
      return false;
    }

    questionInput.addEventListener(
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

        const smallTalk =
          detectSmallTalk(
            questionInput.value
          );

        if (
          !smallTalk
        ) {
          return;
        }

        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();

        renderSmallTalk(
          smallTalk
        );
      },
      true
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  let initializationAttempts =
    0;

  const MAX_INITIALIZATION_ATTEMPTS =
    40;

  const INITIALIZATION_DELAY =
    250;

  function initialize() {
    const questionInput =
      getQuestionInput();

    const questionButton =
      getQuestionButton();

    const responseBox =
      getResponseBox();

    if (
      !questionInput ||
      !questionButton ||
      !responseBox
    ) {
      initializationAttempts +=
        1;

      if (
        initializationAttempts >=
        MAX_INITIALIZATION_ATTEMPTS
      ) {
        console.warn(
          "G-Floor small talk could not initialize because the chat widget was not found."
        );

        return;
      }

      window.setTimeout(
        initialize,
        INITIALIZATION_DELAY
      );

      return;
    }

    bindQuestionButton();

    bindKeyboard();

    console.log(
      "G-Floor chat small talk loaded:",
      {
        version:
          SMALL_TALK_VERSION
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Start
  |--------------------------------------------------------------------------
  */

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