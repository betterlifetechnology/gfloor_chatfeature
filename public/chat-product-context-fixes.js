(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Product Context Fixes
  |--------------------------------------------------------------------------
  |
  | VERSION 19.5
  |
  | Handles product identity questions that should be answered directly from
  | the Shopify product page currently being viewed.
  |
  | Examples:
  |
  | - What product am I looking at?
  | - What product is this?
  | - Which product is this?
  | - What am I looking at?
  | - What is this product?
  |
  | This runs BEFORE widget.js confidence matching so these questions do not
  | incorrectly escalate to Customer Service.
  |
  |--------------------------------------------------------------------------
  */

  const VERSION = "19.5";

  /*
  |--------------------------------------------------------------------------
  | Helpers
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
  | Element Getters
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
  | Is This A Shopify Product Page?
  |--------------------------------------------------------------------------
  */

  function isProductPage() {
    return (
      window.location.pathname.includes(
        "/products/"
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Product Title Detection
  |--------------------------------------------------------------------------
  |
  | Try multiple sources so this continues working even if the Shopify theme
  | markup changes.
  |
  |--------------------------------------------------------------------------
  */

  function getProductTitleFromJsonLd() {
    const scripts =
      document.querySelectorAll(
        'script[type="application/ld+json"]'
      );

    for (
      let index = 0;
      index < scripts.length;
      index += 1
    ) {
      try {
        const data =
          JSON.parse(
            scripts[index].textContent
          );

        const records =
          Array.isArray(data)
            ? data
            : [data];

        for (
          let recordIndex = 0;
          recordIndex < records.length;
          recordIndex += 1
        ) {
          const record =
            records[recordIndex];

          if (!record) {
            continue;
          }

          if (
            record["@type"] === "Product" &&
            record.name
          ) {
            return cleanText(
              record.name
            );
          }

          if (
            record["@graph"] &&
            Array.isArray(
              record["@graph"]
            )
          ) {
            const product =
              record["@graph"].find(
                function (item) {
                  return (
                    item &&
                    item["@type"] ===
                      "Product" &&
                    item.name
                  );
                }
              );

            if (product) {
              return cleanText(
                product.name
              );
            }
          }
        }
      } catch (error) {
        /*
         * Ignore malformed/non-product JSON-LD.
         */
      }
    }

    return "";
  }

  function getProductTitleFromHeading() {
    const selectors = [
      "h1",
      ".product__title",
      ".product-title",
      "[data-product-title]",
      ".product-info h1"
    ];

    for (
      let index = 0;
      index < selectors.length;
      index += 1
    ) {
      const element =
        document.querySelector(
          selectors[index]
        );

      if (!element) {
        continue;
      }

      const text =
        cleanText(
          element.textContent
        );

      if (text) {
        return text;
      }
    }

    return "";
  }

  function getProductTitleFromDocumentTitle() {
    const title =
      cleanText(
        document.title
      );

    if (!title) {
      return "";
    }

    return cleanText(
      title
        .replace(
          /\s*[|\-–—]\s*G-Floor.*$/i,
          ""
        )
        .replace(
          /\s*[|\-–—]\s*GFloor.*$/i,
          ""
        )
    );
  }

  function getProductTitle() {
    return (
      getProductTitleFromJsonLd() ||
      getProductTitleFromHeading() ||
      getProductTitleFromDocumentTitle()
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Selected Option Detection
  |--------------------------------------------------------------------------
  |
  | These aren't required for the basic product-name answer, but including
  | them makes the response more useful when the Shopify page exposes them.
  |
  |--------------------------------------------------------------------------
  */

  function getSelectedColor() {
    const pageText =
      document.body
        ? document.body.innerText
        : "";

    const match =
      pageText.match(
        /Color:\s*([^\n\r]+)/i
      );

    if (!match) {
      return "";
    }

    return cleanText(
      match[1]
        .split("\n")[0]
    );
  }

  function getSelectedSize() {
    const pageText =
      document.body
        ? document.body.innerText
        : "";

    const match =
      pageText.match(
        /Size:\s*([^\n\r]+)/i
      );

    if (!match) {
      return "";
    }

    return cleanText(
      match[1]
        .split("\n")[0]
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Product Identity Intent
  |--------------------------------------------------------------------------
  */

  function isProductIdentityQuestion(
    rawQuestion
  ) {
    const question =
      normalizeText(
        rawQuestion
      );

    const exactQuestions = [
      "what product am i looking at",
      "what product am i viewing",
      "what product is this",
      "which product is this",
      "what is this product",
      "which product am i looking at",
      "which product am i viewing",
      "what am i looking at",
      "what am i viewing",
      "which one am i looking at",
      "what one am i looking at",
      "what is this",
      "which one is this"
    ];

    if (
      exactQuestions.includes(
        question
      )
    ) {
      return true;
    }

    /*
     * Additional natural-language variations.
     */

    if (
      /\bwhat\s+product\b.*\b(looking|viewing)\b/.test(
        question
      )
    ) {
      return true;
    }

    if (
      /\bwhich\s+product\b/.test(
        question
      )
    ) {
      return true;
    }

    return false;
  }

  /*
  |--------------------------------------------------------------------------
  | Stop Thinking Mascot
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
  | Render Product Identity Answer
  |--------------------------------------------------------------------------
  */

  function renderProductIdentity() {
    const responseBox =
      getResponseBox();

    const helpfulActions =
      getHelpfulActions();

    if (!responseBox) {
      return false;
    }

    const productTitle =
      getProductTitle();

    if (!productTitle) {
      /*
       * Let widget.js handle it when we cannot
       * confidently identify the product.
       */

      return false;
    }

    const color =
      getSelectedColor();

    const size =
      getSelectedSize();

    stopProcessingMascot();

    let details = `
      You're currently viewing
      <strong>${escapeHtml(
        productTitle
      )}</strong>.
    `;

    if (
      color &&
      size
    ) {
      details += `
        <br><br>
        Selected options:
        <strong>${escapeHtml(
          color
        )}</strong>
        /
        <strong>${escapeHtml(
          size
        )}</strong>.
      `;
    }

    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      <div class="gfloor-response-context">
        Answering from the product currently being viewed on this page.
      </div>

      <span class="gfloor-response-category">
        Product Details
      </span>

      <div class="gfloor-product-identity-response">
        ${details}
      </div>
    `;

    responseBox.classList.add(
      "show"
    );

    /*
     * Product answers can use your normal
     * helpful Yes / No controls.
     */

    if (helpfulActions) {
      helpfulActions.classList.add(
        "show"
      );

      helpfulActions.dataset.mode =
        "answered";
    }

    /*
     * GA4-safe event.
     *
     * No raw customer question is sent.
     */

    window.dataLayer =
      window.dataLayer ||
      [];

    window.dataLayer.push({
      event:
        "gfloor_chat_question_result",

      question_category:
        "product_details",

      question_intent:
        "product_identity",

      answer_status:
        "answered",

      chat_source:
        "gfloor_custom_chat",

      page_path:
        window.location.pathname,

      page_location:
        window.location.href
    });

    console.log(
      "G-Floor product identity handled:",
      {
        version:
          VERSION,

        productTitle:
          productTitle
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

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Attempt Product Context Answer
  |--------------------------------------------------------------------------
  */

  function tryProductContextAnswer() {
    if (
      !isProductPage()
    ) {
      return false;
    }

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

    if (
      !isProductIdentityQuestion(
        question
      )
    ) {
      return false;
    }

    return renderProductIdentity();
  }

  /*
  |--------------------------------------------------------------------------
  | CLICK INTERCEPTOR
  |--------------------------------------------------------------------------
  |
  | Capture phase means this runs before widget.js.
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
        tryProductContextAnswer();

      if (!handled) {
        /*
         * Not a product-identity question.
         * Let widget.js continue normally.
         */

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
  | ENTER KEY INTERCEPTOR
  |--------------------------------------------------------------------------
  */

  document.addEventListener(
    "keydown",
    function (event) {
      if (
        event.key !== "Enter" ||
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
        tryProductContextAnswer();

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
  | Loaded
  |--------------------------------------------------------------------------
  */

  console.log(
    "G-Floor product context fixes loaded:",
    {
      version:
        VERSION
    }
  );

})();