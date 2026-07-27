(function () {
  const API_BASE_URL =
    "https://gfloor-chatfeature.onrender.com";

  const MESSAGE_API_URL =
    API_BASE_URL + "/chat/message";

  const STATUS_API_URL =
    API_BASE_URL + "/chat/status";

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
      margin-bottom: 5px;
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

    .gfloor-form-note {
      margin: 0 0 14px;
      font-size: 14px;
      line-height: 1.5;
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

      </div>

      <div
        id="gfloor-contact-view"
        hidden
      >

        <button
          id="gfloor-back-button"
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
          class="gfloor-status-box loading"
          role="status"
          aria-live="polite"
        >
          Checking Customer Service availability...
        </div>

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

  const backButton =
    panel.querySelector(
      "#gfloor-back-button"
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

  let lastQuestion = "";

  let currentSupportStatus = {
    liveAgentAvailable: false,
    estimatedWaitMinutes: null
  };

  /*
  |--------------------------------------------------------------------------
  | Panel Controls
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
  }

  function showHome() {
    homeView.hidden = false;
    contactView.hidden = true;

    setTimeout(function () {
      chatBody.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }, 50);
  }

  /*
  |--------------------------------------------------------------------------
  | Server Availability Check
  |--------------------------------------------------------------------------
  */

  async function getAgentAvailability() {
    agentStatus.className =
      "gfloor-status-box loading";

    agentStatus.textContent =
      "Checking Customer Service availability...";

    try {
      const response =
        await fetch(
          STATUS_API_URL,
          {
            method: "GET",
            headers: {
              "Accept":
                "application/json"
            }
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Availability could not be checked."
        );
      }

      currentSupportStatus = {
        liveAgentAvailable:
          data.liveAgentAvailable === true,

        estimatedWaitMinutes:
          data.estimatedWaitMinutes
      };

      if (
        currentSupportStatus
          .liveAgentAvailable
      ) {
        agentStatus.className =
          "gfloor-status-box available";
      } else {
        agentStatus.className =
          "gfloor-status-box offline";
      }

      agentStatus.textContent =
        data.message;

      return currentSupportStatus;
    } catch (error) {
      console.error(
        "G-Floor availability error:",
        error
      );

      currentSupportStatus = {
        liveAgentAvailable: false,
        estimatedWaitMinutes: null
      };

      agentStatus.className =
        "gfloor-status-box offline";

      agentStatus.textContent =
        "Customer Service availability could not be checked right now. Live support hours are Monday-Friday, 8 AM-5 PM Central Time.";

      return currentSupportStatus;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Customer Service Form
  |--------------------------------------------------------------------------
  */

  async function showContactForm(
    prefilledMessage
  ) {
    homeView.hidden = true;
    contactView.hidden = false;

    if (prefilledMessage) {
      messageField.value =
        prefilledMessage;
    }

    chatBody.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    await getAgentAvailability();

    setTimeout(function () {
      const firstField =
        panel.querySelector(
          "#gfloor-chat-name"
        );

      if (firstField) {
        firstField.focus();
      }
    }, 100);
  }

  /*
  |--------------------------------------------------------------------------
  | Temporary Topic Answers
  |--------------------------------------------------------------------------
  */

  function getTopicResponse(topic) {
    const responses = {
      flooring:
        "We can help you choose the right G-Floor product based on where the flooring will be used. This section will be connected to the approved G-Floor product guidance knowledge base.",

      installation:
        "We can help with installation questions including subfloor preparation, adhesive, trimming, seams, and installation methods. Approved installation answers will be added to the knowledge base.",

      shipping:
        "We can help with shipping and delivery questions. Approved shipping timelines, freight information, and delivery guidance will be added here.",

      order:
        "For help with an existing order, Customer Service may need your order details. You can connect with a representative below.",

      cleaning:
        "We can help with cleaning and maintenance questions. Approved care and maintenance guidance will be added to the chat knowledge base.",

      warranty:
        "We can help with warranty and return questions. Some warranty or return situations may need to be reviewed by Customer Service.",

      other:
        "Please type your question below and we'll help point you in the right direction."
    };

    return responses[topic] ||
      responses.other;
  }

  /*
  |--------------------------------------------------------------------------
  | Response Display
  |--------------------------------------------------------------------------
  */

  function scrollToResponse() {
    setTimeout(function () {
      responseBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });

      setTimeout(function () {
        helpfulActions.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }, 150);
    }, 100);
  }

  function showResponse(message) {
    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      ${message}

      <div
        style="
          margin-top:10px;
          font-weight:700;
        "
      >
        Did this answer your question?
      </div>
    `;

    responseBox.classList.add(
      "show"
    );

    helpfulActions.classList.add(
      "show"
    );

    scrollToResponse();
  }

  /*
  |--------------------------------------------------------------------------
  | Open / Close
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
      togglePanel(false);
      button.focus();
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Topic Buttons
  |--------------------------------------------------------------------------
  */

  topicButtons.forEach(
    function (topicButton) {
      topicButton.addEventListener(
        "click",
        function () {
          const topic =
            topicButton.dataset.topic;

          lastQuestion =
            topicButton.textContent.trim();

          showResponse(
            getTopicResponse(topic)
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
      const question =
        questionInput.value.trim();

      if (!question) {
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
        question;

      showResponse(
        "Thanks for your question. Our approved automated answer library is still being built. For now, you can connect with Customer Service for help with this question."
      );
    }
  );

  questionInput.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        questionSubmit.click();
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
      responseBox.innerHTML = `
        <span class="gfloor-response-title">
          Glad we could help!
        </span>

        You can choose another topic or ask another question anytime.
      `;

      helpfulActions.classList.remove(
        "show"
      );
    }
  );

  helpfulNo.addEventListener(
    "click",
    function () {
      showContactForm(
        lastQuestion
      );
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Human Support Button
  |--------------------------------------------------------------------------
  */

  humanButton.addEventListener(
    "click",
    function () {
      showContactForm(
        lastQuestion
      );
    }
  );

  backButton.addEventListener(
    "click",
    function () {
      showHome();
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Form Submission
  |--------------------------------------------------------------------------
  */

  form.addEventListener(
    "submit",
    async function (event) {
      event.preventDefault();

      result.textContent = "";

      submitButton.disabled = true;

      submitButton.textContent =
        "Sending...";

      /*
       * Check availability again immediately
       * before submitting.
       */

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
            .liveAgentAvailable
      };

      try {
        const response =
          await fetch(
            MESSAGE_API_URL,
            {
              method: "POST",

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

        let data = {};

        try {
          data =
            await response.json();
        } catch (jsonError) {
          data = {};
        }

        if (!response.ok) {
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
        event.key === "Escape" &&
        panel.classList.contains(
          "open"
        )
      ) {
        togglePanel(false);

        button.focus();
      }
    }
  );
})();