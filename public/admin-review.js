(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Knowledge Approval Dashboard
  |--------------------------------------------------------------------------
  |
  | STEP 20J.6F2
  |
  | Includes:
  |
  | - ADMIN_TOKEN authentication
  | - review health and counts
  | - pending / approved / denied filters
  | - review detail and editing
  | - Save Changes
  | - Approve
  | - Deny
  | - sensitive-information confirmation
  | - approved-knowledge activation counts
  | - approved-knowledge status lookup
  | - Deactivate Approved Knowledge
  | - Reactivate Approved Knowledge
  | - required status reviewer and reason
  | - confirmation dialog
  |
  |--------------------------------------------------------------------------
  */

  const VERSION = "20.16";
  const API_BASE = "/admin";
  const SESSION_TOKEN_KEY = "gfloor_admin_review_token";

  const state = {
    adminToken: "",
    reviews: [],
    selectedReviewId: null,
    selectedReview: null,
    selectedKnowledge: null,

    page: 1,
    pages: 1,
    limit: 25,
    total: 0,

    status: "pending-review",
    category: "",
    search: "",

    loading: false,
    saving: false,
    approving: false,
    denying: false,
    changingKnowledgeStatus: false,

    pendingStatusAction: ""
  };

  const elements = {};

  /*
  |--------------------------------------------------------------------------
  | Element Cache
  |--------------------------------------------------------------------------
  */

  function getElement(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    elements.login =
      getElement("gfloor-admin-login");

    elements.dashboard =
      getElement("gfloor-admin-dashboard");

    elements.token =
      getElement("gfloor-admin-token");

    elements.loginButton =
      getElement("gfloor-admin-login-button");

    elements.loginMessage =
      getElement("gfloor-admin-login-message");

    elements.logoutButton =
      getElement("gfloor-admin-logout");

    elements.refreshButton =
      getElement("gfloor-admin-refresh");

    elements.dbStatus =
      getElement("gfloor-admin-db-status");

    elements.pendingCount =
      getElement("gfloor-count-pending");

    elements.approvedCount =
      getElement("gfloor-count-approved");

    elements.deniedCount =
      getElement("gfloor-count-denied");

    elements.totalCount =
      getElement("gfloor-count-total");

    elements.knowledgeActiveCount =
      getElement("gfloor-knowledge-count-active");

    elements.knowledgeInactiveCount =
      getElement("gfloor-knowledge-count-inactive");

    elements.knowledgeTotalCount =
      getElement("gfloor-knowledge-count-total");

    elements.statusFilter =
      getElement("gfloor-filter-status");

    elements.categoryFilter =
      getElement("gfloor-filter-category");

    elements.searchFilter =
      getElement("gfloor-filter-search");

    elements.applyFiltersButton =
      getElement("gfloor-filter-apply");

    elements.clearFiltersButton =
      getElement("gfloor-filter-clear");

    elements.reviewLoading =
      getElement("gfloor-review-loading");

    elements.reviewEmpty =
      getElement("gfloor-review-empty");

    elements.reviewList =
      getElement("gfloor-review-list");

    elements.resultCount =
      getElement("gfloor-review-result-count");

    elements.pagination =
      getElement("gfloor-pagination");

    elements.previousButton =
      getElement("gfloor-page-previous");

    elements.nextButton =
      getElement("gfloor-page-next");

    elements.pageLabel =
      getElement("gfloor-page-label");

    elements.detailPlaceholder =
      getElement("gfloor-detail-placeholder");

    elements.detail =
      getElement("gfloor-review-detail");

    elements.detailTitle =
      getElement("gfloor-detail-title");

    elements.detailStatus =
      getElement("gfloor-detail-status");

    elements.sensitiveAlert =
      getElement("gfloor-sensitive-alert");

    elements.duplicateAlert =
      getElement("gfloor-duplicate-alert");

    elements.duplicateMessage =
      getElement("gfloor-duplicate-message");

    elements.detailSource =
      getElement("gfloor-detail-source");

    elements.detailReceived =
      getElement("gfloor-detail-received");

    elements.detailSender =
      getElement("gfloor-detail-sender");

    elements.detailCategory =
      getElement("gfloor-detail-category");

    elements.detailSubject =
      getElement("gfloor-detail-subject");

    elements.customerQuestion =
      getElement("gfloor-detail-customer-question");

    elements.customerResponse =
      getElement("gfloor-detail-customer-response");

    elements.suggestedQuestion =
      getElement("gfloor-detail-suggested-question");

    elements.suggestedVariations =
      getElement("gfloor-detail-suggested-variations");

    elements.suggestedAnswer =
      getElement("gfloor-detail-suggested-answer");

    elements.suggestedCategory =
      getElement("gfloor-detail-suggested-category");

    elements.suggestedResponseType =
      getElement("gfloor-detail-suggested-response-type");

    elements.suggestedSourceUrl =
      getElement("gfloor-detail-suggested-source-url");

    elements.sensitiveRequired =
      getElement("gfloor-sensitive-required");

    elements.sensitiveControl =
      getElement("gfloor-sensitive-review-control");

    elements.sensitiveNotRequired =
      getElement("gfloor-sensitive-not-required");

    elements.sensitiveCompleted =
      getElement("gfloor-sensitive-review-completed");

    elements.possibleDuplicate =
      getElement("gfloor-possible-duplicate");

    elements.detectedSensitive =
      getElement("gfloor-detected-sensitive-information");

    elements.reviewerName =
      getElement("gfloor-reviewer-name");

    elements.reviewedAt =
      getElement("gfloor-reviewed-at");

    elements.reviewerNotes =
      getElement("gfloor-reviewer-notes");

    elements.reviewMessage =
      getElement("gfloor-review-message");

    elements.reviewStateMessage =
      getElement("gfloor-review-state-message");

    elements.denyButton =
      getElement("gfloor-deny-button");

    elements.saveButton =
      getElement("gfloor-save-button");

    elements.approveButton =
      getElement("gfloor-approve-button");

    /*
    |--------------------------------------------------------------------------
    | Approved Knowledge Status Elements
    |--------------------------------------------------------------------------
    */

    elements.knowledgeStatusPanel =
      getElement("gfloor-knowledge-status-panel");

    elements.knowledgeStatusBadge =
      getElement("gfloor-knowledge-status-badge");

    elements.knowledgeId =
      getElement("gfloor-knowledge-id");

    elements.knowledgeApprovedBy =
      getElement("gfloor-knowledge-approved-by");

    elements.knowledgeApprovedAt =
      getElement("gfloor-knowledge-approved-at");

    elements.knowledgeStatusUpdatedAt =
      getElement("gfloor-knowledge-status-updated-at");

    elements.deactivationAudit =
      getElement("gfloor-knowledge-deactivation-audit");

    elements.deactivatedBy =
      getElement("gfloor-knowledge-deactivated-by");

    elements.deactivatedAt =
      getElement("gfloor-knowledge-deactivated-at");

    elements.deactivationReason =
      getElement("gfloor-knowledge-deactivation-reason");

    elements.reactivationAudit =
      getElement("gfloor-knowledge-reactivation-audit");

    elements.reactivatedBy =
      getElement("gfloor-knowledge-reactivated-by");

    elements.reactivatedAt =
      getElement("gfloor-knowledge-reactivated-at");

    elements.reactivationReason =
      getElement("gfloor-knowledge-reactivation-reason");

    elements.statusActionTitle =
      getElement("gfloor-status-action-title");

    elements.statusReviewerName =
      getElement("gfloor-status-reviewer-name");

    elements.statusReason =
      getElement("gfloor-status-reason");

    elements.statusMessage =
      getElement("gfloor-status-message");

    elements.deactivateButton =
      getElement("gfloor-deactivate-knowledge-button");

    elements.reactivateButton =
      getElement("gfloor-reactivate-knowledge-button");

    elements.confirmDialog =
      getElement("gfloor-status-confirm-dialog");

    elements.confirmTitle =
      getElement("gfloor-status-confirm-title");

    elements.confirmMessage =
      getElement("gfloor-status-confirm-message");

    elements.confirmCancel =
      getElement("gfloor-status-confirm-cancel");

    elements.confirmSubmit =
      getElement("gfloor-status-confirm-submit");
  }

  /*
  |--------------------------------------------------------------------------
  | General Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function getValue(object) {
    const keys =
      Array.prototype.slice.call(
        arguments,
        1
      );

    if (!object) {
      return undefined;
    }

    for (
      let index = 0;
      index < keys.length;
      index += 1
    ) {
      const key = keys[index];

      if (
        Object.prototype.hasOwnProperty.call(
          object,
          key
        ) &&
        object[key] !== undefined
      ) {
        return object[key];
      }
    }

    return undefined;
  }

  function escapeHtml(value) {
    const temporary =
      document.createElement("div");

    temporary.textContent =
      cleanText(value);

    return temporary.innerHTML;
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

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

  function numberValue(value) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function statusLabel(status) {
    switch (status) {
      case "approved":
        return "Approved";

      case "denied":
        return "Denied";

      default:
        return "Pending Review";
    }
  }

  function setText(
    element,
    value,
    fallback
  ) {
    if (!element) {
      return;
    }

    const text =
      cleanText(value);

    element.textContent =
      text ||
      fallback ||
      "—";
  }

  function toggleHidden(
    element,
    hidden
  ) {
    if (!element) {
      return;
    }

    element.classList.toggle(
      "is-hidden",
      Boolean(hidden)
    );
  }

  function showReviewMessage(
    message,
    success
  ) {
    if (!elements.reviewMessage) {
      return;
    }

    elements.reviewMessage.textContent =
      message;

    elements.reviewMessage.classList.remove(
      "is-hidden",
      "is-success"
    );

    if (success) {
      elements.reviewMessage.classList.add(
        "is-success"
      );
    }
  }

  function hideReviewMessage() {
    toggleHidden(
      elements.reviewMessage,
      true
    );
  }

  function showStatusMessage(
    message,
    success
  ) {
    if (!elements.statusMessage) {
      return;
    }

    elements.statusMessage.textContent =
      message;

    elements.statusMessage.classList.remove(
      "is-hidden",
      "is-success"
    );

    if (success) {
      elements.statusMessage.classList.add(
        "is-success"
      );
    }
  }

  function hideStatusMessage() {
    toggleHidden(
      elements.statusMessage,
      true
    );
  }

  function setLoginMessage(message) {
    setText(
      elements.loginMessage,
      message,
      ""
    );
  }

  /*
  |--------------------------------------------------------------------------
  | API
  |--------------------------------------------------------------------------
  */

  async function apiRequest(
    endpoint,
    options
  ) {
    const settings =
      options || {};

    const headers = {
      "X-Admin-Token":
        state.adminToken,

      Accept:
        "application/json"
    };

    if (
      settings.body !== undefined
    ) {
      headers["Content-Type"] =
        "application/json";
    }

    const response =
      await fetch(
        API_BASE + endpoint,
        {
          method:
            settings.method ||
            "GET",

          headers,

          cache:
            "no-store",

          credentials:
            "omit",

          body:
            settings.body !== undefined
              ? JSON.stringify(
                  settings.body
                )
              : undefined
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch (error) {
      data = null;
    }

    if (
      response.status === 401
    ) {
      throw new Error(
        "The admin token is not authorized."
      );
    }

    if (!response.ok) {
      throw new Error(
        data && data.error
          ? data.error
          : "The server request failed."
      );
    }

    if (
      data &&
      data.success === false
    ) {
      throw new Error(
        data.error ||
        "The request could not be completed."
      );
    }

    return data || {};
  }

  /*
  |--------------------------------------------------------------------------
  | Authentication
  |--------------------------------------------------------------------------
  */

  async function login() {
    const token =
      cleanText(
        elements.token.value
      );

    if (!token) {
      setLoginMessage(
        "Enter your ADMIN_TOKEN."
      );

      elements.token.focus();
      return;
    }

    elements.loginButton.disabled =
      true;

    elements.loginButton.textContent =
      "Connecting...";

    state.adminToken =
      token;

    setLoginMessage("");

    try {
      await apiRequest(
        "/reviews/health"
      );

      sessionStorage.setItem(
        SESSION_TOKEN_KEY,
        token
      );

      toggleHidden(
        elements.login,
        true
      );

      toggleHidden(
        elements.dashboard,
        false
      );

      elements.token.value = "";

      await refreshDashboard();
    } catch (error) {
      state.adminToken = "";

      sessionStorage.removeItem(
        SESSION_TOKEN_KEY
      );

      setLoginMessage(
        error.message
      );
    } finally {
      elements.loginButton.disabled =
        false;

      elements.loginButton.textContent =
        "Open Review Dashboard";
    }
  }

  function logout() {
    state.adminToken = "";
    state.reviews = [];
    state.selectedReviewId = null;
    state.selectedReview = null;
    state.selectedKnowledge = null;

    sessionStorage.removeItem(
      SESSION_TOKEN_KEY
    );

    toggleHidden(
      elements.dashboard,
      true
    );

    toggleHidden(
      elements.login,
      false
    );

    elements.token.value = "";

    clearDetail();

    elements.token.focus();
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

    elements.token.value =
      storedToken;

    await login();
  }

  /*
  |--------------------------------------------------------------------------
  | Health
  |--------------------------------------------------------------------------
  */

  function setDatabaseStatus(
    connected,
    message
  ) {
    elements.dbStatus.classList.remove(
      "is-connected",
      "is-error"
    );

    elements.dbStatus.classList.add(
      connected
        ? "is-connected"
        : "is-error"
    );

    const text =
      elements.dbStatus.querySelector(
        "span:last-child"
      );

    if (text) {
      text.textContent =
        message;
    }
  }

  async function loadHealth() {
    try {
      const result =
        await apiRequest(
          "/reviews/health"
        );

      const connected =
        Boolean(
          result.database &&
          result.database.connected
        ) ||
        result.success === true;

      setDatabaseStatus(
        connected,
        connected
          ? "Database connected"
          : "Database unavailable"
      );
    } catch (error) {
      setDatabaseStatus(
        false,
        "Database connection failed"
      );

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Counts
  |--------------------------------------------------------------------------
  */

  async function loadReviewCounts() {
    const result =
      await apiRequest(
        "/reviews/counts"
      );

    const counts =
      result.counts ||
      result;

    setText(
      elements.pendingCount,
      numberValue(
        getValue(
          counts,
          "pending",
          "pending_review",
          "pendingReview"
        )
      ),
      "0"
    );

    setText(
      elements.approvedCount,
      numberValue(
        getValue(
          counts,
          "approved"
        )
      ),
      "0"
    );

    setText(
      elements.deniedCount,
      numberValue(
        getValue(
          counts,
          "denied"
        )
      ),
      "0"
    );

    setText(
      elements.totalCount,
      numberValue(
        getValue(
          counts,
          "total"
        )
      ),
      "0"
    );
  }

  async function loadKnowledgeStatusCounts() {
    try {
      const result =
        await apiRequest(
          "/knowledge/status/counts"
        );

      const counts =
        result.counts || {};

      setText(
        elements.knowledgeActiveCount,
        numberValue(counts.active),
        "0"
      );

      setText(
        elements.knowledgeInactiveCount,
        numberValue(counts.inactive),
        "0"
      );

      setText(
        elements.knowledgeTotalCount,
        numberValue(counts.total),
        "0"
      );
    } catch (error) {
      setText(
        elements.knowledgeActiveCount,
        "—"
      );

      setText(
        elements.knowledgeInactiveCount,
        "—"
      );

      setText(
        elements.knowledgeTotalCount,
        "—"
      );

      console.warn(
        "Approved knowledge status counts failed:",
        error.message
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Review List
  |--------------------------------------------------------------------------
  */

  function buildReviewQuery() {
    const parameters =
      new URLSearchParams();

    if (state.status) {
      parameters.set(
        "status",
        state.status
      );
    }

    if (state.category) {
      parameters.set(
        "category",
        state.category
      );
    }

    if (state.search) {
      parameters.set(
        "search",
        state.search
      );
    }

    parameters.set(
      "page",
      String(state.page)
    );

    parameters.set(
      "limit",
      String(state.limit)
    );

    return "?" +
      parameters.toString();
  }

  async function loadReviews() {
    state.loading = true;

    toggleHidden(
      elements.reviewLoading,
      false
    );

    toggleHidden(
      elements.reviewEmpty,
      true
    );

    elements.reviewList.innerHTML = "";

    try {
      const result =
        await apiRequest(
          "/reviews" +
          buildReviewQuery()
        );

      state.reviews =
        Array.isArray(result.reviews)
          ? result.reviews
          : Array.isArray(result.items)
            ? result.items
            : [];

      const pagination =
        result.pagination || {};

      state.page =
        numberValue(
          pagination.page
        ) || state.page;

      state.pages =
        numberValue(
          pagination.pages
        ) || 1;

      state.total =
        numberValue(
          pagination.total !== undefined
            ? pagination.total
            : result.total
        );

      renderReviewList();
      renderPagination();
    } finally {
      state.loading = false;

      toggleHidden(
        elements.reviewLoading,
        true
      );
    }
  }

  function reviewId(review) {
    return numberValue(
      getValue(
        review,
        "id",
        "reviewId",
        "review_id"
      )
    );
  }

  function reviewStatus(review) {
    return cleanText(
      getValue(
        review,
        "status"
      )
    ) || "pending-review";
  }

  function reviewQuestion(review) {
    return cleanText(
      getValue(
        review,
        "suggested_question",
        "suggestedQuestion",
        "customer_question",
        "customerQuestion",
        "subject"
      )
    ) || "Untitled review";
  }

  function reviewAnswer(review) {
    return cleanText(
      getValue(
        review,
        "suggested_answer",
        "suggestedAnswer",
        "customer_service_response",
        "customerServiceResponse"
      )
    );
  }

  function reviewCategory(review) {
    return cleanText(
      getValue(
        review,
        "suggested_category",
        "suggestedCategory",
        "category"
      )
    ) || "Uncategorized";
  }

  function renderReviewList() {
    elements.reviewList.innerHTML = "";

    const hasReviews =
      state.reviews.length > 0;

    toggleHidden(
      elements.reviewEmpty,
      hasReviews
    );

    const total =
      state.total ||
      state.reviews.length;

    elements.resultCount.textContent =
      total +
      (
        total === 1
          ? " review"
          : " reviews"
      );

    if (!hasReviews) {
      clearDetail();
      return;
    }

    state.reviews.forEach(
      function (review) {
        const id =
          reviewId(review);

        const status =
          reviewStatus(review);

        const card =
          document.createElement(
            "button"
          );

        card.type = "button";

        card.className =
          "gfloor-review-card";

        if (
          id ===
          state.selectedReviewId
        ) {
          card.classList.add(
            "is-selected"
          );
        }

        const sensitive =
          Boolean(
            getValue(
              review,
              "requires_sensitive_review",
              "requiresSensitiveReview"
            )
          );

        const duplicate =
          Boolean(
            getValue(
              review,
              "possible_duplicate",
              "possibleDuplicate"
            )
          );

        card.innerHTML = `
          <div class="gfloor-review-card-top">
            <span>
              REVIEW #${escapeHtml(id)}
            </span>

            <span class="gfloor-status-badge status-${escapeHtml(status)}">
              ${escapeHtml(statusLabel(status))}
            </span>
          </div>

          <h3>
            ${escapeHtml(reviewQuestion(review))}
          </h3>

          <p>
            ${escapeHtml(reviewAnswer(review).slice(0, 190))}
          </p>

          <div class="gfloor-review-card-meta">
            <span class="gfloor-review-tag">
              ${escapeHtml(reviewCategory(review))}
            </span>

            ${
              sensitive
                ? '<span class="gfloor-review-tag gfloor-tag-warning">Sensitive Review</span>'
                : ""
            }

            ${
              duplicate
                ? '<span class="gfloor-review-tag gfloor-tag-info">Possible Duplicate</span>'
                : ""
            }

            <span class="gfloor-review-tag">
              ${escapeHtml(
                formatDate(
                  getValue(
                    review,
                    "received_at",
                    "receivedAt",
                    "created_at",
                    "createdAt"
                  )
                )
              )}
            </span>
          </div>
        `;

        card.addEventListener(
          "click",
          function () {
            selectReview(id);
          }
        );

        elements.reviewList.appendChild(
          card
        );
      }
    );
  }

  function renderPagination() {
    const visible =
      state.pages > 1;

    toggleHidden(
      elements.pagination,
      !visible
    );

    elements.pageLabel.textContent =
      "Page " +
      state.page +
      " of " +
      state.pages;

    elements.previousButton.disabled =
      state.loading ||
      state.page <= 1;

    elements.nextButton.disabled =
      state.loading ||
      state.page >= state.pages;
  }

  /*
  |--------------------------------------------------------------------------
  | Review Detail
  |--------------------------------------------------------------------------
  */

  async function selectReview(id) {
    state.selectedReviewId =
      id;

    state.selectedKnowledge =
      null;

    hideReviewMessage();
    hideStatusMessage();

    renderReviewList();

    try {
      const result =
        await apiRequest(
          "/reviews/" + id
        );

      state.selectedReview =
        result.review ||
        result;

      renderReviewDetail();

      if (
        reviewStatus(
          state.selectedReview
        ) === "approved"
      ) {
        await loadSelectedKnowledgeStatus();
      }
    } catch (error) {
      showReviewMessage(
        error.message,
        false
      );
    }
  }

  function clearDetail() {
    state.selectedReviewId = null;
    state.selectedReview = null;
    state.selectedKnowledge = null;

    toggleHidden(
      elements.detail,
      true
    );

    toggleHidden(
      elements.detailPlaceholder,
      false
    );

    toggleHidden(
      elements.knowledgeStatusPanel,
      true
    );
  }

  function renderReviewDetail() {
    const review =
      state.selectedReview;

    if (!review) {
      clearDetail();
      return;
    }

    toggleHidden(
      elements.detailPlaceholder,
      true
    );

    toggleHidden(
      elements.detail,
      false
    );

    const id =
      reviewId(review);

    const status =
      reviewStatus(review);

    setText(
      elements.detailTitle,
      "Review #" + id
    );

    setText(
      elements.detailStatus,
      statusLabel(status)
    );

    elements.detailStatus.className =
      "gfloor-status-badge status-" +
      status;

    const sensitiveRequired =
      Boolean(
        getValue(
          review,
          "requires_sensitive_review",
          "requiresSensitiveReview"
        )
      );

    const sensitiveCompleted =
      Boolean(
        getValue(
          review,
          "sensitive_review_completed",
          "sensitiveReviewCompleted"
        )
      );

    const possibleDuplicate =
      Boolean(
        getValue(
          review,
          "possible_duplicate",
          "possibleDuplicate"
        )
      );

    toggleHidden(
      elements.sensitiveAlert,
      !sensitiveRequired
    );

    toggleHidden(
      elements.duplicateAlert,
      !possibleDuplicate
    );

    setText(
      elements.duplicateMessage,
      getValue(
        review,
        "duplicate_message",
        "duplicateMessage"
      ),
      "This review may match existing approved knowledge."
    );

    setText(
      elements.detailSource,
      getValue(
        review,
        "source",
        "source_type",
        "sourceType"
      )
    );

    setText(
      elements.detailReceived,
      formatDate(
        getValue(
          review,
          "received_at",
          "receivedAt",
          "created_at",
          "createdAt"
        )
      )
    );

    setText(
      elements.detailSender,
      getValue(
        review,
        "sender_email",
        "senderEmail",
        "sender"
      )
    );

    setText(
      elements.detailCategory,
      reviewCategory(review)
    );

    setText(
      elements.detailSubject,
      getValue(
        review,
        "email_subject",
        "emailSubject",
        "subject"
      )
    );

    setText(
      elements.customerQuestion,
      getValue(
        review,
        "customer_question",
        "customerQuestion",
        "original_question",
        "originalQuestion"
      )
    );

    setText(
      elements.customerResponse,
      getValue(
        review,
        "customer_service_response",
        "customerServiceResponse",
        "original_answer",
        "originalAnswer"
      )
    );

    elements.suggestedQuestion.value =
      cleanText(
        getValue(
          review,
          "suggested_question",
          "suggestedQuestion"
        )
      );

    const variations =
      getValue(
        review,
        "suggested_variations",
        "suggestedVariations"
      );

    elements.suggestedVariations.value =
      Array.isArray(variations)
        ? variations.join("\n")
        : cleanText(variations);

    elements.suggestedAnswer.value =
      cleanText(
        getValue(
          review,
          "suggested_answer",
          "suggestedAnswer"
        )
      );

    elements.suggestedCategory.value =
      reviewCategory(review);

    elements.suggestedResponseType.value =
      cleanText(
        getValue(
          review,
          "suggested_response_type",
          "suggestedResponseType",
          "response_type",
          "responseType"
        )
      ).toUpperCase() ||
      "AUTO";

    elements.suggestedSourceUrl.value =
      cleanText(
        getValue(
          review,
          "suggested_source_url",
          "suggestedSourceUrl",
          "source_url",
          "sourceUrl"
        )
      );

    setText(
      elements.sensitiveRequired,
      sensitiveRequired
        ? "Yes"
        : "No"
    );

    elements.sensitiveCompleted.checked =
      sensitiveCompleted;

    toggleHidden(
      elements.sensitiveControl,
      !sensitiveRequired
    );

    toggleHidden(
      elements.sensitiveNotRequired,
      sensitiveRequired
    );

    setText(
      elements.possibleDuplicate,
      possibleDuplicate
        ? "Yes"
        : "No"
    );

    const sensitiveInformation =
      getValue(
        review,
        "detected_sensitive_information",
        "detectedSensitiveInformation"
      );

    setText(
      elements.detectedSensitive,
      Array.isArray(sensitiveInformation)
        ? sensitiveInformation.join(", ")
        : sensitiveInformation,
      "None detected"
    );

    elements.reviewerName.value =
      cleanText(
        getValue(
          review,
          "reviewer_name",
          "reviewerName"
        )
      );

    setText(
      elements.reviewedAt,
      formatDate(
        getValue(
          review,
          "reviewed_at",
          "reviewedAt"
        )
      ),
      "Not reviewed"
    );

    elements.reviewerNotes.value =
      cleanText(
        getValue(
          review,
          "reviewer_notes",
          "reviewerNotes"
        )
      );

    const pending =
      status === "pending-review";

    setReviewEditingState(
      pending
    );

    renderReviewStateMessage(
      status
    );

    toggleHidden(
      elements.knowledgeStatusPanel,
      status !== "approved"
    );
  }

  function setReviewEditingState(editable) {
    [
      elements.suggestedQuestion,
      elements.suggestedVariations,
      elements.suggestedAnswer,
      elements.suggestedCategory,
      elements.suggestedResponseType,
      elements.suggestedSourceUrl,
      elements.sensitiveCompleted,
      elements.reviewerName,
      elements.reviewerNotes
    ].forEach(
      function (control) {
        if (control) {
          control.disabled =
            !editable;
        }
      }
    );

    elements.saveButton.disabled =
      !editable;

    elements.approveButton.disabled =
      !editable;

    elements.denyButton.disabled =
      !editable;
  }

  function renderReviewStateMessage(status) {
    if (!elements.reviewStateMessage) {
      return;
    }

    if (status === "approved") {
      elements.reviewStateMessage.innerHTML = `
        <strong>Approved</strong>
        <span>
          This review has been approved. Use the Approved Knowledge Status
          section below to deactivate or reactivate the live chatbot answer.
        </span>
      `;

      return;
    }

    if (status === "denied") {
      elements.reviewStateMessage.innerHTML = `
        <strong>Denied</strong>
        <span>
          This review was denied and was not added to approved chatbot knowledge.
        </span>
      `;

      return;
    }

    elements.reviewStateMessage.innerHTML = `
      <strong>Pending Review</strong>
      <span>
        Edit the proposed chatbot content, enter your reviewer name,
        then Save, Approve, or Deny this item.
      </span>
    `;
  }

  /*
  |--------------------------------------------------------------------------
  | Review Editing
  |--------------------------------------------------------------------------
  */

  function collectReviewPayload() {
    return {
      suggestedQuestion:
        cleanText(
          elements.suggestedQuestion.value
        ),

      suggestedVariations:
        elements.suggestedVariations.value
          .split(/\r?\n/)
          .map(cleanText)
          .filter(Boolean),

      suggestedAnswer:
        cleanText(
          elements.suggestedAnswer.value
        ),

      suggestedCategory:
        cleanText(
          elements.suggestedCategory.value
        ),

      suggestedResponseType:
        cleanText(
          elements.suggestedResponseType.value
        ),

      suggestedSourceUrl:
        cleanText(
          elements.suggestedSourceUrl.value
        ),

      sensitiveReviewCompleted:
        Boolean(
          elements.sensitiveCompleted.checked
        ),

      reviewerName:
        cleanText(
          elements.reviewerName.value
        ),

      reviewerNotes:
        cleanText(
          elements.reviewerNotes.value
        )
    };
  }

  function validatePendingReview(
    payload,
    action
  ) {
    if (!payload.suggestedQuestion) {
      return "Suggested question is required.";
    }

    if (!payload.suggestedAnswer) {
      return "Suggested answer is required.";
    }

    if (!payload.suggestedCategory) {
      return "Suggested category is required.";
    }

    if (!payload.reviewerName) {
      return "Reviewer name is required.";
    }

    const sensitiveRequired =
      Boolean(
        getValue(
          state.selectedReview,
          "requires_sensitive_review",
          "requiresSensitiveReview"
        )
      );

    if (
      action === "approve" &&
      sensitiveRequired &&
      !payload.sensitiveReviewCompleted
    ) {
      return "Sensitive-information review must be completed before approval.";
    }

    if (
      action === "deny" &&
      !payload.reviewerNotes
    ) {
      return "A denial reason is required in Reviewer Notes.";
    }

    return "";
  }

  async function saveReview() {
    if (
      !state.selectedReviewId ||
      state.saving
    ) {
      return;
    }

    const payload =
      collectReviewPayload();

    const validation =
      validatePendingReview(
        payload,
        "save"
      );

    if (validation) {
      showReviewMessage(
        validation,
        false
      );

      return;
    }

    state.saving = true;
    setReviewActionLoading(true);

    try {
      const result =
        await apiRequest(
          "/reviews/" +
          state.selectedReviewId,
          {
            method:
              "PUT",

            body:
              payload
          }
        );

      state.selectedReview =
        result.review ||
        state.selectedReview;

      showReviewMessage(
        result.message ||
        "Review changes were saved.",
        true
      );

      await refreshDashboard(
        state.selectedReviewId
      );
    } catch (error) {
      showReviewMessage(
        error.message,
        false
      );
    } finally {
      state.saving = false;
      setReviewActionLoading(false);
    }
  }

  async function approveReview() {
    if (
      !state.selectedReviewId ||
      state.approving
    ) {
      return;
    }

    const payload =
      collectReviewPayload();

    const validation =
      validatePendingReview(
        payload,
        "approve"
      );

    if (validation) {
      showReviewMessage(
        validation,
        false
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Approve this information for use by the G-Floor chatbot?\n\n" +
        "The edited Suggested Question and Suggested Answer will become " +
        "approved chatbot knowledge."
      );

    if (!confirmed) {
      return;
    }

    state.approving = true;
    setReviewActionLoading(true);

    try {
      await apiRequest(
        "/reviews/" +
        state.selectedReviewId,
        {
          method:
            "PUT",

          body:
            payload
        }
      );

      const result =
        await apiRequest(
          "/reviews/" +
          state.selectedReviewId +
          "/approve",
          {
            method:
              "POST",

            body: {
              reviewerName:
                payload.reviewerName,

              reviewerNotes:
                payload.reviewerNotes
            }
          }
        );

      showReviewMessage(
        result.message ||
        "Knowledge approved.",
        true
      );

      state.status = "approved";
      elements.statusFilter.value = "approved";

      await refreshDashboard(
        state.selectedReviewId
      );
    } catch (error) {
      showReviewMessage(
        error.message,
        false
      );
    } finally {
      state.approving = false;
      setReviewActionLoading(false);
    }
  }

  async function denyReview() {
    if (
      !state.selectedReviewId ||
      state.denying
    ) {
      return;
    }

    const payload =
      collectReviewPayload();

    const validation =
      validatePendingReview(
        payload,
        "deny"
      );

    if (validation) {
      showReviewMessage(
        validation,
        false
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Deny this review?\n\n" +
        "This information will not be added to approved chatbot knowledge.\n\n" +
        "Denial reason:\n" +
        payload.reviewerNotes
      );

    if (!confirmed) {
      return;
    }

    state.denying = true;
    setReviewActionLoading(true);

    try {
      const result =
        await apiRequest(
          "/reviews/" +
          state.selectedReviewId +
          "/deny",
          {
            method:
              "POST",

            body: {
              reviewerName:
                payload.reviewerName,

              reviewerNotes:
                payload.reviewerNotes
            }
          }
        );

      showReviewMessage(
        result.message ||
        "Review denied.",
        true
      );

      state.status = "denied";
      elements.statusFilter.value = "denied";

      await refreshDashboard();
    } catch (error) {
      showReviewMessage(
        error.message,
        false
      );
    } finally {
      state.denying = false;
      setReviewActionLoading(false);
    }
  }

  function setReviewActionLoading(loading) {
    [
      elements.saveButton,
      elements.approveButton,
      elements.denyButton
    ].forEach(
      function (button) {
        if (button) {
          button.disabled =
            loading;
        }
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Approved Knowledge Status
  |--------------------------------------------------------------------------
  */

  function getKnowledgeIdFromReview(review) {
    return cleanText(
      getValue(
        review,
        "knowledge_id",
        "knowledgeId",
        "approved_knowledge_id",
        "approvedKnowledgeId"
      )
    );
  }

  async function loadSelectedKnowledgeStatus() {
    if (!state.selectedReview) {
      return;
    }

    let knowledgeId =
      getKnowledgeIdFromReview(
        state.selectedReview
      );

    if (!knowledgeId) {
      const embeddedKnowledge =
        getValue(
          state.selectedReview,
          "knowledge",
          "approvedKnowledge"
        );

      knowledgeId =
        cleanText(
          getValue(
            embeddedKnowledge,
            "knowledge_id",
            "knowledgeId"
          )
        );
    }

    if (!knowledgeId) {
      /*
       * Some review detail endpoints do not return the knowledge ID.
       * Search the active approved knowledge list using training review ID.
       */

      try {
        const approvedResult =
          await apiRequest(
            "/reviews/" +
            state.selectedReviewId
          );

        const returnedKnowledge =
          approvedResult.knowledge;

        knowledgeId =
          cleanText(
            getValue(
              returnedKnowledge,
              "knowledge_id",
              "knowledgeId"
            )
          );
      } catch (error) {
        knowledgeId = "";
      }
    }

    if (!knowledgeId) {
      toggleHidden(
        elements.knowledgeStatusPanel,
        true
      );

      return;
    }

    try {
      const result =
        await apiRequest(
          "/knowledge/" +
          encodeURIComponent(
            knowledgeId
          ) +
          "/status"
        );

      state.selectedKnowledge =
        result.knowledge;

      renderKnowledgeStatus();
    } catch (error) {
      toggleHidden(
        elements.knowledgeStatusPanel,
        false
      );

      showStatusMessage(
        error.message,
        false
      );
    }
  }

  function renderKnowledgeStatus() {
    const knowledge =
      state.selectedKnowledge;

    if (!knowledge) {
      toggleHidden(
        elements.knowledgeStatusPanel,
        true
      );

      return;
    }

    toggleHidden(
      elements.knowledgeStatusPanel,
      false
    );

    const active =
      knowledge.active === true;

    elements.knowledgeStatusBadge.textContent =
      active
        ? "Active"
        : "Inactive";

    elements.knowledgeStatusBadge.classList.toggle(
      "is-inactive",
      !active
    );

    setText(
      elements.knowledgeId,
      knowledge.knowledgeId
    );

    setText(
      elements.knowledgeApprovedBy,
      knowledge.approvedBy
    );

    setText(
      elements.knowledgeApprovedAt,
      formatDate(
        knowledge.approvedAt
      )
    );

    setText(
      elements.knowledgeStatusUpdatedAt,
      formatDate(
        knowledge.statusUpdatedAt
      )
    );

    const hasDeactivation =
      Boolean(
        knowledge.deactivatedAt ||
        knowledge.deactivatedBy ||
        knowledge.deactivationReason
      );

    toggleHidden(
      elements.deactivationAudit,
      !hasDeactivation
    );

    setText(
      elements.deactivatedBy,
      knowledge.deactivatedBy
    );

    setText(
      elements.deactivatedAt,
      formatDate(
        knowledge.deactivatedAt
      )
    );

    setText(
      elements.deactivationReason,
      knowledge.deactivationReason
    );

    const hasReactivation =
      Boolean(
        knowledge.reactivatedAt ||
        knowledge.reactivatedBy ||
        knowledge.reactivationReason
      );

    toggleHidden(
      elements.reactivationAudit,
      !hasReactivation
    );

    setText(
      elements.reactivatedBy,
      knowledge.reactivatedBy
    );

    setText(
      elements.reactivatedAt,
      formatDate(
        knowledge.reactivatedAt
      )
    );

    setText(
      elements.reactivationReason,
      knowledge.reactivationReason
    );

    elements.statusActionTitle.textContent =
      active
        ? "Deactivate Approved Knowledge"
        : "Reactivate Approved Knowledge";

    toggleHidden(
      elements.deactivateButton,
      !active
    );

    toggleHidden(
      elements.reactivateButton,
      active
    );

    elements.statusReviewerName.value =
      cleanText(
        elements.reviewerName.value
      ) ||
      cleanText(
        knowledge.approvedBy
      );

    elements.statusReason.value = "";

    hideStatusMessage();
  }

  function validateStatusAction() {
    const reviewerName =
      cleanText(
        elements.statusReviewerName.value
      );

    const reason =
      cleanText(
        elements.statusReason.value
      );

    if (!reviewerName) {
      return {
        valid:
          false,

        error:
          "Reviewer name is required."
      };
    }

    if (reason.length < 5) {
      return {
        valid:
          false,

        error:
          "A reason of at least five characters is required."
      };
    }

    return {
      valid:
        true,

      reviewerName,
      reason
    };
  }

  function openStatusConfirmation(action) {
    const validation =
      validateStatusAction();

    if (!validation.valid) {
      showStatusMessage(
        validation.error,
        false
      );

      return;
    }

    if (!state.selectedKnowledge) {
      showStatusMessage(
        "No approved knowledge record is selected.",
        false
      );

      return;
    }

    state.pendingStatusAction =
      action;

    const deactivating =
      action === "deactivate";

    elements.confirmTitle.textContent =
      deactivating
        ? "Deactivate Approved Knowledge?"
        : "Reactivate Approved Knowledge?";

    elements.confirmMessage.textContent =
      deactivating
        ? "This answer will no longer be available to the live G-Floor chatbot."
        : "This answer will become available to the live G-Floor chatbot again.";

    elements.confirmSubmit.textContent =
      deactivating
        ? "Deactivate"
        : "Reactivate";

    elements.confirmSubmit.classList.toggle(
      "gfloor-button-success",
      !deactivating
    );

    elements.confirmSubmit.classList.toggle(
      "gfloor-button-danger",
      deactivating
    );

    if (
      elements.confirmDialog &&
      typeof elements.confirmDialog.showModal ===
        "function"
    ) {
      elements.confirmDialog.showModal();
      return;
    }

    const confirmed =
      window.confirm(
        elements.confirmTitle.textContent +
        "\n\n" +
        elements.confirmMessage.textContent
      );

    if (confirmed) {
      submitKnowledgeStatusChange();
    }
  }

  async function submitKnowledgeStatusChange() {
    if (
      state.changingKnowledgeStatus ||
      !state.selectedKnowledge ||
      !state.pendingStatusAction
    ) {
      return;
    }

    const validation =
      validateStatusAction();

    if (!validation.valid) {
      showStatusMessage(
        validation.error,
        false
      );

      return;
    }

    const action =
      state.pendingStatusAction;

    const knowledgeId =
      state.selectedKnowledge.knowledgeId;

    state.changingKnowledgeStatus = true;

    elements.deactivateButton.disabled = true;
    elements.reactivateButton.disabled = true;

    try {
      const result =
        await apiRequest(
          "/knowledge/" +
          encodeURIComponent(
            knowledgeId
          ) +
          "/" +
          action,
          {
            method:
              "PUT",

            body: {
              reviewerName:
                validation.reviewerName,

              reason:
                validation.reason
            }
          }
        );

      state.selectedKnowledge =
        result.knowledge;

      renderKnowledgeStatus();

      showStatusMessage(
        result.message ||
        (
          action === "deactivate"
            ? "Approved knowledge was deactivated."
            : "Approved knowledge was reactivated."
        ),
        true
      );

      await loadKnowledgeStatusCounts();

      /*
       * Force the approved-knowledge endpoint to return fresh PostgreSQL data.
       */

      try {
        await fetch(
          "/chat/approved-knowledge?refresh=" +
          Date.now(),
          {
            method:
              "GET",

            cache:
              "no-store",

            credentials:
              "omit"
          }
        );
      } catch (error) {
        console.warn(
          "Approved knowledge cache refresh failed:",
          error.message
        );
      }
    } catch (error) {
      showStatusMessage(
        error.message,
        false
      );
    } finally {
      state.changingKnowledgeStatus = false;
      state.pendingStatusAction = "";

      elements.deactivateButton.disabled = false;
      elements.reactivateButton.disabled = false;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Dashboard Refresh
  |--------------------------------------------------------------------------
  */

  async function refreshDashboard(
    reselectReviewId
  ) {
    if (
      state.loading ||
      !state.adminToken
    ) {
      return;
    }

    refreshButtonState(true);

    try {
      await Promise.all([
        loadHealth(),
        loadReviewCounts(),
        loadKnowledgeStatusCounts()
      ]);

      await loadReviews();

      if (reselectReviewId) {
        const matching =
          state.reviews.find(
            function (review) {
              return (
                reviewId(review) ===
                Number(reselectReviewId)
              );
            }
          );

        if (matching) {
          await selectReview(
            Number(reselectReviewId)
          );
        }
      }
    } catch (error) {
      showReviewMessage(
        error.message,
        false
      );
    } finally {
      refreshButtonState(false);
    }
  }

  function refreshButtonState(loading) {
    elements.refreshButton.disabled =
      loading;

    elements.applyFiltersButton.disabled =
      loading;

    elements.clearFiltersButton.disabled =
      loading;
  }

  /*
  |--------------------------------------------------------------------------
  | Filters
  |--------------------------------------------------------------------------
  */

  function applyFilters() {
    state.status =
      cleanText(
        elements.statusFilter.value
      );

    state.category =
      cleanText(
        elements.categoryFilter.value
      );

    state.search =
      cleanText(
        elements.searchFilter.value
      );

    state.page = 1;
    state.selectedReviewId = null;
    state.selectedReview = null;
    state.selectedKnowledge = null;

    updateCountCardSelection();
    clearDetail();
    loadReviews();
  }

  function clearFilters() {
    state.status =
      "pending-review";

    state.category = "";
    state.search = "";
    state.page = 1;

    elements.statusFilter.value =
      "pending-review";

    elements.categoryFilter.value = "";
    elements.searchFilter.value = "";

    updateCountCardSelection();
    clearDetail();
    loadReviews();
  }

  function setStatusFilter(status) {
    state.status =
      status;

    state.page = 1;

    elements.statusFilter.value =
      status;

    updateCountCardSelection();
    clearDetail();
    loadReviews();
  }

  function updateCountCardSelection() {
    document
      .querySelectorAll(
        "[data-status-filter]"
      )
      .forEach(
        function (card) {
          card.classList.toggle(
            "is-active",
            card.dataset.statusFilter ===
              state.status
          );
        }
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Event Binding
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
        if (event.key === "Enter") {
          login();
        }
      }
    );

    elements.logoutButton.addEventListener(
      "click",
      logout
    );

    elements.refreshButton.addEventListener(
      "click",
      function () {
        refreshDashboard(
          state.selectedReviewId
        );
      }
    );

    elements.applyFiltersButton.addEventListener(
      "click",
      applyFilters
    );

    elements.clearFiltersButton.addEventListener(
      "click",
      clearFilters
    );

    elements.searchFilter.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Enter") {
          applyFilters();
        }
      }
    );

    document
      .querySelectorAll(
        "[data-status-filter]"
      )
      .forEach(
        function (card) {
          card.addEventListener(
            "click",
            function () {
              setStatusFilter(
                card.dataset.statusFilter
              );
            }
          );
        }
      );

    elements.previousButton.addEventListener(
      "click",
      function () {
        if (state.page <= 1) {
          return;
        }

        state.page -= 1;
        loadReviews();
      }
    );

    elements.nextButton.addEventListener(
      "click",
      function () {
        if (
          state.page >=
          state.pages
        ) {
          return;
        }

        state.page += 1;
        loadReviews();
      }
    );

    elements.saveButton.addEventListener(
      "click",
      saveReview
    );

    elements.approveButton.addEventListener(
      "click",
      approveReview
    );

    elements.denyButton.addEventListener(
      "click",
      denyReview
    );

    elements.deactivateButton.addEventListener(
      "click",
      function () {
        openStatusConfirmation(
          "deactivate"
        );
      }
    );

    elements.reactivateButton.addEventListener(
      "click",
      function () {
        openStatusConfirmation(
          "reactivate"
        );
      }
    );

    elements.confirmDialog.addEventListener(
      "close",
      function () {
        if (
          elements.confirmDialog.returnValue ===
          "confirm"
        ) {
          submitKnowledgeStatusChange();
        } else {
          state.pendingStatusAction = "";
        }
      }
    );

    elements.confirmCancel.addEventListener(
      "click",
      function () {
        state.pendingStatusAction = "";
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  async function initialize() {
    cacheElements();
    bindEvents();
    updateCountCardSelection();

    console.log(
      "G-Floor knowledge review dashboard loaded:",
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