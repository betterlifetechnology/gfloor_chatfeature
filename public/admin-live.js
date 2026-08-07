(function () {
  "use strict";

  const API = "/admin/live/api";
  const TOKEN_KEY = "gfloorLiveAdminToken";
  const AGENT_NAME_KEY = "gfloorLiveAgentName";
  const AGENT_ID_KEY = "gfloorLiveAgentId";

  const loginScreen = document.querySelector("#login-screen");
  const loginForm = document.querySelector("#login-form");
  const loginError = document.querySelector("#login-error");
  const app = document.querySelector("#app");
  const agentNameInput = document.querySelector("#agent-name");
  const adminTokenInput = document.querySelector("#admin-token");
  const logoutButton = document.querySelector("#logout-button");
  const agentLabel = document.querySelector("#agent-label");
  const presenceDot = document.querySelector("#presence-dot");
  const presenceLabel = document.querySelector("#presence-label");
  const waitingCount = document.querySelector("#waiting-count");
  const activeCount = document.querySelector("#active-count");
  const conversationList = document.querySelector("#conversation-list");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const emptyState = document.querySelector("#empty-state");
  const chatView = document.querySelector("#chat-view");
  const conversationStatus = document.querySelector("#conversation-status");
  const conversationIdLabel = document.querySelector("#conversation-id");
  const customerName = document.querySelector("#customer-name");
  const customerMeta = document.querySelector("#customer-meta");
  const pageContext = document.querySelector("#page-context");
  const messagesElement = document.querySelector("#messages");
  const acceptButton = document.querySelector("#accept-button");
  const closeButton = document.querySelector("#close-button");
  const replyForm = document.querySelector("#reply-form");
  const replyInput = document.querySelector("#reply-input");

  let token = sessionStorage.getItem(TOKEN_KEY) || "";
  let agentName = localStorage.getItem(AGENT_NAME_KEY) || "";
  let agentId = localStorage.getItem(AGENT_ID_KEY) || "";
  let conversations = [];
  let activeTab = "waiting";
  let selectedConversationId = "";
  let lastMessageId = 0;
  let refreshTimer = null;
  let heartbeatTimer = null;
  let messageTimer = null;

  if (!agentId) {
    agentId = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : "agent-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(AGENT_ID_KEY, agentId);
  }

  agentNameInput.value = agentName;

  function api(path, options) {
    const requestOptions = Object.assign({}, options || {});
    requestOptions.headers = Object.assign({}, requestOptions.headers || {}, {
      "X-Admin-Token": token
    });

    if (requestOptions.body && typeof requestOptions.body !== "string") {
      requestOptions.headers["Content-Type"] = "application/json";
      requestOptions.body = JSON.stringify(requestOptions.body);
    }

    return fetch(API + path, requestOptions).then(async function (response) {
      let data = {};
      try {
        data = await response.json();
      } catch (error) {
        data = {};
      }

      if (!response.ok) {
        const apiError = new Error(data.error || "Request failed.");
        apiError.status = response.status;
        throw apiError;
      }

      return data;
    });
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric"
    }).format(date);
  }

  function setLoggedIn(loggedIn) {
    loginScreen.hidden = loggedIn;
    app.hidden = !loggedIn;

    if (loggedIn) {
      agentLabel.textContent = agentName;
      startTimers();
    } else {
      stopTimers();
    }
  }

  function stopTimers() {
    [refreshTimer, heartbeatTimer, messageTimer].forEach(function (timer) {
      if (timer) window.clearInterval(timer);
    });
    refreshTimer = null;
    heartbeatTimer = null;
    messageTimer = null;
  }

  function startTimers() {
    stopTimers();
    heartbeat();
    refreshConversations();
    heartbeatTimer = window.setInterval(heartbeat, 15000);
    refreshTimer = window.setInterval(refreshConversations, 2500);
    messageTimer = window.setInterval(function () {
      if (selectedConversationId) loadSelectedConversation(true);
    }, 1800);
  }

  async function heartbeat() {
    try {
      const status = await api("/presence", {
        method: "POST",
        body: { agentId: agentId, agentName: agentName }
      });
      presenceDot.classList.toggle("online", Boolean(status.liveAgentAvailable));
      presenceLabel.textContent = status.liveAgentAvailable
        ? "Live support online"
        : "Outside live support hours";
    } catch (error) {
      presenceDot.classList.remove("online");
      presenceLabel.textContent = "Connection problem";
      if (error.status === 401) signOut();
    }
  }

  function renderConversationList() {
    const filtered = conversations.filter(function (item) {
      return item.status === activeTab;
    });

    conversationList.textContent = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "list-empty";
      empty.textContent = activeTab === "waiting"
        ? "No customers are waiting right now."
        : activeTab === "active"
          ? "No active conversations."
          : "No recently closed conversations.";
      conversationList.appendChild(empty);
      return;
    }

    filtered.forEach(function (item) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-card" + (item.conversation_id === selectedConversationId ? " selected" : "");

      const top = document.createElement("div");
      top.className = "conversation-card-top";
      const name = document.createElement("strong");
      name.textContent = item.customer_name;
      const time = document.createElement("span");
      time.className = "conversation-card-time";
      time.textContent = formatTime(item.status === "closed" ? item.closed_at : item.requested_at);
      top.append(name, time);

      const preview = document.createElement("p");
      preview.textContent = item.initial_message;

      const status = document.createElement("span");
      status.className = "mini-status " + item.status;
      status.textContent = item.status === "active" && item.assigned_agent_name
        ? "Active · " + item.assigned_agent_name
        : item.status;

      button.append(top, preview, status);
      button.addEventListener("click", function () {
        selectedConversationId = item.conversation_id;
        lastMessageId = 0;
        renderConversationList();
        loadSelectedConversation(false);
      });

      conversationList.appendChild(button);
    });
  }

  async function refreshConversations() {
    try {
      const data = await api("/conversations");
      conversations = data.conversations || [];
      waitingCount.textContent = String(conversations.filter(function (item) { return item.status === "waiting"; }).length);
      activeCount.textContent = String(conversations.filter(function (item) { return item.status === "active"; }).length);
      renderConversationList();
    } catch (error) {
      if (error.status === 401) signOut();
    }
  }

  function renderConversationHeader(conversation) {
    conversationStatus.textContent = conversation.status;
    conversationStatus.className = "status-badge" + (conversation.status === "active" ? " active" : conversation.status === "closed" ? " closed" : "");
    conversationIdLabel.textContent = conversation.conversation_id;
    customerName.textContent = conversation.customer_name;
    customerMeta.textContent = "";

    [conversation.customer_email, conversation.customer_phone].filter(Boolean).forEach(function (value) {
      const span = document.createElement("span");
      span.textContent = value;
      customerMeta.appendChild(span);
    });

    pageContext.textContent = "";
    if (conversation.page_url || conversation.page_title) {
      pageContext.hidden = false;
      const text = document.createElement("span");
      text.textContent = "Customer page: " + (conversation.page_title || conversation.page_url || "");
      pageContext.appendChild(text);
      if (conversation.page_url) {
        pageContext.appendChild(document.createTextNode(" · "));
        const link = document.createElement("a");
        link.href = conversation.page_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open page";
        pageContext.appendChild(link);
      }
    } else {
      pageContext.hidden = true;
    }

    acceptButton.hidden = conversation.status !== "waiting";
    closeButton.hidden = conversation.status === "closed";
    replyForm.hidden = conversation.status !== "active";
  }

  function appendMessages(messages, replace) {
    const shouldStick = messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight < 100;
    if (replace) messagesElement.textContent = "";

    messages.forEach(function (message) {
      const id = Number(message.id) || 0;
      if (!replace && id <= lastMessageId) return;
      lastMessageId = Math.max(lastMessageId, id);

      const wrapper = document.createElement("div");
      wrapper.className = "message " + message.sender_type;

      if (message.sender_type !== "system") {
        const name = document.createElement("span");
        name.className = "message-name";
        name.textContent = message.sender_name || (message.sender_type === "agent" ? "Customer Service" : "Customer");
        wrapper.appendChild(name);
      }

      const text = document.createElement("div");
      text.className = "message-text";
      text.textContent = message.message;
      wrapper.appendChild(text);

      if (message.sender_type !== "system") {
        const time = document.createElement("span");
        time.className = "message-time";
        time.textContent = formatTime(message.created_at);
        wrapper.appendChild(time);
      }

      messagesElement.appendChild(wrapper);
    });

    if (replace || shouldStick) messagesElement.scrollTop = messagesElement.scrollHeight;
  }

  async function loadSelectedConversation(incremental) {
    if (!selectedConversationId) return;

    try {
      const suffix = incremental && lastMessageId ? "?after=" + encodeURIComponent(lastMessageId) : "";
      const data = await api("/conversations/" + encodeURIComponent(selectedConversationId) + suffix);
      emptyState.hidden = true;
      chatView.hidden = false;
      renderConversationHeader(data.conversation);
      appendMessages(data.messages || [], !incremental || lastMessageId === 0);
    } catch (error) {
      if (error.status === 401) signOut();
    }
  }

  async function acceptConversation() {
    if (!selectedConversationId) return;
    acceptButton.disabled = true;
    try {
      await api("/conversations/" + encodeURIComponent(selectedConversationId) + "/accept", {
        method: "POST",
        body: { agentId: agentId, agentName: agentName }
      });
      activeTab = "active";
      tabs.forEach(function (tab) { tab.classList.toggle("active", tab.dataset.status === activeTab); });
      lastMessageId = 0;
      await refreshConversations();
      await loadSelectedConversation(false);
      replyInput.focus();
    } catch (error) {
      window.alert(error.message);
    } finally {
      acceptButton.disabled = false;
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    const message = replyInput.value.trim();
    if (!message || !selectedConversationId) return;

    const submit = replyForm.querySelector("button[type='submit']");
    submit.disabled = true;
    try {
      await api("/conversations/" + encodeURIComponent(selectedConversationId) + "/messages", {
        method: "POST",
        body: { agentId: agentId, agentName: agentName, message: message }
      });
      replyInput.value = "";
      await loadSelectedConversation(true);
    } catch (error) {
      window.alert(error.message);
    } finally {
      submit.disabled = false;
      replyInput.focus();
    }
  }

  async function closeConversation() {
    if (!selectedConversationId) return;
    if (!window.confirm("Close this live conversation?")) return;

    try {
      await api("/conversations/" + encodeURIComponent(selectedConversationId) + "/close", {
        method: "POST",
        body: { agentName: agentName }
      });
      activeTab = "closed";
      tabs.forEach(function (tab) { tab.classList.toggle("active", tab.dataset.status === activeTab); });
      lastMessageId = 0;
      await refreshConversations();
      await loadSelectedConversation(false);
    } catch (error) {
      window.alert(error.message);
    }
  }

  function signOut() {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    selectedConversationId = "";
    conversations = [];
    messagesElement.textContent = "";
    chatView.hidden = true;
    emptyState.hidden = false;
    adminTokenInput.value = "";
    setLoggedIn(false);
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    loginError.textContent = "";

    agentName = agentNameInput.value.trim();
    token = adminTokenInput.value.trim();
    if (!agentName || !token) return;

    try {
      await api("/health");
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(AGENT_NAME_KEY, agentName);
      agentLabel.textContent = agentName;
      setLoggedIn(true);
    } catch (error) {
      token = "";
      loginError.textContent = error.status === 401 ? "The admin token is incorrect." : error.message;
    }
  });

  logoutButton.addEventListener("click", signOut);
  acceptButton.addEventListener("click", acceptConversation);
  closeButton.addEventListener("click", closeConversation);
  replyForm.addEventListener("submit", sendReply);

  replyInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (replyInput.value.trim()) replyForm.requestSubmit();
    }
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activeTab = tab.dataset.status;
      tabs.forEach(function (item) { item.classList.toggle("active", item === tab); });
      renderConversationList();
    });
  });

  if (token && agentName) {
    api("/health").then(function () {
      setLoggedIn(true);
    }).catch(function () {
      signOut();
    });
  }
})();
