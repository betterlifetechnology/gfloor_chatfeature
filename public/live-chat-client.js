(function () {
  "use strict";

  const panel = document.querySelector("#gfloor-chat-panel");
  if (!panel) return;

  const form = panel.querySelector("#gfloor-chat-form");
  const contactView = panel.querySelector("#gfloor-contact-view");
  const result = panel.querySelector("#gfloor-chat-result");
  const conversationIdElement = panel.querySelector(".gfloor-conversation-id");
  if (!form || !contactView || !conversationIdElement) return;

  const API_BASE = "https://gfloor-chatfeature.onrender.com";
  const STATUS_URL = API_BASE + "/chat/status";
  const LIVE_URL = API_BASE + "/chat/live";
  const STORAGE_KEY = "gfloorActiveLiveConversation";

  let activeSession = null;
  let pollTimer = null;
  let lastMessageId = 0;

  const style = document.createElement("style");
  style.textContent = `
    #gfloor-live-view{display:none}.gfloor-live-status{padding:11px 12px;margin-bottom:12px;border-radius:7px;background:#f2f3f4;font-size:13px;line-height:1.45}.gfloor-live-status.waiting{border-left:4px solid #d79b00}.gfloor-live-status.active{border-left:4px solid #16733c}.gfloor-live-status.closed{border-left:4px solid #69727b}.gfloor-live-messages{display:flex;flex-direction:column;gap:9px;max-height:290px;overflow-y:auto;padding:3px 2px 10px}.gfloor-live-message{max-width:85%;padding:9px 11px;border-radius:9px;background:#f0f2f4;font-size:13px;line-height:1.45;white-space:pre-wrap}.gfloor-live-message.customer{align-self:flex-end;background:#333e48;color:#fff}.gfloor-live-message.agent{align-self:flex-start;background:#f0f2f4;color:#222}.gfloor-live-message.system{align-self:center;max-width:100%;padding:4px;background:transparent;color:#777;font-size:11px;text-align:center}.gfloor-live-message-name{display:block;margin-bottom:3px;font-size:10px;font-weight:700;opacity:.75}.gfloor-live-reply{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px}.gfloor-live-reply textarea{width:100%;min-height:54px;resize:vertical;border:1px solid #b7b7b7;border-radius:6px;padding:9px;font:14px Arial,sans-serif}.gfloor-live-reply button{align-self:end;border:0;border-radius:6px;padding:10px 12px;background:#d2232a;color:#fff;font-weight:700;cursor:pointer}.gfloor-live-reference{margin-top:8px;color:#777;font-size:10px}
  `;
  document.head.appendChild(style);

  const liveView = document.createElement("div");
  liveView.id = "gfloor-live-view";
  liveView.innerHTML = `
    <div id="gfloor-live-status" class="gfloor-live-status waiting">Connecting you with Customer Service…</div>
    <div id="gfloor-live-messages" class="gfloor-live-messages" aria-live="polite"></div>
    <form id="gfloor-live-reply" class="gfloor-live-reply">
      <textarea id="gfloor-live-input" aria-label="Message to Customer Service" placeholder="Type your message…" required></textarea>
      <button type="submit">Send</button>
    </form>
    <div id="gfloor-live-reference" class="gfloor-live-reference"></div>
  `;
  contactView.appendChild(liveView);

  const liveStatus = liveView.querySelector("#gfloor-live-status");
  const liveMessages = liveView.querySelector("#gfloor-live-messages");
  const liveReply = liveView.querySelector("#gfloor-live-reply");
  const liveInput = liveView.querySelector("#gfloor-live-input");
  const liveReference = liveView.querySelector("#gfloor-live-reference");

  function saveSession() {
    if (!activeSession) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(activeSession));
  }

  function loadSession() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (stored && stored.conversationId && stored.token) return stored;
    } catch (error) {
      return null;
    }
    return null;
  }

  function showLiveView() {
    Array.from(contactView.children).forEach(function (child) {
      if (child !== liveView && child.tagName !== "BUTTON") child.style.display = "none";
    });
    liveView.style.display = "block";
    liveReference.textContent = activeSession ? "Reference: " + activeSession.conversationId : "";
  }

  function formatMessage(message) {
    const wrapper = document.createElement("div");
    wrapper.className = "gfloor-live-message " + message.sender_type;

    if (message.sender_type !== "system") {
      const name = document.createElement("span");
      name.className = "gfloor-live-message-name";
      name.textContent = message.sender_name || (message.sender_type === "agent" ? "Customer Service" : "You");
      wrapper.appendChild(name);
    }

    const text = document.createElement("span");
    text.textContent = message.message;
    wrapper.appendChild(text);
    return wrapper;
  }

  function appendMessages(messages) {
    let appended = false;
    (messages || []).forEach(function (message) {
      const id = Number(message.id) || 0;
      if (id <= lastMessageId) return;
      lastMessageId = Math.max(lastMessageId, id);
      liveMessages.appendChild(formatMessage(message));
      appended = true;
    });
    if (appended) liveMessages.scrollTop = liveMessages.scrollHeight;
  }

  function updateStatus(conversation) {
    if (!conversation) return;

    if (conversation.status === "waiting") {
      liveStatus.className = "gfloor-live-status waiting";
      liveStatus.textContent = "You're in the live support queue. A Customer Service representative will join shortly.";
      liveReply.hidden = true;
    } else if (conversation.status === "active") {
      liveStatus.className = "gfloor-live-status active";
      liveStatus.textContent = "You're connected with " + (conversation.assignedAgentName || "G-Floor Customer Service") + ".";
      liveReply.hidden = false;
    } else {
      liveStatus.className = "gfloor-live-status closed";
      liveStatus.textContent = "This live conversation has ended. If you still need help, you can start a new Customer Service request.";
      liveReply.hidden = true;
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function pollConversation() {
    if (!activeSession) return;
    try {
      const url = LIVE_URL + "/" + encodeURIComponent(activeSession.conversationId) + "?token=" + encodeURIComponent(activeSession.token) + "&after=" + encodeURIComponent(lastMessageId);
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Conversation could not be loaded.");
      updateStatus(data.conversation);
      appendMessages(data.messages);
    } catch (error) {
      console.error("G-Floor live chat poll error:", error);
    }
  }

  function startPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollConversation();
    pollTimer = window.setInterval(pollConversation, 1800);
  }

  async function startLiveChat(details) {
    try {
      const statusResponse = await fetch(STATUS_URL);
      const support = await statusResponse.json();
      if (!statusResponse.ok || !support.liveAgentAvailable) return;

      const response = await fetch(LIVE_URL + "/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details)
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status !== 409) console.error("G-Floor live chat request error:", data.error);
        return;
      }

      activeSession = {
        conversationId: data.conversationId,
        token: data.customerToken
      };
      saveSession();
      lastMessageId = 0;
      showLiveView();
      liveStatus.className = "gfloor-live-status waiting";
      liveStatus.textContent = "You're in the live support queue. A Customer Service representative will join shortly.";
      liveReply.hidden = true;
      startPolling();
    } catch (error) {
      console.error("G-Floor live chat start error:", error);
    }
  }

  form.addEventListener("submit", function () {
    const conversationId = String(conversationIdElement.textContent || "").trim();
    const name = String(form.name && form.name.value || "").trim();
    const email = String(form.email && form.email.value || "").trim();
    const phone = String(form.phone && form.phone.value || "").trim();
    const message = String(form.message && form.message.value || "").trim();

    if (!conversationId || !name || !email || !phone || !message) return;

    startLiveChat({
      conversationId: conversationId,
      name: name,
      email: email,
      phone: phone,
      message: message,
      pageUrl: window.location.href,
      pageTitle: document.title
    });
  });

  liveReply.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!activeSession) return;

    const message = liveInput.value.trim();
    if (!message) return;

    const button = liveReply.querySelector("button");
    button.disabled = true;
    try {
      const response = await fetch(LIVE_URL + "/" + encodeURIComponent(activeSession.conversationId) + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activeSession.token, message: message })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      liveInput.value = "";
      appendMessages([data.message]);
      pollConversation();
    } catch (error) {
      window.alert(error.message);
    } finally {
      button.disabled = false;
      liveInput.focus();
    }
  });

  liveInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (liveInput.value.trim()) liveReply.requestSubmit();
    }
  });

  activeSession = loadSession();
  if (activeSession) {
    showLiveView();
    startPolling();
  }
})();
