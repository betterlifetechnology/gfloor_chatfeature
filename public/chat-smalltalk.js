(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Small Talk
  |--------------------------------------------------------------------------
  |
  | VERSION 19.4
  |
  | Handles conversational/customer-service messages BEFORE widget.js
  | sends them through product matching and confidence scoring.
  |
  | Includes:
  |
  | - Greetings
  | - How are you?
  | - Thank you
  | - Goodbye
  | - Basic assistant/customer-service conversation
  | - Kansas City Chiefs small talk
  |
  | Chiefs schedule data is stored in Central Time-compatible UTC timestamps.
  |
  |--------------------------------------------------------------------------
  */

  const SMALL_TALK_VERSION = "19.4";

  const CHIEFS_SCHEDULE_URL =
    "https://www.chiefs.com/schedule/";

  /*
  |--------------------------------------------------------------------------
  | Kansas City Chiefs 2026 Schedule
  |--------------------------------------------------------------------------
  |
  | Known scheduled games from the official Kansas City Chiefs schedule.
  |
  | Week 17 and Week 18 have not been assigned exact dates/times yet and are
  | handled separately below.
  |
  |--------------------------------------------------------------------------
  */

  const CHIEFS_GAMES_2026 = [
    {
      type: "Preseason",
      week: "Preseason Week 1",
      kickoffUtc: "2026-08-15T20:00:00Z",
      opponent: "Los Angeles Rams",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Preseason",
      week: "Preseason Week 2",
      kickoffUtc: "2026-08-22T23:30:00Z",
      opponent: "Tampa Bay Buccaneers",
      location: "Raymond James Stadium",
      home: false
    },

    {
      type: "Preseason",
      week: "Preseason Week 3",
      kickoffUtc: "2026-08-29T00:00:00Z",
      opponent: "Seattle Seahawks",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Regular Season",
      week: "Week 1",
      kickoffUtc: "2026-09-15T00:15:00Z",
      opponent: "Denver Broncos",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Regular Season",
      week: "Week 2",
      kickoffUtc: "2026-09-21T00:20:00Z",
      opponent: "Indianapolis Colts",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Regular Season",
      week: "Week 3",
      kickoffUtc: "2026-09-27T17:00:00Z",
      opponent: "Miami Dolphins",
      location: "Hard Rock Stadium",
      home: false
    },

    {
      type: "Regular Season",
      week: "Week 4",
      kickoffUtc: "2026-10-04T20:25:00Z",
      opponent: "Las Vegas Raiders",
      location: "Allegiant Stadium",
      home: false
    },

    /*
     * Week 5 = BYE
     */

    {
      type: "Regular Season",
      week: "Week 6",
      kickoffUtc: "2026-10-18T20:25:00Z",
      opponent: "Los Angeles Chargers",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Regular Season",
      week: "Week 7",
      kickoffUtc: "2026-10-26T00:20:00Z",
      opponent: "Seattle Seahawks",
      location: "Lumen Field",
      home: false
    },

    {
      type: "Regular Season",
      week: "Week 8",
      kickoffUtc: "2026-11-01T21:25:00Z",
      opponent: "Denver Broncos",
      location: "Empower Field at Mile High",
      home: false
    },

    {
      type: "Regular Season",
      week: "Week 9",
      kickoffUtc: "2026-11-08T18:00:00Z",
      opponent: "New York Jets",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Regular Season",
      week: "Week 10",
      kickoffUtc: "2026-11-15T18:00:00Z",
      opponent: "Atlanta Falcons",
      location: "Mercedes-Benz Stadium",
      home: false
    },

    {
      type: "Regular Season",
      week: "Week 11",
      kickoffUtc: "2026-11-22T18:00:00Z",
      opponent: "Arizona Cardinals",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Regular Season",
      week: "Week 12",
      kickoffUtc: "2026-11-27T01:20:00Z",
      opponent: "Buffalo Bills",
      location: "Highmark Stadium",
      home: false
    },

    {
      type: "Regular Season",
      week: "Week 13",
      kickoffUtc: "2026-12-04T01:15:00Z",
      opponent: "Los Angeles Rams",
      location: "SoFi Stadium",
      home: false
    },

    {
      type: "Regular Season",
      week: "Week 14",
      kickoffUtc: "2026-12-13T21:25:00Z",
      opponent: "Cincinnati Bengals",
      location: "Paycor Stadium",
      home: false
    },

    {
      type: "Regular Season",
      week: "Week 15",
      kickoffUtc: "2026-12-22T01:15:00Z",
      opponent: "New England Patriots",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    },

    {
      type: "Regular Season",
      week: "Week 16",
      kickoffUtc: "2026-12-27T21:25:00Z",
      opponent: "San Francisco 49ers",
      location: "GEHA Field at Arrowhead Stadium",
      home: true
    }
  ];

  /*
  |--------------------------------------------------------------------------
  | Chiefs Games Without Final Date / Time
  |--------------------------------------------------------------------------
  */

  const CHIEFS_TBD_GAMES_2026 = [
    {
      week: "Week 17",
      opponent: "Los Angeles Chargers",
      home: false
    },

    {
      week: "Week 18",
      opponent: "Las Vegas Raiders",
      home: true
    }
  ];

  /*
  |--------------------------------------------------------------------------
  | General Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeText(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/g-floor/g, "gfloor")
      .replace(/g floor/g, "gfloor")
      .replace(/®/g, "")
      .replace(/™/g, "")
      .replace(/[?!.,;:]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    const element =
      document.createElement("div");

    element.textContent =
      String(value || "");

    return element.innerHTML;
  }

  /*
  |--------------------------------------------------------------------------
  | Element Helpers
  |--------------------------------------------------------------------------
  */

  function getQuestionInput() {
    return document.getElementById(
      "gfloor-chat-question"
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

  function getProcessingMascot() {
    return document.getElementById(
      "gfloor-mascot-processing"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Central Time Formatting
  |--------------------------------------------------------------------------
  */

  function formatChiefsDate(date) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Chicago",

        weekday:
          "long",

        month:
          "long",

        day:
          "numeric",

        year:
          "numeric"
      }
    ).format(date);
  }

  function formatChiefsTime(date) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Chicago",

        hour:
          "numeric",

        minute:
          "2-digit",

        timeZoneName:
          "short"
      }
    ).format(date);
  }

  /*
  |--------------------------------------------------------------------------
  | Determine Next Chiefs Game
  |--------------------------------------------------------------------------
  */

  function getNextChiefsGame() {
    const now =
      new Date();

    /*
     * Keep a game considered "current" for about four hours after kickoff.
     *
     * That way:
     *
     * "What time does the Chiefs game start?"
     *
     * asked during a game still refers to today's game rather than immediately
     * jumping to next week's game.
     */

    const gameWindowStart =
      now.getTime() -
      (
        4 *
        60 *
        60 *
        1000
      );

    return (
      CHIEFS_GAMES_2026.find(
        function (game) {
          const kickoff =
            new Date(
              game.kickoffUtc
            );

          return (
            kickoff.getTime() >=
            gameWindowStart
          );
        }
      ) ||
      null
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Chiefs Response Builder
  |--------------------------------------------------------------------------
  */

  function buildChiefsGameResponse() {
    const game =
      getNextChiefsGame();

    if (!game) {
      return (
        "The currently scheduled 2026 Chiefs games with confirmed kickoff times have passed. " +
        "Weeks 17 and 18 are still listed as TBD on the Chiefs schedule. " +
        "Check Chiefs.com for the latest schedule update."
      );
    }

    const kickoff =
      new Date(
        game.kickoffUtc
      );

    const dateText =
      formatChiefsDate(
        kickoff
      );

    const timeText =
      formatChiefsTime(
        kickoff
      );

    const matchup =
      game.home
        ? (
          "the " +
          game.opponent +
          " at " +
          game.location
        )
        : (
          "the " +
          game.opponent +
          " at " +
          game.location
        );

    return (
      "Go Chiefs! The next Kansas City Chiefs game is " +
      game.week +
      " against " +
      matchup +
      " on " +
      dateText +
      " at " +
      timeText +
      "."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Chiefs Small-Talk Detection
  |--------------------------------------------------------------------------
  */

  function isChiefsQuestion(message) {
    const normalized =
      normalizeText(
        message
      );

    /*
     * We deliberately require "Chiefs" or Kansas City football wording so
     * unrelated sports questions don't take over the customer-service chat.
     */

    const mentionsChiefs =
      /\bchiefs\b/.test(
        normalized
      ) ||
      /\bkansas city football\b/.test(
        normalized
      ) ||
      /\bkc football\b/.test(
        normalized
      );

    if (!mentionsChiefs) {
      return false;
    }

    return (
      /\bgame\b/.test(normalized) ||
      /\bplay\b/.test(normalized) ||
      /\bplaying\b/.test(normalized) ||
      /\bkickoff\b/.test(normalized) ||
      /\bstart\b/.test(normalized) ||
      /\bschedule\b/.test(normalized) ||
      /\bwhen\b/.test(normalized) ||
      /\bwhat time\b/.test(normalized) ||
      /\bnext\b/.test(normalized) ||
      normalized === "chiefs"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Small Talk Rules
  |--------------------------------------------------------------------------
  */

  function detectSmallTalk(
    rawMessage
  ) {
    const message =
      normalizeText(
        rawMessage
      );

    if (!message) {
      return null;
    }

    /*
    |--------------------------------------------------------------------------
    | Kansas City Chiefs
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | This comes before all product/knowledge-base routing.
    |
    |--------------------------------------------------------------------------
    */

    if (
      isChiefsQuestion(
        message
      )
    ) {
      return {
        type:
          "chiefs",

        category:
          "Kansas City",

        response:
          buildChiefsGameResponse(),

        sourceUrl:
          CHIEFS_SCHEDULE_URL
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Hello / Greeting
    |--------------------------------------------------------------------------
    */

    if (
      /^(hi|hello|hey|hiya|howdy|hello there|hi there|hey there)$/.test(
        message
      )
    ) {
      return {
        type:
          "greeting",

        category:
          "Customer Service",

        response:
          "Hi! Thanks for visiting G-Floor. I'm here to help. What can I help you with today?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Good Morning
    |--------------------------------------------------------------------------
    */

    if (
      /^(good morning|morning)$/.test(
        message
      )
    ) {
      return {
        type:
          "good_morning",

        category:
          "Customer Service",

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
      /^(good afternoon|afternoon)$/.test(
        message
      )
    ) {
      return {
        type:
          "good_afternoon",

        category:
          "Customer Service",

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
      /^(good evening|evening)$/.test(
        message
      )
    ) {
      return {
        type:
          "good_evening",

        category:
          "Customer Service",

        response:
          "Good evening! Thanks for visiting G-Floor. How can I help?"
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

        category:
          "Customer Service",

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

        category:
          "Customer Service",

        response:
          "Not much—just here and ready to help with G-Floor! What can I help you with?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Thank You
    |--------------------------------------------------------------------------
    */

    if (
      /^(thank you|thanks|thank you so much|thanks so much|thank you very much|thanks a lot|appreciate it|i appreciate it)$/.test(
        message
      )
    ) {
      return {
        type:
          "thanks",

        category:
          "Customer Service",

        response:
          "You're very welcome! I'm glad I could help. Let me know if you have another G-Floor question."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Positive Responses
    |--------------------------------------------------------------------------
    */

    if (
      /^(great|awesome|perfect|excellent|nice|cool|sounds good|that helps|very helpful|you are helpful|you're helpful|youre helpful)$/.test(
        message
      )
    ) {
      return {
        type:
          "positive_feedback",

        category:
          "Customer Service",

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

        category:
          "Customer Service",

        response:
          "Thanks for visiting G-Floor! Have a great day."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Identity
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

        category:
          "Customer Service",

        response:
          "I'm G-Floor's automated support assistant. I can help with common G-Floor product and Customer Service questions, and I can connect you with our Customer Service team when needed."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Human / Bot Question
    |--------------------------------------------------------------------------
    */

    if (
      /^(are you human|are you a human|are you real|are you a real person|is this a real person|are you a bot|are you an ai|are you ai|am i talking to a human|am i talking to a person)$/.test(
        message
      )
    ) {
      return {
        type:
          "human_question",

        category:
          "Customer Service",

        response:
          "I'm G-Floor's automated support assistant, not a live representative. I can answer many common questions, or you can select “Talk to a Customer Service Representative” whenever you'd like help from our team."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | General Help
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

        category:
          "Customer Service",

        response:
          "Absolutely! Ask me your G-Floor question and I'll do my best to help. I can also connect you with Customer Service if your question needs additional review."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Capabilities
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

        category:
          "Customer Service",

        response:
          "I can help with G-Floor product selection, sizes, colors, SKUs, pricing, availability, installation, cleaning and maintenance, outdoor use, shipping and delivery, orders, warranties, and returns. I can also connect you with Customer Service."
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Apology
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

        category:
          "Customer Service",

        response:
          "No problem at all! What can I help you with?"
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Not Small Talk
    |--------------------------------------------------------------------------
    */

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Stop Mascot Processing
  |--------------------------------------------------------------------------
  */

  function stopProcessingMascot() {
    const processing =
      getProcessingMascot();

    if (processing) {
      processing.classList.remove(
        "show"
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Render Small-Talk Response
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

    stopProcessingMascot();

    const category =
      smallTalk.category ||
      "Customer Service";

    const sourceLink =
      smallTalk.sourceUrl
        ? `
          <div class="gfloor-response-source">
            <a
              href="${escapeHtml(
                smallTalk.sourceUrl
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Chiefs Schedule
            </a>
          </div>
        `
        : "";

    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      <span class="gfloor-response-category">
        ${escapeHtml(
          category
        )}
      </span>

      <div class="gfloor-smalltalk-response">
        ${escapeHtml(
          smallTalk.response
        )}
      </div>

      ${sourceLink}
    `;

    responseBox.classList.add(
      "show"
    );

    /*
     * Small talk does not need the
     * Did this answer your question buttons.
     */

    if (helpfulActions) {
      helpfulActions.classList.remove(
        "show"
      );

      helpfulActions.dataset.mode =
        "smalltalk";
    }

    /*
     * GA4-safe event.
     *
     * We intentionally do not send the customer's
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
      "G-Floor small talk handled:",
      {
        version:
          SMALL_TALK_VERSION,

        type:
          smallTalk.type
      }
    );

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
  }

  /*
  |--------------------------------------------------------------------------
  | Process Possible Small Talk
  |--------------------------------------------------------------------------
  */

  function trySmallTalk() {
    const questionInput =
      getQuestionInput();

    if (!questionInput) {
      return false;
    }

    const question =
      cleanText(
        questionInput.value
      );

    if (!question) {
      return false;
    }

    const smallTalk =
      detectSmallTalk(
        question
      );

    if (!smallTalk) {
      return false;
    }

    renderSmallTalk(
      smallTalk
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | DOCUMENT-LEVEL CLICK INTERCEPTOR
  |--------------------------------------------------------------------------
  |
  | Capture phase makes this run before widget.js.
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
        !target.closest
      ) {
        return;
      }

      const submitButton =
        target.closest(
          "#gfloor-question-submit"
        );

      if (!submitButton) {
        return;
      }

      const handled =
        trySmallTalk();

      /*
       * Normal product/customer-support question.
       *
       * Let widget.js handle it.
       */

      if (!handled) {
        return;
      }

      /*
       * Small talk was handled.
       *
       * Do NOT let widget.js send it into
       * confidence/knowledge-base matching.
       */

      event.preventDefault();

      event.stopPropagation();

      event.stopImmediatePropagation();
    },
    true
  );

  /*
  |--------------------------------------------------------------------------
  | Enter Key Interceptor
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "keydown",
    function (event) {
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

      const handled =
        trySmallTalk();

      if (!handled) {
        return;
      }

      event.preventDefault();

      event.stopPropagation();

      event.stopImmediatePropagation();
    },
    true
  );

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  console.log(
    "G-Floor chat small talk loaded:",
    {
      version:
        SMALL_TALK_VERSION,

      chiefsSchedule:
        true
    }
  );

})();