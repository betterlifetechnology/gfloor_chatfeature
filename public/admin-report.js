(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Approved Knowledge Reporting Dashboard
  |--------------------------------------------------------------------------
  |
  | STEP 20J.4
  |
  |--------------------------------------------------------------------------
  */

  const VERSION = "20.15";

  const API = {
    health: "/admin/reporting/health",
    totals: "/admin/reporting/totals",
    knowledge: "/admin/reporting/knowledge",
    categories: "/admin/reporting/categories",
    daily: "/admin/reporting/daily",
    events: "/admin/reporting/events"
  };

  const SESSION_TOKEN_KEY =
    "gfloor_admin_reporting_token";

  const state = {
    token: "",
    page: 1,
    limit: 50,
    pages: 1,
    loading: false,
    totals: {},
    knowledge: [],
    categories: [],
    daily: [],
    events: []
  };

  const elements = {};

  /*
  |--------------------------------------------------------------------------
  | DOM Helpers
  |--------------------------------------------------------------------------
  */

  function getElement(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    elements.login =
      getElement("gfloor-report-login");

    elements.dashboard =
      getElement("gfloor-report-dashboard");

    elements.token =
      getElement("gfloor-report-token");

    elements.loginButton =
      getElement("gfloor-report-login-button");

    elements.loginMessage =
      getElement("gfloor-report-login-message");

    elements.apiStatus =
      getElement("gfloor-report-api-status");

    elements.refresh =
      getElement("gfloor-report-refresh");

    elements.disconnect =
      getElement("gfloor-report-disconnect");

    elements.startDate =
      getElement("gfloor-report-start-date");

    elements.endDate =
      getElement("gfloor-report-end-date");

    elements.categoryFilter =
      getElement("gfloor-report-category-filter");

    elements.search =
      getElement("gfloor-report-search");

    elements.apply =
      getElement("gfloor-report-apply");

    elements.reset =
      getElement("gfloor-report-reset");

    elements.export =
      getElement("gfloor-report-export");

    elements.message =
      getElement("gfloor-report-message");

    elements.lastUpdated =
      getElement("gfloor-report-last-updated");

    elements.totalAnswers =
      getElement("gfloor-report-total-answers");

    elements.helpfulYes =
      getElement("gfloor-report-helpful-yes");

    elements.helpfulNo =
      getElement("gfloor-report-helpful-no");

    elements.helpfulRate =
      getElement("gfloor-report-helpful-rate");

    elements.entriesUsed =
      getElement("gfloor-report-entries-used");

    elements.conversations =
      getElement("gfloor-report-conversations");

    elements.dailyChart =
      getElement("gfloor-report-daily-chart");

    elements.dailyEmpty =
      getElement("gfloor-report-daily-empty");

    elements.categoryBody =
      getElement("gfloor-report-category-body");

    elements.categoryEmpty =
      getElement("gfloor-report-category-empty");

    elements.knowledgeBody =
      getElement("gfloor-report-knowledge-body");

    elements.knowledgeEmpty =
      getElement("gfloor-report-knowledge-empty");

    elements.knowledgeCount =
      getElement("gfloor-report-knowledge-count");

    elements.eventsBody =
      getElement("gfloor-report-events-body");

    elements.eventsEmpty =
      getElement("gfloor-report-events-empty");

    elements.pagination =
      getElement("gfloor-report-pagination");

    elements.previous =
      getElement("gfloor-report-previous");

    elements.next =
      getElement("gfloor-report-next");

    elements.pageLabel =
      getElement("gfloor-report-page-label");
  }

  /*
  |--------------------------------------------------------------------------
  | General Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(value) {
    return String(
      value === null || value === undefined
        ? ""
        : value
    ).trim();
  }

  function escapeHtml(value) {
    return cleanText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function numberValue(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(
      "en-US"
    ).format(
      numberValue(value)
    );
  }

  function formatPercent(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "—";
    }

    return number.toFixed(2) + "%";
  }

  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Chicago",

        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",

        timeZoneName:
          "short"
      }
    ).format(date);
  }

  function formatShortDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(
      value + "T12:00:00"
    );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        month:
          "short",

        day:
          "numeric"
      }
    ).format(date);
  }

  function isoDate(date) {
    return date
      .toISOString()
      .slice(0, 10);
  }

  function setDefaultDates() {
    const end = new Date();
    const start = new Date();

    start.setDate(
      start.getDate() - 30
    );

    elements.startDate.value =
      isoDate(start);

    elements.endDate.value =
      isoDate(end);
  }

  function getFilters() {
    return {
      startDate:
        cleanText(
          elements.startDate.value
        ),

      endDate:
        cleanText(
          elements.endDate.value
        ),

      category:
        cleanText(
          elements.categoryFilter.value
        ),

      search:
        cleanText(
          elements.search.value
        )
    };
  }

  function buildQuery(parameters) {
    const searchParams =
      new URLSearchParams();

    Object.keys(parameters).forEach(
      function (key) {
        const value =
          parameters[key];

        if (
          value !== "" &&
          value !== null &&
          value !== undefined
        ) {
          searchParams.set(
            key,
            String(value)
          );
        }
      }
    );

    const query =
      searchParams.toString();

    return query
      ? "?" + query
      : "";
  }

  /*
  |--------------------------------------------------------------------------
  | Messages
  |--------------------------------------------------------------------------
  */

  function showMessage(
    message,
    success
  ) {
    elements.message.textContent =
      message;

    elements.message.classList.remove(
      "is-hidden",
      "is-success"
    );

    if (success) {
      elements.message.classList.add(
        "is-success"
      );
    }
  }

  function hideMessage() {
    elements.message.classList.add(
      "is-hidden"
    );
  }

  function setLoginMessage(message) {
    elements.loginMessage.textContent =
      message || "";
  }

  /*
  |--------------------------------------------------------------------------
  | Authentication
  |--------------------------------------------------------------------------
  */

  function getHeaders() {
    return {
      "X-Admin-Token":
        state.token,

      Accept:
        "application/json"
    };
  }

  async function requestJson(url) {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          credentials:
            "omit",

          cache:
            "no-store",

          headers:
            getHeaders()
        }
      );

    let result = null;

    try {
      result =
        await response.json();
    } catch (error) {
      result = null;
    }

    if (
      response.status === 401
    ) {
      disconnect();

      throw new Error(
        "The admin token is not authorized."
      );
    }

    if (!response.ok) {
      throw new Error(
        result && result.error
          ? result.error
          : "The reporting request failed."
      );
    }

    return result;
  }

  async function login() {
    const token =
      cleanText(
        elements.token.value
      );

    if (!token) {
      setLoginMessage(
        "Enter the ADMIN_TOKEN."
      );

      return;
    }

    elements.loginButton.disabled =
      true;

    setLoginMessage(
      "Checking access..."
    );

    state.token = token;

    try {
      const health =
        await requestJson(
          API.health
        );

      if (!health.success) {
        throw new Error(
          "The reporting database is not ready."
        );
      }

      sessionStorage.setItem(
        SESSION_TOKEN_KEY,
        token
      );

      elements.login.classList.add(
        "is-hidden"
      );

      elements.dashboard.classList.remove(
        "is-hidden"
      );

      setLoginMessage("");

      setApiStatus(
        true,
        "Reporting database connected"
      );

      await loadDashboard();
    } catch (error) {
      state.token = "";

      setLoginMessage(
        error.message
      );
    } finally {
      elements.loginButton.disabled =
        false;
    }
  }

  function disconnect() {
    state.token = "";

    sessionStorage.removeItem(
      SESSION_TOKEN_KEY
    );

    elements.token.value = "";

    elements.dashboard.classList.add(
      "is-hidden"
    );

    elements.login.classList.remove(
      "is-hidden"
    );

    setLoginMessage("");
  }

  async function restoreSession() {
    const storedToken =
      cleanText(
        sessionStorage.getItem(
          SESSION_TOKEN_KEY
        )
      );

    if (!storedToken) {
      return;
    }

    state.token = storedToken;

    elements.token.value =
      storedToken;

    await login();
  }

  /*
  |--------------------------------------------------------------------------
  | API Status
  |--------------------------------------------------------------------------
  */

  function setApiStatus(
    connected,
    message
  ) {
    elements.apiStatus.classList.remove(
      "is-connected",
      "is-error"
    );

    elements.apiStatus.classList.add(
      connected
        ? "is-connected"
        : "is-error"
    );

    const text =
      elements.apiStatus.querySelector(
        "span:last-child"
      );

    if (text) {
      text.textContent =
        message;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  function setLoading(loading) {
    state.loading = loading;

    [
      elements.refresh,
      elements.apply,
      elements.reset,
      elements.export,
      elements.previous,
      elements.next
    ].forEach(
      function (button) {
        if (button) {
          button.disabled = loading;
        }
      }
    );

    if (loading) {
      hideMessage();
      elements.lastUpdated.textContent =
        "Loading reporting data...";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Load Reporting Data
  |--------------------------------------------------------------------------
  */

  async function loadDashboard() {
    if (
      state.loading ||
      !state.token
    ) {
      return;
    }

    setLoading(true);

    const filters =
      getFilters();

    const dateQuery = {
      start_date:
        filters.startDate,

      end_date:
        filters.endDate
    };

    const knowledgeQuery = {
      start_date:
        filters.startDate,

      end_date:
        filters.endDate,

      category:
        filters.category,

      search:
        filters.search,

      page:
        state.page,

      limit:
        state.limit
    };

    try {
      const responses =
        await Promise.all([
          requestJson(
            API.totals +
            buildQuery(
              dateQuery
            )
          ),

          requestJson(
            API.categories +
            buildQuery(
              dateQuery
            )
          ),

          requestJson(
            API.daily +
            buildQuery(
              dateQuery
            )
          ),

          requestJson(
            API.knowledge +
            buildQuery(
              knowledgeQuery
            )
          ),

          requestJson(
            API.events +
            buildQuery({
              start_date:
                filters.startDate,

              end_date:
                filters.endDate,

              limit:
                50
            })
          )
        ]);

      state.totals =
        responses[0].totals || {};

      state.categories =
        responses[1].categories || [];

      state.daily =
        responses[2].daily || [];

      state.knowledge =
        responses[3].knowledge || [];

      state.events =
        responses[4].events || [];

      const pagination =
        responses[3].pagination || {};

      state.page =
        numberValue(
          pagination.page
        ) || 1;

      state.pages =
        numberValue(
          pagination.pages
        ) || 1;

      renderAll();

      setApiStatus(
        true,
        "Reporting database connected"
      );

      elements.lastUpdated.textContent =
        "Updated " +
        formatDateTime(
          new Date().toISOString()
        );
    } catch (error) {
      setApiStatus(
        false,
        "Reporting connection failed"
      );

      showMessage(
        error.message,
        false
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Summary Cards
  |--------------------------------------------------------------------------
  */

  function renderTotals() {
    elements.totalAnswers.textContent =
      formatNumber(
        state.totals.total_answers
      );

    elements.helpfulYes.textContent =
      formatNumber(
        state.totals.total_helpful_yes
      );

    elements.helpfulNo.textContent =
      formatNumber(
        state.totals.total_helpful_no
      );

    elements.helpfulRate.textContent =
      formatPercent(
        state.totals.helpful_rate
      );

    elements.entriesUsed.textContent =
      formatNumber(
        state.totals.knowledge_entries_used
      );

    elements.conversations.textContent =
      formatNumber(
        state.totals.conversations
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Categories
  |--------------------------------------------------------------------------
  */

  function renderCategoryFilter() {
    const currentValue =
      elements.categoryFilter.value;

    const categories =
      Array.from(
        new Set(
          state.categories.map(
            function (item) {
              return cleanText(
                item.category
              );
            }
          ).filter(Boolean)
        )
      ).sort();

    elements.categoryFilter.innerHTML =
      '<option value="">All Categories</option>';

    categories.forEach(
      function (category) {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          category;

        option.textContent =
          category;

        elements.categoryFilter.appendChild(
          option
        );
      }
    );

    if (
      categories.includes(
        currentValue
      )
    ) {
      elements.categoryFilter.value =
        currentValue;
    }
  }

  function rateClass(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "";
    }

    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return "";
    }

    if (number >= 80) {
      return "is-good";
    }

    if (number >= 60) {
      return "is-warning";
    }

    return "is-poor";
  }

  function renderCategories() {
    elements.categoryBody.innerHTML =
      "";

    const hasRows =
      state.categories.length > 0;

    elements.categoryEmpty.classList.toggle(
      "is-hidden",
      hasRows
    );

    if (!hasRows) {
      return;
    }

    state.categories.forEach(
      function (item) {
        const row =
          document.createElement(
            "tr"
          );

        row.innerHTML = `
          <td>
            <span class="gfloor-report-badge">
              ${escapeHtml(item.category || "Uncategorized")}
            </span>
          </td>

          <td>
            ${formatNumber(item.answer_count)}
          </td>

          <td>
            ${formatNumber(item.helpful_yes_count)}
          </td>

          <td>
            ${formatNumber(item.helpful_no_count)}
          </td>

          <td>
            ${formatNumber(item.feedback_count)}
          </td>

          <td>
            <span class="gfloor-report-rate ${rateClass(item.helpful_rate)}">
              ${formatPercent(item.helpful_rate)}
            </span>
          </td>
        `;

        elements.categoryBody.appendChild(
          row
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Knowledge Table
  |--------------------------------------------------------------------------
  */

  function renderKnowledge() {
    elements.knowledgeBody.innerHTML =
      "";

    const hasRows =
      state.knowledge.length > 0;

    elements.knowledgeEmpty.classList.toggle(
      "is-hidden",
      hasRows
    );

    elements.knowledgeCount.textContent =
      formatNumber(
        state.knowledge.length
      ) +
      (
        state.knowledge.length === 1
          ? " record"
          : " records"
      );

    if (!hasRows) {
      renderPagination();
      return;
    }

    state.knowledge.forEach(
      function (item) {
        const row =
          document.createElement(
            "tr"
          );

        row.innerHTML = `
          <td class="gfloor-report-question">
            ${escapeHtml(item.question || item.approved_knowledge_id || "Approved knowledge")}
            <div class="gfloor-report-id">
              ${escapeHtml(item.approved_knowledge_id || "")}
            </div>
          </td>

          <td>
            <span class="gfloor-report-badge">
              ${escapeHtml(item.category || "Uncategorized")}
            </span>
          </td>

          <td>
            ${escapeHtml(item.response_type || "AUTO")}
          </td>

          <td>
            ${formatNumber(item.answer_count)}
          </td>

          <td>
            ${formatNumber(item.helpful_yes_count)}
          </td>

          <td>
            ${formatNumber(item.helpful_no_count)}
          </td>

          <td>
            <span class="gfloor-report-rate ${rateClass(item.helpful_rate)}">
              ${formatPercent(item.helpful_rate)}
            </span>
          </td>

          <td>
            ${escapeHtml(formatDateTime(item.last_event_at))}
          </td>
        `;

        elements.knowledgeBody.appendChild(
          row
        );
      }
    );

    renderPagination();
  }

  function renderPagination() {
    const show =
      state.pages > 1;

    elements.pagination.classList.toggle(
      "is-hidden",
      !show
    );

    elements.pageLabel.textContent =
      "Page " +
      state.page +
      " of " +
      state.pages;

    elements.previous.disabled =
      state.loading ||
      state.page <= 1;

    elements.next.disabled =
      state.loading ||
      state.page >= state.pages;
  }

  /*
  |--------------------------------------------------------------------------
  | Daily Chart
  |--------------------------------------------------------------------------
  */

  function renderDaily() {
    elements.dailyChart.innerHTML =
      "";

    const hasRows =
      state.daily.length > 0;

    elements.dailyEmpty.classList.toggle(
      "is-hidden",
      hasRows
    );

    elements.dailyChart.classList.toggle(
      "is-hidden",
      !hasRows
    );

    if (!hasRows) {
      return;
    }

    const maximum =
      Math.max(
        1,
        ...state.daily.map(
          function (item) {
            return Math.max(
              numberValue(
                item.answer_count
              ),

              numberValue(
                item.helpful_yes_count
              ),

              numberValue(
                item.helpful_no_count
              )
            );
          }
        )
      );

    state.daily.forEach(
      function (item) {
        const answerHeight =
          Math.max(
            2,
            (
              numberValue(
                item.answer_count
              ) /
              maximum
            ) * 180
          );

        const yesHeight =
          Math.max(
            2,
            (
              numberValue(
                item.helpful_yes_count
              ) /
              maximum
            ) * 180
          );

        const noHeight =
          Math.max(
            2,
            (
              numberValue(
                item.helpful_no_count
              ) /
              maximum
            ) * 180
          );

        const day =
          document.createElement(
            "div"
          );

        day.className =
          "gfloor-report-day";

        day.innerHTML = `
          <div class="gfloor-report-day-bars">

            <div
              class="gfloor-report-bar gfloor-report-bar-answers"
              style="height:${answerHeight}px"
              title="Answers: ${formatNumber(item.answer_count)}"
            ></div>

            <div
              class="gfloor-report-bar gfloor-report-bar-yes"
              style="height:${yesHeight}px"
              title="Helpful Yes: ${formatNumber(item.helpful_yes_count)}"
            ></div>

            <div
              class="gfloor-report-bar gfloor-report-bar-no"
              style="height:${noHeight}px"
              title="Helpful No: ${formatNumber(item.helpful_no_count)}"
            ></div>

          </div>

          <div class="gfloor-report-day-label">
            ${escapeHtml(formatShortDate(item.report_date))}
          </div>

          <div class="gfloor-report-day-total">
            ${formatNumber(item.answer_count)} answers
          </div>
        `;

        elements.dailyChart.appendChild(
          day
        );
      }
    );

    const legend =
      document.createElement(
        "div"
      );

    legend.className =
      "gfloor-report-chart-legend";

    legend.innerHTML = `
      <span class="gfloor-report-legend-item">
        <span class="gfloor-report-legend-color gfloor-report-bar-answers"></span>
        Answers
      </span>

      <span class="gfloor-report-legend-item">
        <span class="gfloor-report-legend-color gfloor-report-bar-yes"></span>
        Helpful Yes
      </span>

      <span class="gfloor-report-legend-item">
        <span class="gfloor-report-legend-color gfloor-report-bar-no"></span>
        Helpful No
      </span>
    `;

    elements.dailyChart.appendChild(
      legend
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Recent Events
  |--------------------------------------------------------------------------
  */

  function friendlyEventName(
    eventType
  ) {
    const names = {
      approved_knowledge_answer:
        "Approved Answer",

      approved_knowledge_helpful_yes:
        "Helpful Yes",

      approved_knowledge_helpful_no:
        "Helpful No"
    };

    return names[eventType] ||
      eventType ||
      "Reporting Event";
  }

  function renderEvents() {
    elements.eventsBody.innerHTML =
      "";

    const hasRows =
      state.events.length > 0;

    elements.eventsEmpty.classList.toggle(
      "is-hidden",
      hasRows
    );

    if (!hasRows) {
      return;
    }

    state.events.forEach(
      function (item) {
        const row =
          document.createElement(
            "tr"
          );

        row.innerHTML = `
          <td>
            <span class="gfloor-report-badge">
              ${escapeHtml(friendlyEventName(item.event_type))}
            </span>
          </td>

          <td>
            ${escapeHtml(item.approved_knowledge_category || "Uncategorized")}
          </td>

          <td class="gfloor-report-id">
            ${escapeHtml(item.approved_knowledge_id || "")}
          </td>

          <td>
            ${escapeHtml(item.page_type || "—")}
          </td>

          <td>
            ${escapeHtml(item.product_handle || "—")}
          </td>

          <td>
            ${escapeHtml(formatDateTime(item.occurred_at))}
          </td>
        `;

        elements.eventsBody.appendChild(
          row
        );
      }
    );
  }

  function renderAll() {
    renderTotals();
    renderCategoryFilter();
    renderCategories();
    renderKnowledge();
    renderDaily();
    renderEvents();
  }

  /*
  |--------------------------------------------------------------------------
  | CSV Export
  |--------------------------------------------------------------------------
  */

  function csvCell(value) {
    const text =
      cleanText(value);

    return (
      '"' +
      text.replace(
        /"/g,
        '""'
      ) +
      '"'
    );
  }

  function exportCsv() {
    if (
      state.knowledge.length === 0
    ) {
      showMessage(
        "There are no approved knowledge records to export.",
        false
      );

      return;
    }

    const rows = [
      [
        "Approved Knowledge ID",
        "Approved Question",
        "Category",
        "Response Type",
        "Answers Served",
        "Helpful Yes",
        "Helpful No",
        "Feedback Count",
        "Helpful Rate",
        "First Used",
        "Last Used"
      ]
    ];

    state.knowledge.forEach(
      function (item) {
        rows.push([
          item.approved_knowledge_id,
          item.question,
          item.category,
          item.response_type,
          item.answer_count,
          item.helpful_yes_count,
          item.helpful_no_count,
          item.feedback_count,
          item.helpful_rate,
          item.first_event_at,
          item.last_event_at
        ]);
      }
    );

    const csv =
      rows.map(
        function (row) {
          return row
            .map(csvCell)
            .join(",");
        }
      ).join("\r\n");

    const blob =
      new Blob(
        [
          "\uFEFF",
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    const filters =
      getFilters();

    link.href =
      url;

    link.download =
      "gfloor-approved-knowledge-report-" +
      (
        filters.startDate ||
        "start"
      ) +
      "-to-" +
      (
        filters.endDate ||
        "end"
      ) +
      ".csv";

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    window.setTimeout(
      function () {
        URL.revokeObjectURL(
          url
        );
      },
      1000
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Event Listeners
  |--------------------------------------------------------------------------
  */

  function bindEvents() {
    elements.loginButton.addEventListener(
      "click",
      login
    );

    elements.token.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Enter"
        ) {
          login();
        }
      }
    );

    elements.refresh.addEventListener(
      "click",
      loadDashboard
    );

    elements.disconnect.addEventListener(
      "click",
      disconnect
    );

    elements.apply.addEventListener(
      "click",
      function () {
        state.page = 1;
        loadDashboard();
      }
    );

    elements.reset.addEventListener(
      "click",
      function () {
        setDefaultDates();

        elements.categoryFilter.value =
          "";

        elements.search.value =
          "";

        state.page = 1;

        loadDashboard();
      }
    );

    elements.export.addEventListener(
      "click",
      exportCsv
    );

    elements.previous.addEventListener(
      "click",
      function () {
        if (
          state.page <= 1
        ) {
          return;
        }

        state.page -= 1;
        loadDashboard();
      }
    );

    elements.next.addEventListener(
      "click",
      function () {
        if (
          state.page >= state.pages
        ) {
          return;
        }

        state.page += 1;
        loadDashboard();
      }
    );

    elements.search.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Enter"
        ) {
          state.page = 1;
          loadDashboard();
        }
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Initialize
  |--------------------------------------------------------------------------
  */

  async function initialize() {
    cacheElements();
    setDefaultDates();
    bindEvents();

    console.log(
      "G-Floor approved knowledge reporting dashboard loaded:",
      VERSION
    );

    await restoreSession();
  }

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