(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Mascot
  |--------------------------------------------------------------------------
  |
  | STEP 19
  |
  | Mascot states:
  |
  | 1. Launcher / chat closed
  |    -> Welcome mascot
  |
  | 2. Chat opened / welcome state
  |    -> Welcome mascot
  |
  | 3. Question processing
  |    -> Thinking mascot
  |
  | 4. Answer returned
  |    -> Welcome mascot
  |
  | This file intentionally does NOT modify the core widget logic.
  |
  |--------------------------------------------------------------------------
  */

  const MASCOT_VERSION = "19.1";

  /*
  |--------------------------------------------------------------------------
  | Shopify CDN Images
  |--------------------------------------------------------------------------
  */

  const WELCOME_MASCOT_URL =
    "https://cdn.shopify.com/s/files/1/0015/9390/1123/files/gfloor-chat-mascot-welcome_png.png?v=1785175466";

  const THINKING_MASCOT_URL =
    "https://cdn.shopify.com/s/files/1/0015/9390/1123/files/gfloor-chat-mascot-thinking_png.png?v=1785175466";

  /*
  |--------------------------------------------------------------------------
  | Timing
  |--------------------------------------------------------------------------
  */

  const MAX_PROCESSING_TIME =
    15000;

  const ANSWER_TRANSITION_DELAY =
    250;

  const INIT_RETRY_DELAY =
    250;

  const MAX_INIT_ATTEMPTS =
    40;

  /*
  |--------------------------------------------------------------------------
  | State
  |--------------------------------------------------------------------------
  */

  const state = {
    initialized: false,

    processing: false,

    processingTimeout: null,

    lastResponseContent: "",

    initAttempts: 0
  };

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(value) {
    return String(
      value || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function preloadImage(url) {
    const image =
      new Image();

    image.src =
      url;
  }

  preloadImage(
    WELCOME_MASCOT_URL
  );

  preloadImage(
    THINKING_MASCOT_URL
  );

  /*
  |--------------------------------------------------------------------------
  | Styles
  |--------------------------------------------------------------------------
  */

  function addStyles() {
    if (
      document.getElementById(
        "gfloor-chat-mascot-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "gfloor-chat-mascot-styles";

    style.textContent = `

      /*
      |--------------------------------------------------------------------------
      | Chat Launcher
      |--------------------------------------------------------------------------
      */

      #gfloor-chat-button.gfloor-mascot-launcher {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        min-height: 54px !important;
        padding: 6px 16px 6px 8px !important;
      }

      #gfloor-chat-button .gfloor-launcher-mascot {
        display: block;
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        object-fit: contain;
        border-radius: 50%;
        background: #ffffff;
        padding: 2px;
        box-sizing: border-box;
      }

      #gfloor-chat-button .gfloor-launcher-label {
        display: block;
        color: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.1;
        white-space: nowrap;
      }

      /*
      |--------------------------------------------------------------------------
      | Welcome Area
      |--------------------------------------------------------------------------
      */

      .gfloor-mascot-welcome {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0 0 14px;
        padding: 10px 12px;
        border-radius: 9px;
        background: #f4f5f6;
        box-sizing: border-box;
      }

      .gfloor-mascot-welcome-image-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 68px;
        height: 68px;
        flex: 0 0 68px;
        border-radius: 50%;
        background: #ffffff;
        box-sizing: border-box;
        overflow: hidden;
      }

      .gfloor-mascot-welcome-image {
        display: block;
        width: 64px;
        height: 64px;
        object-fit: contain;
      }

      .gfloor-mascot-welcome-copy {
        min-width: 0;
        flex: 1;
      }

      .gfloor-mascot-welcome-title {
        display: block;
        margin: 0 0 4px;
        color: #222222;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.3;
      }

      .gfloor-mascot-welcome-text {
        display: block;
        margin: 0;
        color: #444444;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        font-weight: 400;
        line-height: 1.4;
      }

      /*
      |--------------------------------------------------------------------------
      | Hide Original Intro Once Mascot Welcome Is Added
      |--------------------------------------------------------------------------
      */

      #gfloor-chat-home.gfloor-mascot-ready
      > .gfloor-chat-intro {
        display: none !important;
      }

      /*
      |--------------------------------------------------------------------------
      | Processing State
      |--------------------------------------------------------------------------
      */

      .gfloor-mascot-processing {
        display: none;
        align-items: center;
        gap: 12px;
        margin-top: 14px;
        padding: 11px 12px;
        border-radius: 9px;
        background: #f4f5f6;
        box-sizing: border-box;
      }

      .gfloor-mascot-processing.show {
        display: flex;
      }

      .gfloor-mascot-processing-image-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        flex: 0 0 64px;
        border-radius: 50%;
        background: #ffffff;
        box-sizing: border-box;
        overflow: hidden;
      }

      .gfloor-mascot-processing-image {
        display: block;
        width: 60px;
        height: 60px;
        object-fit: contain;
        animation:
          gfloorMascotThink 1.5s ease-in-out infinite;
      }

      .gfloor-mascot-processing-copy {
        min-width: 0;
        flex: 1;
      }

      .gfloor-mascot-processing-title {
        display: block;
        margin-bottom: 4px;
        color: #222222;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.3;
      }

      .gfloor-mascot-processing-text {
        display: inline;
        color: #555555;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 1.4;
      }

      /*
      |--------------------------------------------------------------------------
      | Animated Thinking Dots
      |--------------------------------------------------------------------------
      */

      .gfloor-mascot-dots {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        margin-left: 3px;
      }

      .gfloor-mascot-dot {
        display: block;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: #d2232a;
        animation:
          gfloorMascotDot 1.2s infinite ease-in-out;
      }

      .gfloor-mascot-dot:nth-child(1) {
        animation-delay: 0s;
      }

      .gfloor-mascot-dot:nth-child(2) {
        animation-delay: .16s;
      }

      .gfloor-mascot-dot:nth-child(3) {
        animation-delay: .32s;
      }

      /*
      |--------------------------------------------------------------------------
      | Welcome Animation
      |--------------------------------------------------------------------------
      */

      .gfloor-mascot-welcome.gfloor-mascot-pop
      .gfloor-mascot-welcome-image {
        animation:
          gfloorMascotWelcome .45s ease-out;
      }

      /*
      |--------------------------------------------------------------------------
      | Animations
      |--------------------------------------------------------------------------
      */

      @keyframes gfloorMascotWelcome {

        0% {
          opacity: 0;
          transform:
            scale(.82)
            translateY(5px);
        }

        70% {
          opacity: 1;
          transform:
            scale(1.05)
            translateY(-2px);
        }

        100% {
          opacity: 1;
          transform:
            scale(1)
            translateY(0);
        }
      }

      @keyframes gfloorMascotThink {

        0%,
        100% {
          transform:
            translateY(0)
            rotate(0deg);
        }

        50% {
          transform:
            translateY(-3px)
            rotate(-1deg);
        }
      }

      @keyframes gfloorMascotDot {

        0%,
        80%,
        100% {
          opacity: .35;
          transform:
            translateY(0);
        }

        40% {
          opacity: 1;
          transform:
            translateY(-3px);
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Reduced Motion
      |--------------------------------------------------------------------------
      */

      @media (
        prefers-reduced-motion:
        reduce
      ) {

        .gfloor-mascot-processing-image,
        .gfloor-mascot-dot,
        .gfloor-mascot-welcome-image {
          animation:
            none !important;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Mobile
      |--------------------------------------------------------------------------
      */

      @media (
        max-width: 480px
      ) {

        #gfloor-chat-button.gfloor-mascot-launcher {
          min-height: 50px !important;
          padding:
            5px 13px 5px 6px !important;
        }

        #gfloor-chat-button
        .gfloor-launcher-mascot {
          width: 38px;
          height: 38px;
          flex-basis: 38px;
        }

        #gfloor-chat-button
        .gfloor-launcher-label {
          font-size: 14px;
        }

        .gfloor-mascot-welcome {
          gap: 9px;
          padding: 9px 10px;
        }

        .gfloor-mascot-welcome-image-wrap {
          width: 58px;
          height: 58px;
          flex-basis: 58px;
        }

        .gfloor-mascot-welcome-image {
          width: 54px;
          height: 54px;
        }

        .gfloor-mascot-processing {
          gap: 9px;
          padding: 9px 10px;
        }

        .gfloor-mascot-processing-image-wrap {
          width: 56px;
          height: 56px;
          flex-basis: 56px;
        }

        .gfloor-mascot-processing-image {
          width: 52px;
          height: 52px;
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Element Getters
  |--------------------------------------------------------------------------
  */

  function getLauncher() {
    return document.getElementById(
      "gfloor-chat-button"
    );
  }

  function getPanel() {
    return document.getElementById(
      "gfloor-chat-panel"
    );
  }

  function getHomeView() {
    return document.getElementById(
      "gfloor-chat-home"
    );
  }

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

  /*
  |--------------------------------------------------------------------------
  | Launcher Mascot
  |--------------------------------------------------------------------------
  */

  function enhanceLauncher() {
    const launcher =
      getLauncher();

    if (
      !launcher
    ) {
      return false;
    }

    if (
      launcher.querySelector(
        ".gfloor-launcher-mascot"
      )
    ) {
      return true;
    }

    launcher.classList.add(
      "gfloor-mascot-launcher"
    );

    launcher.innerHTML = `
      <img
        class="gfloor-launcher-mascot"
        src="${WELCOME_MASCOT_URL}"
        alt=""
        aria-hidden="true"
      >

      <span
        class="gfloor-launcher-label"
      >
        Chat with us
      </span>
    `;

    launcher.setAttribute(
      "aria-label",
      "Chat with G-Floor Customer Service"
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Welcome Mascot
  |--------------------------------------------------------------------------
  */

  function createWelcomeMascot() {
    const homeView =
      getHomeView();

    if (
      !homeView
    ) {
      return false;
    }

    if (
      homeView.querySelector(
        ".gfloor-mascot-welcome"
      )
    ) {
      return true;
    }

    const welcome =
      document.createElement(
        "div"
      );

    welcome.className =
      "gfloor-mascot-welcome";

    welcome.innerHTML = `
      <div
        class="gfloor-mascot-welcome-image-wrap"
      >
        <img
          class="gfloor-mascot-welcome-image"
          src="${WELCOME_MASCOT_URL}"
          alt="G-Floor chat assistant"
        >
      </div>

      <div
        class="gfloor-mascot-welcome-copy"
      >
        <span
          class="gfloor-mascot-welcome-title"
        >
          Hi! I'm here to help.
        </span>

        <span
          class="gfloor-mascot-welcome-text"
        >
          How can we help you today?
        </span>
      </div>
    `;

    homeView.insertBefore(
      welcome,
      homeView.firstChild
    );

    homeView.classList.add(
      "gfloor-mascot-ready"
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Processing Mascot
  |--------------------------------------------------------------------------
  */

  function createProcessingMascot() {
    const questionButton =
      getQuestionButton();

    const responseBox =
      getResponseBox();

    if (
      !questionButton ||
      !responseBox
    ) {
      return false;
    }

    if (
      document.getElementById(
        "gfloor-mascot-processing"
      )
    ) {
      return true;
    }

    const processing =
      document.createElement(
        "div"
      );

    processing.id =
      "gfloor-mascot-processing";

    processing.className =
      "gfloor-mascot-processing";

    processing.setAttribute(
      "role",
      "status"
    );

    processing.setAttribute(
      "aria-live",
      "polite"
    );

    processing.innerHTML = `
      <div
        class="gfloor-mascot-processing-image-wrap"
      >
        <img
          class="gfloor-mascot-processing-image"
          src="${THINKING_MASCOT_URL}"
          alt=""
          aria-hidden="true"
        >
      </div>

      <div
        class="gfloor-mascot-processing-copy"
      >
        <span
          class="gfloor-mascot-processing-title"
        >
          Let me check that for you.
        </span>

        <span
          class="gfloor-mascot-processing-text"
        >
          Looking through G-Floor information
        </span>

        <span
          class="gfloor-mascot-dots"
          aria-hidden="true"
        >
          <span
            class="gfloor-mascot-dot"
          ></span>

          <span
            class="gfloor-mascot-dot"
          ></span>

          <span
            class="gfloor-mascot-dot"
          ></span>
        </span>
      </div>
    `;

    responseBox.parentNode.insertBefore(
      processing,
      responseBox
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Mascot State
  |--------------------------------------------------------------------------
  */

  function getProcessingElement() {
    return document.getElementById(
      "gfloor-mascot-processing"
    );
  }

  function startProcessing() {
    const questionInput =
      getQuestionInput();

    const processing =
      getProcessingElement();

    if (
      !processing
    ) {
      return;
    }

    if (
      questionInput &&
      !cleanText(
        questionInput.value
      )
    ) {
      return;
    }

    state.processing =
      true;

    processing.classList.add(
      "show"
    );

    /*
     * Clear old timer.
     */

    if (
      state.processingTimeout
    ) {
      window.clearTimeout(
        state.processingTimeout
      );
    }

    /*
     * Safety timeout.
     *
     * The mascot should never remain stuck
     * in the thinking state indefinitely.
     */

    state.processingTimeout =
      window.setTimeout(
        function () {
          stopProcessing();
        },
        MAX_PROCESSING_TIME
      );
  }

  function stopProcessing() {
    const processing =
      getProcessingElement();

    state.processing =
      false;

    if (
      state.processingTimeout
    ) {
      window.clearTimeout(
        state.processingTimeout
      );

      state.processingTimeout =
        null;
    }

    if (
      processing
    ) {
      processing.classList.remove(
        "show"
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Welcome Animation
  |--------------------------------------------------------------------------
  */

  function animateWelcomeMascot() {
    const welcome =
      document.querySelector(
        ".gfloor-mascot-welcome"
      );

    if (
      !welcome
    ) {
      return;
    }

    welcome.classList.remove(
      "gfloor-mascot-pop"
    );

    /*
     * Force browser reflow so animation
     * can restart each time chat opens.
     */

    void welcome.offsetWidth;

    welcome.classList.add(
      "gfloor-mascot-pop"
    );

    window.setTimeout(
      function () {
        welcome.classList.remove(
          "gfloor-mascot-pop"
        );
      },
      600
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Response Observer
  |--------------------------------------------------------------------------
  */

  function responseIsVisible(
    responseBox
  ) {
    return (
      responseBox &&
      responseBox.classList.contains(
        "show"
      ) &&
      cleanText(
        responseBox.textContent
      )
    );
  }

  function handleResponseChange() {
    const responseBox =
      getResponseBox();

    if (
      !responseBox
    ) {
      return;
    }

    const currentContent =
      cleanText(
        responseBox.textContent
      );

    if (
      currentContent ===
        state.lastResponseContent &&
      !responseIsVisible(
        responseBox
      )
    ) {
      return;
    }

    state.lastResponseContent =
      currentContent;

    if (
      responseIsVisible(
        responseBox
      )
    ) {
      window.setTimeout(
        function () {
          stopProcessing();
        },
        ANSWER_TRANSITION_DELAY
      );
    }
  }

  function observeResponseBox() {
    const responseBox =
      getResponseBox();

    if (
      !responseBox
    ) {
      return;
    }

    const observer =
      new MutationObserver(
        function () {
          handleResponseChange();
        }
      );

    observer.observe(
      responseBox,
      {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          "class"
        ]
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Question Button
  |--------------------------------------------------------------------------
  */

  function bindQuestionButton() {
    const questionButton =
      getQuestionButton();

    if (
      !questionButton
    ) {
      return;
    }

    questionButton.addEventListener(
      "click",
      function () {

        /*
         * Run just after the widget's own
         * question click handler begins.
         */

        window.setTimeout(
          function () {
            startProcessing();
          },
          0
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Topic Buttons
  |--------------------------------------------------------------------------
  */

  function bindTopicButtons() {
    const topicButtons =
      document.querySelectorAll(
        ".gfloor-topic-button"
      );

    topicButtons.forEach(
      function (
        button
      ) {
        button.addEventListener(
          "click",
          function () {

            /*
             * Topic clicks may immediately
             * provide an answer or update the
             * question flow.
             */

            window.setTimeout(
              function () {

                const responseBox =
                  getResponseBox();

                if (
                  responseIsVisible(
                    responseBox
                  )
                ) {
                  stopProcessing();

                  return;
                }

                startProcessing();
              },
              0
            );
          }
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Panel Open State
  |--------------------------------------------------------------------------
  */

  function observePanel() {
    const panel =
      getPanel();

    if (
      !panel
    ) {
      return;
    }

    const observer =
      new MutationObserver(
        function () {

          if (
            panel.classList.contains(
              "open"
            )
          ) {
            animateWelcomeMascot();
          } else {
            stopProcessing();
          }
        }
      );

    observer.observe(
      panel,
      {
        attributes: true,
        attributeFilter: [
          "class"
        ]
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Launcher Click
  |--------------------------------------------------------------------------
  */

  function bindLauncher() {
    const launcher =
      getLauncher();

    if (
      !launcher
    ) {
      return;
    }

    launcher.addEventListener(
      "click",
      function () {

        window.setTimeout(
          function () {

            const panel =
              getPanel();

            if (
              panel &&
              panel.classList.contains(
                "open"
              )
            ) {
              animateWelcomeMascot();
            }
          },
          50
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Human / Contact View Safety
  |--------------------------------------------------------------------------
  |
  | If customer switches to live-agent mode,
  | stop the thinking mascot.
  |--------------------------------------------------------------------------
  */

  function bindCustomerServiceButtons() {
    const selectors = [
      "#gfloor-human-button",
      "#gfloor-connect-button",
      "#gfloor-human-back-button",
      "#gfloor-contact-back-button",
      "#gfloor-stay-chat-button"
    ];

    selectors.forEach(
      function (
        selector
      ) {
        const element =
          document.querySelector(
            selector
          );

        if (
          !element
        ) {
          return;
        }

        element.addEventListener(
          "click",
          function () {
            stopProcessing();
          }
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Initialize
  |--------------------------------------------------------------------------
  */

  function initializeMascot() {
    if (
      state.initialized
    ) {
      return true;
    }

    const launcher =
      getLauncher();

    const panel =
      getPanel();

    const homeView =
      getHomeView();

    const questionButton =
      getQuestionButton();

    const responseBox =
      getResponseBox();

    if (
      !launcher ||
      !panel ||
      !homeView ||
      !questionButton ||
      !responseBox
    ) {
      return false;
    }

    addStyles();

    enhanceLauncher();

    createWelcomeMascot();

    createProcessingMascot();

    bindLauncher();

    bindQuestionButton();

    bindTopicButtons();

    bindCustomerServiceButtons();

    observePanel();

    observeResponseBox();

    state.initialized =
      true;

    console.log(
      "G-Floor chat mascot loaded:",
      {
        version:
          MASCOT_VERSION,

        welcomeImage:
          WELCOME_MASCOT_URL,

        thinkingImage:
          THINKING_MASCOT_URL
      }
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization Retry
  |--------------------------------------------------------------------------
  |
  | widget.js dynamically creates its HTML.
  | This lets mascot.js safely wait until
  | the widget exists.
  |--------------------------------------------------------------------------
  */

  function attemptInitialization() {
    if (
      initializeMascot()
    ) {
      return;
    }

    state.initAttempts +=
      1;

    if (
      state.initAttempts >=
      MAX_INIT_ATTEMPTS
    ) {
      console.warn(
        "G-Floor mascot could not initialize because the chat widget was not found."
      );

      return;
    }

    window.setTimeout(
      attemptInitialization,
      INIT_RETRY_DELAY
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
      attemptInitialization
    );
  } else {
    attemptInitialization();
  }

})();