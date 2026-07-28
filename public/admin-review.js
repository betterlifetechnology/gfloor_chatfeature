(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Knowledge Review Dashboard
  |--------------------------------------------------------------------------
  |
  | STEP 20D
  |
  | Features:
  |
  | - ADMIN_TOKEN authentication
  | - database health
  | - review counts
  | - pending / approved / denied filtering
  | - review detail
  | - editable pending reviews
  | - Save Changes
  | - Approve
  | - Deny
  | - required reviewer identity
  | - required denial reason
  | - sensitive-information approval lock
  | - duplicate warnings
  |
  |--------------------------------------------------------------------------
  */

  const VERSION =
    "20.4";

  const API_BASE =
    "/admin";

  /*
  |--------------------------------------------------------------------------
  | State
  |--------------------------------------------------------------------------
  */

  const state = {
    adminToken:
      "",

    reviews:
      [],

    selectedReviewId:
      null,

    selectedReview:
      null,

    page:
      1,

    pages:
      1,

    limit:
      25,

    total:
      0,

    status:
      "pending-review",

    category:
      "",

    search:
      "",

    saving:
      false,

    approving:
      false,

    denying:
      false
  };

  /*
  |--------------------------------------------------------------------------
  | DOM
  |--------------------------------------------------------------------------
  */

  const loginScreen =
    document.getElementById(
      "gfloor-admin-login"
    );

  const dashboard =
    document.getElementById(
      "gfloor-admin-dashboard"
    );

  const tokenInput =
    document.getElementById(
      "gfloor-admin-token"
    );

  const loginButton =
    document.getElementById(
      "gfloor-admin-login-button"
    );

  const loginMessage =
    document.getElementById(
      "gfloor-admin-login-message"
    );

  const logoutButton =
    document.getElementById(
      "gfloor-admin-logout"
    );

  const refreshButton =
    document.getElementById(
      "gfloor-admin-refresh"
    );

  const dbStatus =
    document.getElementById(
      "gfloor-admin-db-status"
    );

  const pendingCount =
    document.getElementById(
      "gfloor-count-pending"
    );

  const approvedCount =
    document.getElementById(
      "gfloor-count-approved"
    );

  const deniedCount =
    document.getElementById(
      "gfloor-count-denied"
    );

  const totalCount =
    document.getElementById(
      "gfloor-count-total"
    );

  const statusFilter =
    document.getElementById(
      "gfloor-filter-status"
    );

  const categoryFilter =
    document.getElementById(
      "gfloor-filter-category"
    );

  const searchFilter =
    document.getElementById(
      "gfloor-filter-search"
    );

  const applyFiltersButton =
    document.getElementById(
      "gfloor-filter-apply"
    );

  const clearFiltersButton =
    document.getElementById(
      "gfloor-filter-clear"
    );

  const reviewList =
    document.getElementById(
      "gfloor-review-list"
    );

  const reviewLoading =
    document.getElementById(
      "gfloor-review-loading"
    );

  const reviewEmpty =
    document.getElementById(
      "gfloor-review-empty"
    );

  const resultCount =
    document.getElementById(
      "gfloor-review-result-count"
    );

  const pagination =
    document.getElementById(
      "gfloor-pagination"
    );

  const previousButton =
    document.getElementById(
      "gfloor-page-previous"
    );

  const nextButton =
    document.getElementById(
      "gfloor-page-next"
    );

  const pageLabel =
    document.getElementById(
      "gfloor-page-label"
    );

  const detailPlaceholder =
    document.getElementById(
      "gfloor-detail-placeholder"
    );

  const detailPanel =
    document.getElementById(
      "gfloor-review-detail"
    );

  const toast =
    document.getElementById(
      "gfloor-admin-toast"
    );

  /*
  |--------------------------------------------------------------------------
  | Action Buttons
  |--------------------------------------------------------------------------
  */

  const actionButtons =
    document.querySelectorAll(
      ".gfloor-detail-actions button"
    );

  const denyButton =
    actionButtons[0] ||
    null;

  const saveButton =
    actionButtons[1] ||
    null;

  const approveButton =
    actionButtons[2] ||
    null;

  const actionNote =
    document.querySelector(
      ".gfloor-detail-action-note"
    );

  if (denyButton) {
    denyButton.id =
      "gfloor-review-deny";
  }

  if (saveButton) {
    saveButton.id =
      "gfloor-review-save";
  }

  if (approveButton) {
    approveButton.id =
      "gfloor-review-approve";
  }

  /*
  |--------------------------------------------------------------------------
  | Inject Step 20D Styles
  |--------------------------------------------------------------------------
  |
  | This keeps admin-review.css unchanged.
  |
  |--------------------------------------------------------------------------
  */

  function injectStep20DStyles() {
    const style =
      document.createElement(
        "style"
      );

    style.id =
      "gfloor-step-20d-styles";

    style.textContent = `
      .gfloor-edit-control {
        width: 100%;
        min-height: 42px;
        padding: 10px 11px;
        border: 1px solid #bfc5ca;
        border-radius: 5px;
        background: #ffffff;
        color: #252b30;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        outline: none;
      }

      .gfloor-edit-control:focus {
        border-color: #d2232a;
        box-shadow: 0 0 0 2px rgba(210, 35, 42, 0.08);
      }

      textarea.gfloor-edit-control {
        min-height: 115px;
        resize: vertical;
      }

      textarea.gfloor-edit-control.gfloor-answer-editor {
        min-height: 180px;
      }

      textarea.gfloor-edit-control.gfloor-variations-editor {
        min-height: 105px;
      }

      .gfloor-field-help {
        display: block;
        margin-top: 5px;
        color: #66717a;
        font-size: 11px;
      }

      .gfloor-required {
        color: #d2232a;
      }

      .gfloor-sensitive-confirmation {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 12px;
        padding: 14px;
        border: 1px solid #e3c36a;
        border-radius: 5px;
        background: #fff5d6;
      }

      .gfloor-sensitive-confirmation input {
        width: 18px;
        height: 18px;
        margin-top: 2px;
        flex: 0 0 auto;
        accent-color: #d2232a;
      }

      .gfloor-sensitive-confirmation label {
        margin: 0;
        color: #6f5000;
        font-size: 12px;
        line-height: 1.5;
        cursor: pointer;
      }

      .gfloor-sensitive-confirmation strong {
        display: block;
        margin-bottom: 3px;
        color: #5f4300;
      }

      .gfloor-action-validation {
        margin-bottom: 14px;
        padding: 11px 13px;
        border-left: 4px solid #d2232a;
        border-radius: 4px;
        background: #fdeced;
        color: #8d1e23;
        font-size: 12px;
      }

      .gfloor-action-validation.is-hidden {
        display: none;
      }

      .gfloor-action-success {
        margin-bottom: 14px;
        padding: 11px 13px;
        border-left: 4px solid #1c7c44;
        border-radius: 4px;
        background: #e9f6ee;
        color: #145c32;
        font-size: 12px;
      }

      .gfloor-action-success.is-hidden {
        display: none;
      }

      .gfloor-readonly-status-message {
        margin-bottom: 15px;
        padding: 12px;
        border-radius: 5px;
        background: #f1f3f4;
        color: #59636b;
        font-size: 12px;
      }

      .gfloor-review-dirty {
        border-color: #d2232a !important;
        background: #fffafa !important;
      }

      .gfloor-button.is-working {
        opacity: 0.7;
        pointer-events: none;
      }

      .gfloor-reviewer-required-note {
        color: #66717a;
        font-size: 11px;
        margin-top: 5px;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Basic Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(
    value
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(
      value
    ).trim();
  }

  function escapeHtml(
    value
  ) {
    const div =
      document.createElement(
        "div"
      );

    div.textContent =
      cleanText(
        value
      );

    return div.innerHTML;
  }

  function formatDate(
    value
  ) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(
        value
      );

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
    ).format(
      date
    );
  }

  function statusLabel(
    status
  ) {
    switch (
      status
    ) {
      case "approved":
        return "Approved";

      case "denied":
        return "Denied";

      default:
        return "Pending Review";
    }
  }

  function showToast(
    message,
    isError
  ) {
    if (!toast) {
      return;
    }

    toast.textContent =
      message;

    toast.classList.remove(
      "is-hidden",
      "error"
    );

    if (isError) {
      toast.classList.add(
        "error"
      );
    }

    window.clearTimeout(
      showToast.timeout
    );

    showToast.timeout =
      window.setTimeout(
        function () {
          toast.classList.add(
            "is-hidden"
          );
        },
        4000
      );
  }

  function setLoginMessage(
    message
  ) {
    loginMessage.textContent =
      message ||
      "";
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
    const requestOptions =
      options ||
      {};

    const method =
      requestOptions.method ||
      "GET";

    const headers = {
      "X-Admin-Token":
        state.adminToken
    };

    if (
      requestOptions.body !==
      undefined
    ) {
      headers[
        "Content-Type"
      ] =
        "application/json";
    }

    const response =
      await fetch(
        API_BASE +
        endpoint,
        {
          method:
            method,

          headers:
            headers,

          body:
            requestOptions.body !==
            undefined
              ? JSON.stringify(
                  requestOptions.body
                )
              : undefined,

          cache:
            "no-store"
        }
      );

    let data;

    try {
      data =
        await response.json();
    } catch (
      error
    ) {
      data = {
        success:
          false,

        error:
          "The server returned an invalid response."
      };
    }

    if (
      response.status ===
      401
    ) {
      throw new Error(
        "The admin token is not authorized."
      );
    }

    if (
      !response.ok ||
      data.success ===
        false
    ) {
      throw new Error(
        data.error ||
        "The request could not be completed."
      );
    }

    return data;
  }

  /*
  |--------------------------------------------------------------------------
  | Authentication
  |--------------------------------------------------------------------------
  */

  async function login() {
    const token =
      cleanText(
        tokenInput.value
      );

    if (!token) {
      setLoginMessage(
        "Enter your ADMIN_TOKEN."
      );

      tokenInput.focus();

      return;
    }

    loginButton.disabled =
      true;

    loginButton.textContent =
      "Connecting...";

    setLoginMessage(
      ""
    );

    state.adminToken =
      token;

    try {
      await apiRequest(
        "/reviews/health"
      );

      loginScreen.classList.add(
        "is-hidden"
      );

      dashboard.classList.remove(
        "is-hidden"
      );

      tokenInput.value =
        "";

      await refreshDashboard();

    } catch (
      error
    ) {
      state.adminToken =
        "";

      setLoginMessage(
        error.message
      );
    } finally {
      loginButton.disabled =
        false;

      loginButton.textContent =
        "Open Review Dashboard";
    }
  }

  function logout() {
    state.adminToken =
      "";

    state.reviews =
      [];

    state.selectedReviewId =
      null;

    state.selectedReview =
      null;

    dashboard.classList.add(
      "is-hidden"
    );

    loginScreen.classList.remove(
      "is-hidden"
    );

    tokenInput.value =
      "";

    setLoginMessage(
      ""
    );

    tokenInput.focus();
  }

  /*
  |--------------------------------------------------------------------------
  | Health
  |--------------------------------------------------------------------------
  */

  async function loadHealth() {
    dbStatus.classList.remove(
      "is-connected",
      "is-error"
    );

    dbStatus.querySelector(
      "span:last-child"
    ).textContent =
      "Checking database...";

    try {
      const result =
        await apiRequest(
          "/reviews/health"
        );

      if (
        result.database &&
        result.database.connected
      ) {
        dbStatus.classList.add(
          "is-connected"
        );

        dbStatus.querySelector(
          "span:last-child"
        ).textContent =
          "Database connected";

        return;
      }

      throw new Error(
        "Database connection unavailable."
      );

    } catch (
      error
    ) {
      dbStatus.classList.add(
        "is-error"
      );

      dbStatus.querySelector(
        "span:last-child"
      ).textContent =
        "Database unavailable";

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Counts
  |--------------------------------------------------------------------------
  */

  async function loadCounts() {
    const result =
      await apiRequest(
        "/reviews/counts"
      );

    const counts =
      result.counts ||
      {};

    pendingCount.textContent =
      Number(
        counts.pending_review ||
        0
      );

    approvedCount.textContent =
      Number(
        counts.approved ||
        0
      );

    deniedCount.textContent =
      Number(
        counts.denied ||
        0
      );

    totalCount.textContent =
      Number(
        counts.total ||
        0
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Build Review Query
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
      String(
        state.page
      )
    );

    parameters.set(
      "limit",
      String(
        state.limit
      )
    );

    return (
      "/reviews?" +
      parameters.toString()
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Load Reviews
  |--------------------------------------------------------------------------
  */

  async function loadReviews() {
    reviewLoading.classList.remove(
      "is-hidden"
    );

    reviewEmpty.classList.add(
      "is-hidden"
    );

    reviewList.innerHTML =
      "";

    try {
      const result =
        await apiRequest(
          buildReviewQuery()
        );

      state.reviews =
        Array.isArray(
          result.reviews
        )
          ? result.reviews
          : [];

      const paginationData =
        result.pagination ||
        {};

      state.page =
        Number(
          paginationData.page ||
          1
        );

      state.pages =
        Number(
          paginationData.pages ||
          1
        );

      state.total =
        Number(
          paginationData.total ||
          0
        );

      renderReviews();

      renderPagination();

      resultCount.textContent =
        state.total ===
        1
          ? "1 review"
          : (
              state.total +
              " reviews"
            );

    } finally {
      reviewLoading.classList.add(
        "is-hidden"
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Render Review List
  |--------------------------------------------------------------------------
  */

  function renderReviews() {
    reviewList.innerHTML =
      "";

    if (
      !state.reviews.length
    ) {
      reviewEmpty.classList.remove(
        "is-hidden"
      );

      clearDetail();

      return;
    }

    reviewEmpty.classList.add(
      "is-hidden"
    );

    state.reviews.forEach(
      function (
        review
      ) {
        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "gfloor-review-item";

        button.dataset.reviewId =
          String(
            review.id
          );

        if (
          Number(
            state.selectedReviewId
          ) ===
          Number(
            review.id
          )
        ) {
          button.classList.add(
            "is-selected"
          );
        }

        const question =
          cleanText(
            review.suggested_question
          ) ||
          cleanText(
            review.customer_question
          ) ||
          "Untitled review";

        const preview =
          cleanText(
            review.suggested_answer
          ) ||
          cleanText(
            review.customer_service_response
          ) ||
          "No answer available.";

        let badges =
          "";

        if (
          review.suggested_category
        ) {
          badges += `
            <span class="gfloor-mini-badge">
              ${escapeHtml(
                review.suggested_category
              )}
            </span>
          `;
        }

        if (
          review.requires_sensitive_review
        ) {
          badges += `
            <span class="gfloor-mini-badge warning">
              Sensitive Review
            </span>
          `;
        }

        if (
          review.possible_duplicate
        ) {
          badges += `
            <span class="gfloor-mini-badge duplicate">
              Possible Duplicate
            </span>
          `;
        }

        button.innerHTML = `
          <div class="gfloor-review-item-top">

            <span class="gfloor-review-id">
              REVIEW #${escapeHtml(
                review.id
              )}
            </span>

            <span class="gfloor-status-badge ${escapeHtml(
              review.status
            )}">
              ${escapeHtml(
                statusLabel(
                  review.status
                )
              )}
            </span>

          </div>

          <div class="gfloor-review-question">
            ${escapeHtml(
              question
            )}
          </div>

          <p class="gfloor-review-preview">
            ${escapeHtml(
              preview
            )}
          </p>

          <div class="gfloor-review-meta">
            ${badges}

            <span class="gfloor-mini-badge">
              ${escapeHtml(
                formatDate(
                  review.source_received_at ||
                  review.created_at
                )
              )}
            </span>
          </div>
        `;

        button.addEventListener(
          "click",
          function () {
            selectReview(
              review.id
            );
          }
        );

        reviewList.appendChild(
          button
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Pagination
  |--------------------------------------------------------------------------
  */

  function renderPagination() {
    if (
      state.total <=
      state.limit
    ) {
      pagination.classList.add(
        "is-hidden"
      );

      return;
    }

    pagination.classList.remove(
      "is-hidden"
    );

    pageLabel.textContent =
      "Page " +
      state.page +
      " of " +
      state.pages;

    previousButton.disabled =
      state.page <=
      1;

    nextButton.disabled =
      state.page >=
      state.pages;
  }

  /*
  |--------------------------------------------------------------------------
  | Select Review
  |--------------------------------------------------------------------------
  */

  async function selectReview(
    reviewId
  ) {
    state.selectedReviewId =
      Number(
        reviewId
      );

    renderReviews();

    try {
      const result =
        await apiRequest(
          "/reviews/" +
          encodeURIComponent(
            reviewId
          )
        );

      state.selectedReview =
        result.review;

      renderDetail(
        result.review
      );

    } catch (
      error
    ) {
      showToast(
        error.message,
        true
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Detail Helpers
  |--------------------------------------------------------------------------
  */

  function setText(
    id,
    value,
    fallback
  ) {
    const element =
      document.getElementById(
        id
      );

    if (!element) {
      return;
    }

    element.textContent =
      cleanText(
        value
      ) ||
      fallback ||
      "—";
  }

  function renderArray(
    id,
    values,
    emptyText
  ) {
    const container =
      document.getElementById(
        id
      );

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    if (
      !Array.isArray(
        values
      ) ||
      !values.length
    ) {
      container.textContent =
        emptyText ||
        "None";

      return;
    }

    values.forEach(
      function (
        value
      ) {
        const item =
          document.createElement(
            "span"
          );

        item.className =
          "gfloor-variation";

        item.textContent =
          cleanText(
            value
          );

        container.appendChild(
          item
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Replace Element Helper
  |--------------------------------------------------------------------------
  */

  function replaceElement(
    id,
    newElement
  ) {
    const oldElement =
      document.getElementById(
        id
      );

    if (!oldElement) {
      return null;
    }

    newElement.id =
      id;

    oldElement.replaceWith(
      newElement
    );

    return newElement;
  }

  function createReadonlyDiv(
    id,
    value,
    fallback,
    longField
  ) {
    const div =
      document.createElement(
        "div"
      );

    div.id =
      id;

    div.className =
      "gfloor-readonly-field" +
      (
        longField
          ? " gfloor-long-field"
          : ""
      );

    div.textContent =
      cleanText(
        value
      ) ||
      fallback ||
      "—";

    return div;
  }

  function createInput(
    id,
    value,
    options
  ) {
    const settings =
      options ||
      {};

    const input =
      document.createElement(
        "input"
      );

    input.id =
      id;

    input.type =
      settings.type ||
      "text";

    input.className =
      "gfloor-edit-control";

    input.value =
      cleanText(
        value
      );

    input.placeholder =
      settings.placeholder ||
      "";

    input.autocomplete =
      "off";

    return input;
  }

  function createTextarea(
    id,
    value,
    className,
    placeholder
  ) {
    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.id =
      id;

    textarea.className =
      "gfloor-edit-control " +
      (
        className ||
        ""
      );

    textarea.value =
      cleanText(
        value
      );

    textarea.placeholder =
      placeholder ||
      "";

    return textarea;
  }

  function createResponseTypeSelect(
    id,
    value
  ) {
    const select =
      document.createElement(
        "select"
      );

    select.id =
      id;

    select.className =
      "gfloor-edit-control";

    [
      "AUTO",
      "HUMAN REVIEW",
      "ALWAYS ESCALATE"
    ].forEach(
      function (
        optionValue
      ) {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          optionValue;

        option.textContent =
          optionValue;

        if (
          cleanText(
            value
          ).toUpperCase() ===
          optionValue
        ) {
          option.selected =
            true;
        }

        select.appendChild(
          option
        );
      }
    );

    return select;
  }

  /*
  |--------------------------------------------------------------------------
  | Pending Review Editor
  |--------------------------------------------------------------------------
  */

  function renderPendingEditors(
    review
  ) {
    replaceElement(
      "gfloor-detail-suggested-question",
      createTextarea(
        "gfloor-detail-suggested-question",
        review.suggested_question,
        "",
        "Write the public chatbot question..."
      )
    );

    replaceElement(
      "gfloor-detail-suggested-answer",
      createTextarea(
        "gfloor-detail-suggested-answer",
        review.suggested_answer,
        "gfloor-answer-editor",
        "Write the approved public chatbot answer..."
      )
    );

    replaceElement(
      "gfloor-detail-suggested-category",
      createInput(
        "gfloor-detail-suggested-category",
        review.suggested_category,
        {
          placeholder:
            "Example: Installation"
        }
      )
    );

    replaceElement(
      "gfloor-detail-response-type",
      createResponseTypeSelect(
        "gfloor-detail-response-type",
        review.suggested_response_type ||
        "AUTO"
      )
    );

    const variations =
      Array.isArray(
        review.suggested_variations
      )
        ? review
            .suggested_variations
            .join(
              "\n"
            )
        : "";

    replaceElement(
      "gfloor-detail-variations",
      createTextarea(
        "gfloor-detail-variations",
        variations,
        "gfloor-variations-editor",
        "Enter one alternate customer question per line..."
      )
    );

    replaceElement(
      "gfloor-detail-source-url",
      createInput(
        "gfloor-detail-source-url",
        review.suggested_source_url,
        {
          type:
            "url",

          placeholder:
            "https://gfloor.com/..."
        }
      )
    );

    /*
    |--------------------------------------------------------------------------
    | Reviewer
    |--------------------------------------------------------------------------
    */

    replaceElement(
      "gfloor-detail-reviewer",
      createInput(
        "gfloor-detail-reviewer",
        review.reviewer_name,
        {
          placeholder:
            "Enter reviewer name"
        }
      )
    );

    replaceElement(
      "gfloor-detail-reviewer-notes",
      createTextarea(
        "gfloor-detail-reviewer-notes",
        review.reviewer_notes,
        "",
        "Add approval notes or enter a reason if denying this review..."
      )
    );

    /*
    |--------------------------------------------------------------------------
    | Sensitive Review Checkbox
    |--------------------------------------------------------------------------
    */

    const sensitiveOld =
      document.getElementById(
        "gfloor-detail-sensitive-completed"
      );

    if (sensitiveOld) {
      const wrapper =
        document.createElement(
          "div"
        );

      wrapper.id =
        "gfloor-detail-sensitive-completed";

      if (
        review.requires_sensitive_review
      ) {
        wrapper.className =
          "gfloor-sensitive-confirmation";

        const checkbox =
          document.createElement(
            "input"
          );

        checkbox.type =
          "checkbox";

        checkbox.id =
          "gfloor-sensitive-review-checkbox";

        checkbox.checked =
          Boolean(
            review.sensitive_review_completed
          );

        const label =
          document.createElement(
            "label"
          );

        label.htmlFor =
          "gfloor-sensitive-review-checkbox";

        label.innerHTML = `
          <strong>
            I reviewed this item for customer-specific information.
          </strong>

          I confirm that names, email addresses, phone numbers,
          order numbers, addresses, and other customer-specific
          information have been removed from the proposed chatbot
          question and answer.
        `;

        wrapper.appendChild(
          checkbox
        );

        wrapper.appendChild(
          label
        );

      } else {
        wrapper.className =
          "gfloor-readonly-field";

        wrapper.textContent =
          "Not required";
      }

      sensitiveOld.replaceWith(
        wrapper
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Action Area
    |--------------------------------------------------------------------------
    */

    setupPendingActionArea(
      review
    );

    bindDirtyTracking();
  }

  /*
  |--------------------------------------------------------------------------
  | Read-Only Detail
  |--------------------------------------------------------------------------
  */

  function renderReadonlyFields(
    review
  ) {
    replaceElement(
      "gfloor-detail-suggested-question",
      createReadonlyDiv(
        "gfloor-detail-suggested-question",
        review.suggested_question,
        "No suggested question.",
        false
      )
    );

    replaceElement(
      "gfloor-detail-suggested-answer",
      createReadonlyDiv(
        "gfloor-detail-suggested-answer",
        review.suggested_answer,
        "No suggested answer.",
        true
      )
    );

    replaceElement(
      "gfloor-detail-suggested-category",
      createReadonlyDiv(
        "gfloor-detail-suggested-category",
        review.suggested_category,
        "Uncategorized",
        false
      )
    );

    replaceElement(
      "gfloor-detail-response-type",
      createReadonlyDiv(
        "gfloor-detail-response-type",
        review.suggested_response_type,
        "AUTO",
        false
      )
    );

    const variationContainer =
      document.createElement(
        "div"
      );

    variationContainer.id =
      "gfloor-detail-variations";

    variationContainer.className =
      "gfloor-variation-list";

    replaceElement(
      "gfloor-detail-variations",
      variationContainer
    );

    renderArray(
      "gfloor-detail-variations",
      review.suggested_variations,
      "No suggested variations."
    );

    const sourceUrl =
      createReadonlyDiv(
        "gfloor-detail-source-url",
        review.suggested_source_url,
        "No source URL.",
        false
      );

    replaceElement(
      "gfloor-detail-source-url",
      sourceUrl
    );

    replaceElement(
      "gfloor-detail-reviewer",
      createReadonlyDiv(
        "gfloor-detail-reviewer",
        review.reviewer_name,
        "Not reviewed",
        false
      )
    );

    replaceElement(
      "gfloor-detail-reviewer-notes",
      createReadonlyDiv(
        "gfloor-detail-reviewer-notes",
        review.reviewer_notes,
        "No reviewer notes.",
        true
      )
    );

    replaceElement(
      "gfloor-detail-sensitive-completed",
      createReadonlyDiv(
        "gfloor-detail-sensitive-completed",
        review.sensitive_review_completed
          ? "Yes"
          : "No",
        "No",
        false
      )
    );

    setupReadonlyActionArea(
      review
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Action Area
  |--------------------------------------------------------------------------
  */

  function ensureValidationBox() {
    let box =
      document.getElementById(
        "gfloor-action-validation"
      );

    if (box) {
      return box;
    }

    box =
      document.createElement(
        "div"
      );

    box.id =
      "gfloor-action-validation";

    box.className =
      "gfloor-action-validation is-hidden";

    const actionSection =
      document.querySelector(
        ".gfloor-detail-actions-section"
      );

    if (
      actionSection &&
      actionNote
    ) {
      actionSection.insertBefore(
        box,
        actionNote
      );
    }

    return box;
  }

  function showValidation(
    message
  ) {
    const box =
      ensureValidationBox();

    box.textContent =
      message;

    box.classList.remove(
      "is-hidden"
    );

    box.scrollIntoView({
      behavior:
        "smooth",

      block:
        "nearest"
    });
  }

  function clearValidation() {
    const box =
      document.getElementById(
        "gfloor-action-validation"
      );

    if (!box) {
      return;
    }

    box.textContent =
      "";

    box.classList.add(
      "is-hidden"
    );
  }

  function setupPendingActionArea() {
    clearValidation();

    if (actionNote) {
      actionNote.innerHTML = `
        <strong>
          Pending Review
        </strong>

        <span>
          Edit the proposed chatbot content, enter your reviewer
          name, then Save, Approve, or Deny this item.
        </span>
      `;
    }

    if (denyButton) {
      denyButton.disabled =
        false;

      denyButton.textContent =
        "Deny";
    }

    if (saveButton) {
      saveButton.disabled =
        false;

      saveButton.textContent =
        "Save Changes";
    }

    if (approveButton) {
      approveButton.disabled =
        false;

      approveButton.textContent =
        "Approve";
    }
  }

  function setupReadonlyActionArea(
    review
  ) {
    clearValidation();

    if (actionNote) {
      if (
        review.status ===
        "approved"
      ) {
        actionNote.innerHTML = `
          <strong>
            Approved
          </strong>

          <span>
            This review has been approved and copied into
            approved chatbot knowledge.
          </span>
        `;

      } else {
        actionNote.innerHTML = `
          <strong>
            Denied
          </strong>

          <span>
            This review was denied and was not added to
            approved chatbot knowledge.
          </span>
        `;
      }
    }

    if (denyButton) {
      denyButton.disabled =
        true;
    }

    if (saveButton) {
      saveButton.disabled =
        true;
    }

    if (approveButton) {
      approveButton.disabled =
        true;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Dirty Tracking
  |--------------------------------------------------------------------------
  */

  function bindDirtyTracking() {
    document
      .querySelectorAll(
        ".gfloor-edit-control"
      )
      .forEach(
        function (
          control
        ) {
          control.addEventListener(
            "input",
            function () {
              control.classList.add(
                "gfloor-review-dirty"
              );
            }
          );

          control.addEventListener(
            "change",
            function () {
              control.classList.add(
                "gfloor-review-dirty"
              );
            }
          );
        }
      );
  }

  function clearDirtyTracking() {
    document
      .querySelectorAll(
        ".gfloor-review-dirty"
      )
      .forEach(
        function (
          control
        ) {
          control.classList.remove(
            "gfloor-review-dirty"
          );
        }
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Gather Editor Values
  |--------------------------------------------------------------------------
  */

  function getEditorValue(
    id
  ) {
    const element =
      document.getElementById(
        id
      );

    if (!element) {
      return "";
    }

    return cleanText(
      element.value
    );
  }

  function getVariations() {
    const value =
      getEditorValue(
        "gfloor-detail-variations"
      );

    if (!value) {
      return [];
    }

    return value
      .split(
        /\r?\n/
      )
      .map(
        function (
          variation
        ) {
          return cleanText(
            variation
          );
        }
      )
      .filter(Boolean);
  }

  function getSensitiveReviewCompleted() {
    if (
      !state.selectedReview ||
      !state.selectedReview
        .requires_sensitive_review
    ) {
      return false;
    }

    const checkbox =
      document.getElementById(
        "gfloor-sensitive-review-checkbox"
      );

    return Boolean(
      checkbox &&
      checkbox.checked
    );
  }

  function getFormData() {
    return {
      suggestedQuestion:
        getEditorValue(
          "gfloor-detail-suggested-question"
        ),

      suggestedAnswer:
        getEditorValue(
          "gfloor-detail-suggested-answer"
        ),

      suggestedCategory:
        getEditorValue(
          "gfloor-detail-suggested-category"
        ),

      suggestedVariations:
        getVariations(),

      suggestedSourceUrl:
        getEditorValue(
          "gfloor-detail-source-url"
        ),

      suggestedResponseType:
        getEditorValue(
          "gfloor-detail-response-type"
        ) ||
        "AUTO",

      sensitiveReviewCompleted:
        getSensitiveReviewCompleted(),

      reviewerName:
        getEditorValue(
          "gfloor-detail-reviewer"
        ),

      reviewerNotes:
        getEditorValue(
          "gfloor-detail-reviewer-notes"
        )
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Validation
  |--------------------------------------------------------------------------
  */

  function validateForSave(
    form
  ) {
    if (
      !state.selectedReview ||
      state.selectedReview.status !==
      "pending-review"
    ) {
      return (
        "Only pending reviews can be edited."
      );
    }

    if (
      !form.suggestedResponseType
    ) {
      return (
        "Select a response type."
      );
    }

    return "";
  }

  function validateForApproval(
    form
  ) {
    if (
      !form.suggestedQuestion
    ) {
      return (
        "A Suggested Question is required before approval."
      );
    }

    if (
      !form.suggestedAnswer
    ) {
      return (
        "A Suggested Answer is required before approval."
      );
    }

    if (
      !form.suggestedCategory
    ) {
      return (
        "A Category is required before approval."
      );
    }

    if (
      !form.reviewerName
    ) {
      return (
        "Enter your reviewer name before approving this item."
      );
    }

    if (
      state.selectedReview &&
      state.selectedReview
        .requires_sensitive_review &&
      !form
        .sensitiveReviewCompleted
    ) {
      return (
        "Sensitive information was detected. Complete the sensitive-information review checkbox before approving."
      );
    }

    return "";
  }

  function validateForDenial(
    form
  ) {
    if (
      !form.reviewerName
    ) {
      return (
        "Enter your reviewer name before denying this item."
      );
    }

    if (
      !form.reviewerNotes
    ) {
      return (
        "Enter a denial reason in Reviewer Notes before denying this item."
      );
    }

    return "";
  }

  /*
  |--------------------------------------------------------------------------
  | Save Changes
  |--------------------------------------------------------------------------
  */

  async function saveChanges(
    options
  ) {
    const settings =
      options ||
      {};

    if (
      state.saving ||
      !state.selectedReviewId
    ) {
      return null;
    }

    const form =
      getFormData();

    const validationError =
      validateForSave(
        form
      );

    if (validationError) {
      showValidation(
        validationError
      );

      return null;
    }

    clearValidation();

    state.saving =
      true;

    if (saveButton) {
      saveButton.disabled =
        true;

      saveButton.classList.add(
        "is-working"
      );

      saveButton.textContent =
        "Saving...";
    }

    try {
      const result =
        await apiRequest(
          "/reviews/" +
          encodeURIComponent(
            state.selectedReviewId
          ),
          {
            method:
              "PUT",

            body:
              form
          }
        );

      state.selectedReview =
        result.review;

      clearDirtyTracking();

      if (
        !settings.silent
      ) {
        showToast(
          "Review changes saved.",
          false
        );
      }

      return result.review;

    } catch (
      error
    ) {
      showValidation(
        error.message
      );

      showToast(
        error.message,
        true
      );

      return null;

    } finally {
      state.saving =
        false;

      if (saveButton) {
        saveButton.disabled =
          false;

        saveButton.classList.remove(
          "is-working"
        );

        saveButton.textContent =
          "Save Changes";
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Approve
  |--------------------------------------------------------------------------
  */

  async function approveReview() {
    if (
      state.approving ||
      !state.selectedReviewId
    ) {
      return;
    }

    const form =
      getFormData();

    const validationError =
      validateForApproval(
        form
      );

    if (validationError) {
      showValidation(
        validationError
      );

      return;
    }

    clearValidation();

    const confirmed =
      window.confirm(
        "Approve this information for use by the G-Floor chatbot?\n\n" +
        "The edited Suggested Question and Suggested Answer will become approved chatbot knowledge."
      );

    if (!confirmed) {
      return;
    }

    state.approving =
      true;

    setAllActionButtonsDisabled(
      true
    );

    if (approveButton) {
      approveButton.textContent =
        "Approving...";
    }

    try {
      /*
       * Save the review first.
       *
       * This ensures the approval endpoint receives the
       * reviewer's latest edited chatbot wording.
       */

      const saved =
        await saveChanges({
          silent:
            true
        });

      if (!saved) {
        return;
      }

      const latestForm =
        getFormData();

      const result =
        await apiRequest(
          "/reviews/" +
          encodeURIComponent(
            state.selectedReviewId
          ) +
          "/approve",
          {
            method:
              "POST",

            body: {
              reviewerName:
                latestForm
                  .reviewerName,

              reviewerNotes:
                latestForm
                  .reviewerNotes
            }
          }
        );

      state.selectedReview =
        result.review;

      showToast(
        "Knowledge approved and added to approved chatbot knowledge.",
        false
      );

      clearDetail();

      await Promise.all([
        loadCounts(),
        loadReviews()
      ]);

    } catch (
      error
    ) {
      showValidation(
        error.message
      );

      showToast(
        error.message,
        true
      );

    } finally {
      state.approving =
        false;

      if (approveButton) {
        approveButton.textContent =
          "Approve";
      }

      restoreActionButtons();
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Deny
  |--------------------------------------------------------------------------
  */

  async function denyReview() {
    if (
      state.denying ||
      !state.selectedReviewId
    ) {
      return;
    }

    const form =
      getFormData();

    const validationError =
      validateForDenial(
        form
      );

    if (validationError) {
      showValidation(
        validationError
      );

      return;
    }

    clearValidation();

    const confirmed =
      window.confirm(
        "Deny this review?\n\n" +
        "This information will NOT be added to approved chatbot knowledge.\n\n" +
        "Denial reason:\n" +
        form.reviewerNotes
      );

    if (!confirmed) {
      return;
    }

    state.denying =
      true;

    setAllActionButtonsDisabled(
      true
    );

    if (denyButton) {
      denyButton.textContent =
        "Denying...";
    }

    try {
      const result =
        await apiRequest(
          "/reviews/" +
          encodeURIComponent(
            state.selectedReviewId
          ) +
          "/deny",
          {
            method:
              "POST",

            body: {
              reviewerName:
                form.reviewerName,

              reviewerNotes:
                form.reviewerNotes
            }
          }
        );

      state.selectedReview =
        result.review;

      showToast(
        "Review denied. It was not added to chatbot knowledge.",
        false
      );

      clearDetail();

      await Promise.all([
        loadCounts(),
        loadReviews()
      ]);

    } catch (
      error
    ) {
      showValidation(
        error.message
      );

      showToast(
        error.message,
        true
      );

    } finally {
      state.denying =
        false;

      if (denyButton) {
        denyButton.textContent =
          "Deny";
      }

      restoreActionButtons();
    }
  }

  function setAllActionButtonsDisabled(
    disabled
  ) {
    [
      denyButton,
      saveButton,
      approveButton
    ].forEach(
      function (
        button
      ) {
        if (button) {
          button.disabled =
            disabled;
        }
      }
    );
  }

  function restoreActionButtons() {
    const pending =
      state.selectedReview &&
      state.selectedReview
        .status ===
      "pending-review";

    setAllActionButtonsDisabled(
      !pending
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Render Review Detail
  |--------------------------------------------------------------------------
  */

  function renderDetail(
    review
  ) {
    if (!review) {
      clearDetail();

      return;
    }

    state.selectedReview =
      review;

    detailPlaceholder.classList.add(
      "is-hidden"
    );

    detailPanel.classList.remove(
      "is-hidden"
    );

    setText(
      "gfloor-detail-title",
      "Review #" +
      review.id
    );

    const statusBadge =
      document.getElementById(
        "gfloor-detail-status"
      );

    statusBadge.className =
      "gfloor-status-badge " +
      cleanText(
        review.status
      );

    statusBadge.textContent =
      statusLabel(
        review.status
      );

    /*
    |--------------------------------------------------------------------------
    | Alerts
    |--------------------------------------------------------------------------
    */

    const sensitiveAlert =
      document.getElementById(
        "gfloor-sensitive-alert"
      );

    if (
      review.requires_sensitive_review
    ) {
      sensitiveAlert.classList.remove(
        "is-hidden"
      );

    } else {
      sensitiveAlert.classList.add(
        "is-hidden"
      );
    }

    const duplicateAlert =
      document.getElementById(
        "gfloor-duplicate-alert"
      );

    if (
      review.possible_duplicate
    ) {
      duplicateAlert.classList.remove(
        "is-hidden"
      );

      setText(
        "gfloor-duplicate-message",
        review.duplicate_knowledge_id
          ? (
              "Possible match: " +
              review.duplicate_knowledge_id
            )
          : "This review may match existing approved knowledge."
      );

    } else {
      duplicateAlert.classList.add(
        "is-hidden"
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Source
    |--------------------------------------------------------------------------
    */

    setText(
      "gfloor-detail-source",
      review.source_type,
      "Unknown"
    );

    setText(
      "gfloor-detail-received",
      formatDate(
        review.source_received_at ||
        review.created_at
      )
    );

    setText(
      "gfloor-detail-sender",
      review.source_sender,
      "Not provided"
    );

    setText(
      "gfloor-detail-category",
      review.suggested_category,
      "Uncategorized"
    );

    setText(
      "gfloor-detail-subject",
      review.source_subject,
      "No subject"
    );

    /*
    |--------------------------------------------------------------------------
    | Original Customer Information
    |--------------------------------------------------------------------------
    */

    setText(
      "gfloor-detail-customer-question",
      review.customer_question,
      "No customer question provided."
    );

    setText(
      "gfloor-detail-customer-response",
      review.customer_service_response,
      "No Customer Service response provided."
    );

    /*
    |--------------------------------------------------------------------------
    | Safety
    |--------------------------------------------------------------------------
    */

    setText(
      "gfloor-detail-sensitive-required",
      review.requires_sensitive_review
        ? "Yes"
        : "No"
    );

    setText(
      "gfloor-detail-duplicate",
      review.possible_duplicate
        ? "Yes"
        : "No"
    );

    renderArray(
      "gfloor-detail-sensitive-data",
      review.sensitive_information_detected,
      "None detected"
    );

    setText(
      "gfloor-detail-reviewed-date",
      review.reviewed_at
        ? formatDate(
            review.reviewed_at
          )
        : "Not reviewed"
    );

    /*
    |--------------------------------------------------------------------------
    | Pending vs Read-Only
    |--------------------------------------------------------------------------
    */

    if (
      review.status ===
      "pending-review"
    ) {
      renderPendingEditors(
        review
      );

    } else {
      renderReadonlyFields(
        review
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Clear Detail
  |--------------------------------------------------------------------------
  */

  function clearDetail() {
    state.selectedReviewId =
      null;

    state.selectedReview =
      null;

    detailPanel.classList.add(
      "is-hidden"
    );

    detailPlaceholder.classList.remove(
      "is-hidden"
    );

    clearValidation();
  }

  /*
  |--------------------------------------------------------------------------
  | Filters
  |--------------------------------------------------------------------------
  */

  async function applyFilters() {
    state.status =
      cleanText(
        statusFilter.value
      );

    state.category =
      cleanText(
        categoryFilter.value
      );

    state.search =
      cleanText(
        searchFilter.value
      );

    state.page =
      1;

    state.selectedReviewId =
      null;

    state.selectedReview =
      null;

    updateActiveCountCard();

    clearDetail();

    try {
      await loadReviews();

    } catch (
      error
    ) {
      showToast(
        error.message,
        true
      );
    }
  }

  async function clearFilters() {
    state.status =
      "pending-review";

    state.category =
      "";

    state.search =
      "";

    state.page =
      1;

    statusFilter.value =
      state.status;

    categoryFilter.value =
      "";

    searchFilter.value =
      "";

    updateActiveCountCard();

    clearDetail();

    try {
      await loadReviews();

    } catch (
      error
    ) {
      showToast(
        error.message,
        true
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Count Card Filtering
  |--------------------------------------------------------------------------
  */

  function updateActiveCountCard() {
    document
      .querySelectorAll(
        "[data-status-filter]"
      )
      .forEach(
        function (
          card
        ) {
          const status =
            card.dataset
              .statusFilter ||
            "";

          card.classList.toggle(
            "is-active",
            status ===
              state.status
          );
        }
      );
  }

  async function handleCountCard(
    status
  ) {
    state.status =
      status;

    state.page =
      1;

    state.selectedReviewId =
      null;

    state.selectedReview =
      null;

    statusFilter.value =
      status;

    updateActiveCountCard();

    clearDetail();

    try {
      await loadReviews();

    } catch (
      error
    ) {
      showToast(
        error.message,
        true
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Refresh
  |--------------------------------------------------------------------------
  */

  async function refreshDashboard() {
    refreshButton.disabled =
      true;

    refreshButton.textContent =
      "Refreshing...";

    try {
      await Promise.all([
        loadHealth(),
        loadCounts()
      ]);

      await loadReviews();

    } catch (
      error
    ) {
      showToast(
        error.message,
        true
      );

      if (
        error.message
          .toLowerCase()
          .includes(
            "token"
          )
      ) {
        logout();
      }

    } finally {
      refreshButton.disabled =
        false;

      refreshButton.textContent =
        "Refresh";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Events
  |--------------------------------------------------------------------------
  */

  loginButton.addEventListener(
    "click",
    login
  );

  tokenInput.addEventListener(
    "keydown",
    function (
      event
    ) {
      if (
        event.key ===
        "Enter"
      ) {
        login();
      }
    }
  );

  logoutButton.addEventListener(
    "click",
    logout
  );

  refreshButton.addEventListener(
    "click",
    refreshDashboard
  );

  applyFiltersButton.addEventListener(
    "click",
    applyFilters
  );

  clearFiltersButton.addEventListener(
    "click",
    clearFilters
  );

  searchFilter.addEventListener(
    "keydown",
    function (
      event
    ) {
      if (
        event.key ===
        "Enter"
      ) {
        applyFilters();
      }
    }
  );

  previousButton.addEventListener(
    "click",
    async function () {
      if (
        state.page <=
        1
      ) {
        return;
      }

      state.page -=
        1;

      clearDetail();

      try {
        await loadReviews();

      } catch (
        error
      ) {
        showToast(
          error.message,
          true
        );
      }
    }
  );

  nextButton.addEventListener(
    "click",
    async function () {
      if (
        state.page >=
        state.pages
      ) {
        return;
      }

      state.page +=
        1;

      clearDetail();

      try {
        await loadReviews();

      } catch (
        error
      ) {
        showToast(
          error.message,
          true
        );
      }
    }
  );

  document
    .querySelectorAll(
      "[data-status-filter]"
    )
    .forEach(
      function (
        card
      ) {
        card.addEventListener(
          "click",
          function () {
            handleCountCard(
              card.dataset
                .statusFilter ||
              ""
            );
          }
        );
      }
    );

  if (saveButton) {
    saveButton.addEventListener(
      "click",
      function () {
        saveChanges();
      }
    );
  }

  if (approveButton) {
    approveButton.addEventListener(
      "click",
      approveReview
    );
  }

  if (denyButton) {
    denyButton.addEventListener(
      "click",
      denyReview
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  injectStep20DStyles();

  updateActiveCountCard();

  console.log(
    "G-Floor knowledge review dashboard loaded:",
    VERSION
  );

})();