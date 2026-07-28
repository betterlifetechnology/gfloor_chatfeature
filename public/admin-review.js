(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Knowledge Review Dashboard
  |--------------------------------------------------------------------------
  |
  | STEP 20C
  |
  | Features:
  |
  | - ADMIN_TOKEN login
  | - protected API health check
  | - pending / approved / denied counts
  | - review list
  | - status filter
  | - category filter
  | - search
  | - pagination
  | - full review detail panel
  | - sensitive information warnings
  | - duplicate warnings
  |
  | Editing / Approve / Deny becomes active in Step 20D.
  |
  |--------------------------------------------------------------------------
  */

  const VERSION =
    "20.3";

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
      ""
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
  | Helpers
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
        3500
      );
  }

  function setLoginMessage(
    message
  ) {
    loginMessage.textContent =
      message || "";
  }


  /*
  |--------------------------------------------------------------------------
  | API
  |--------------------------------------------------------------------------
  */

  async function apiRequest(
    endpoint
  ) {
    const response =
      await fetch(
        API_BASE +
        endpoint,
        {
          method:
            "GET",

          headers: {
            "X-Admin-Token":
              state.adminToken
          },

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
      } else {
        throw new Error(
          "Database connection unavailable."
        );
      }

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
  | Render Reviews
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
  | Select / Load One Review
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
    | Source Information
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
    | Proposed Chatbot Knowledge
    |--------------------------------------------------------------------------
    */

    setText(
      "gfloor-detail-suggested-question",
      review.suggested_question,
      "No suggested question."
    );

    setText(
      "gfloor-detail-suggested-answer",
      review.suggested_answer,
      "No suggested answer."
    );

    setText(
      "gfloor-detail-suggested-category",
      review.suggested_category,
      "Uncategorized"
    );

    setText(
      "gfloor-detail-response-type",
      review.suggested_response_type,
      "AUTO"
    );

    renderArray(
      "gfloor-detail-variations",
      review.suggested_variations,
      "No suggested variations."
    );

    const sourceUrl =
      document.getElementById(
        "gfloor-detail-source-url"
      );

    sourceUrl.innerHTML =
      "";

    if (
      review.suggested_source_url
    ) {
      const link =
        document.createElement(
          "a"
        );

      link.href =
        review.suggested_source_url;

      link.target =
        "_blank";

      link.rel =
        "noopener noreferrer";

      link.textContent =
        review.suggested_source_url;

      sourceUrl.appendChild(
        link
      );

    } else {
      sourceUrl.textContent =
        "No source URL.";
    }


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
      "gfloor-detail-sensitive-completed",
      review.sensitive_review_completed
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


    /*
    |--------------------------------------------------------------------------
    | Reviewer
    |--------------------------------------------------------------------------
    */

    setText(
      "gfloor-detail-reviewer",
      review.reviewer_name,
      "Not reviewed"
    );

    setText(
      "gfloor-detail-reviewed-date",
      review.reviewed_at
        ? formatDate(
            review.reviewed_at
          )
        : "Not reviewed"
    );

    setText(
      "gfloor-detail-reviewer-notes",
      review.reviewer_notes,
      "No reviewer notes."
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Clear Detail
  |--------------------------------------------------------------------------
  */

  function clearDetail() {
    state.selectedReviewId =
      null;

    detailPanel.classList.add(
      "is-hidden"
    );

    detailPlaceholder.classList.remove(
      "is-hidden"
    );
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


  /*
  |--------------------------------------------------------------------------
  | Initial State
  |--------------------------------------------------------------------------
  */

  updateActiveCountCard();

  console.log(
    "G-Floor knowledge review dashboard loaded:",
    VERSION
  );

})();