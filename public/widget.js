(function () {
  const API_URL = "https://gfloor-chatfeature.onrender.com/chat/message";

  const style = document.createElement("style");
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
      width: min(380px, calc(100vw - 32px));
      max-height: calc(100vh - 110px);
      overflow-y: auto;
      box-sizing: border-box;
      border-radius: 12px;
      background: #ffffff;
      color: #222222;
      box-shadow: 0 8px 30px rgba(0,0,0,.28);
      font-family: Arial, sans-serif;
    }

    #gfloor-chat-panel.open {
      display: block;
    }

    .gfloor-chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #333e48;
      color: #ffffff;
      border-radius: 12px 12px 0 0;
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
    }

    .gfloor-chat-body p {
      margin: 0 0 14px;
      font-size: 14px;
      line-height: 1.5;
    }

    .gfloor-chat-field {
      margin-bottom: 12px;
    }

    .gfloor-chat-field label {
      display: block;
      margin-bottom: 5px;
      font-size: 13px;
      font-weight: 700;
    }

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

    .gfloor-chat-field textarea {
      min-height: 100px;
      resize: vertical;
    }

    .gfloor-live-agent {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 4px 0 12px;
      font-size: 14px;
      line-height: 1.4;
    }

    .gfloor-live-agent input {
      margin-top: 3px;
    }

    #gfloor-agent-status {
      padding: 10px;
      margin-bottom: 12px;
      border-radius: 6px;
      background: #f2f3f4;
      font-size: 13px;
      line-height: 1.4;
    }

    #gfloor-chat-submit {
      width: 100%;
      border: 0;
      border-radius: 6px;
      padding: 12px;
      background: #d2232a;
      color: #ffffff;
      font: 700 15px Arial, sans-serif;
      cursor: pointer;
    }

    #gfloor-chat-submit:disabled {
      opacity: .65;
      cursor: wait;
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
      }
    }
  `;

  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "gfloor-chat-panel";
  panel.setAttribute("aria-label", "G-Floor customer support chat");

  panel.innerHTML = `
    <div class="gfloor-chat-header">
      <strong>Chat with G-Floor</strong>
      <button id="gfloor-chat-close" type="button" aria-label="Close chat">&times;</button>
    </div>

    <div class="gfloor-chat-body">
      <p>Send our Customer Service team a message. All fields are required.</p>

      <form id="gfloor-chat-form">
        <div class="gfloor-chat-field">
          <label for="gfloor-chat-name">Name</label>
          <input id="gfloor-chat-name" name="name" type="text" required>
        </div>

        <div class="gfloor-chat-field">
          <label for="gfloor-chat-email">Email</label>
          <input id="gfloor-chat-email" name="email" type="email" required>
        </div>

        <div class="gfloor-chat-field">
          <label for="gfloor-chat-phone">Phone</label>
          <input id="gfloor-chat-phone" name="phone" type="tel" required>
        </div>

        <div class="gfloor-chat-field">
          <label for="gfloor-chat-message">How can we help?</label>
          <textarea id="gfloor-chat-message" name="message" required></textarea>
        </div>

        <label class="gfloor-live-agent">
          <input id="gfloor-live-agent" name="requestedLiveAgent" type="checkbox">
          <span>I would like to speak with a live agent.</span>
        </label>

        <div id="gfloor-agent-status" hidden></div>

        <button id="gfloor-chat-submit" type="submit">Send Message</button>
        <div id="gfloor-chat-result" role="status" aria-live="polite"></div>
      </form>
    </div>
  `;

  const button = document.createElement("button");
  button.id = "gfloor-chat-button";
  button.type = "button";
  button.textContent = "Chat with us";
  button.setAttribute("aria-expanded", "false");

  document.body.appendChild(panel);
  document.body.appendChild(button);

  const closeButton = panel.querySelector("#gfloor-chat-close");
  const form = panel.querySelector("#gfloor-chat-form");
  const liveAgent = panel.querySelector("#gfloor-live-agent");
  const agentStatus = panel.querySelector("#gfloor-agent-status");
  const submitButton = panel.querySelector("#gfloor-chat-submit");
  const result = panel.querySelector("#gfloor-chat-result");

  function togglePanel(open) {
    panel.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  }

  function getAgentAvailability() {
    const centralTime = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "America/Chicago"
      })
    );

    const day = centralTime.getDay();
    const hour = centralTime.getHours();
    const isWeekday = day >= 1 && day <= 5;
    const isOpen = isWeekday && hour >= 8 && hour < 17;

    if (isOpen) {
      return {
        open: true,
        message:
          "Live agents are available Monday–Friday, 8 AM–5 PM CT. Estimated wait time: approximately 5–10 minutes."
      };
    }

    return {
      open: false,
      message:
        "Live agents are currently unavailable. Business hours are Monday–Friday, 8 AM–5 PM CT. Your message will be reviewed during the next business day."
    };
  }

  button.addEventListener("click", function () {
    togglePanel(!panel.classList.contains("open"));
  });

  closeButton.addEventListener("click", function () {
    togglePanel(false);
  });

  liveAgent.addEventListener("change", function () {
    if (!liveAgent.checked) {
      agentStatus.hidden = true;
      return;
    }

    const availability = getAgentAvailability();
    agentStatus.textContent = availability.message;
    agentStatus.hidden = false;
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    result.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      message: form.message.value.trim(),
      pageUrl: window.location.href,
      pageTitle: document.title,
      requestedLiveAgent: liveAgent.checked
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Message could not be sent.");
      }

      result.style.color = "#16733c";
      result.textContent =
        "Thank you. Your message has been sent to G-Floor Customer Service.";

      form.reset();
      agentStatus.hidden = true;
    } catch (error) {
      result.style.color = "#b42318";
      result.textContent =
        "Email delivery is not active yet. Please try again later or contact Customer Service directly.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send Message";
    }
  });
})();