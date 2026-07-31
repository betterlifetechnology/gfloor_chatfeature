(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | G-Floor Chat Product Context Fixes
  |--------------------------------------------------------------------------
  |
  | Version: 20.17
  |
  | Handles Shopify product-page questions directly:
  |
  | - What product is this?
  | - What is the current SKU?
  | - How much is this?
  | - What color is selected?
  | - What size is selected?
  | - What colors are available?
  | - What sizes are available?
  | - Is this selection available?
  |
  | This capture-phase layer runs before widget.js so reliable Shopify facts
  | do not fall through to the low-confidence Customer Service response.
  |
  |--------------------------------------------------------------------------
  */

  const VERSION =
    "20.17";

  const GLOBAL_STATE_KEY =
    "__GFloorProductContextFixes";

  const MAX_INITIALIZATION_ATTEMPTS =
    60;

  const INITIALIZATION_INTERVAL_MS =
    250;

  const DUPLICATE_WINDOW_MS =
    1500;

  if (
    window[GLOBAL_STATE_KEY] &&
    window[GLOBAL_STATE_KEY].initialized
  ) {
    console.log(
      "G-Floor product context fixes already initialized:",
      window[GLOBAL_STATE_KEY].version
    );

    return;
  }

  const state =
    window[GLOBAL_STATE_KEY] || {
      initialized:
        false,

      version:
        VERSION,

      product:
        null,

      productPromise:
        null,

      lastSubmissionSignature:
        "",

      lastSubmissionTime:
        0,

      lastAnalyticsSignature:
        "",

      processing:
        false,

      initializationAttempts:
        0
    };

  state.version =
    VERSION;

  window[GLOBAL_STATE_KEY] =
    state;

  /*
  |--------------------------------------------------------------------------
  | Generic Helpers
  |--------------------------------------------------------------------------
  */

  function cleanText(value) {
    return String(
      value || ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeText(value) {
    return cleanText(
      value
    )
      .toLowerCase()
      .replace(/g-floor/g, "gfloor")
      .replace(/g floor/g, "gfloor")
      .replace(/®/g, "")
      .replace(/™/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(
      value || ""
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function uniqueValues(values) {
    const seen =
      new Set();

    const result =
      [];

    values.forEach(
      function (value) {
        const cleaned =
          cleanText(
            value
          );

        if (
          !cleaned
        ) {
          return;
        }

        const key =
          cleaned.toLowerCase();

        if (
          seen.has(
            key
          )
        ) {
          return;
        }

        seen.add(
          key
        );

        result.push(
          cleaned
        );
      }
    );

    return result;
  }

  function formatMoneyFromCents(cents) {
    const numericValue =
      Number(
        cents
      );

    if (
      !Number.isFinite(
        numericValue
      )
    ) {
      return "";
    }

    return new Intl.NumberFormat(
      "en-US",
      {
        style:
          "currency",

        currency:
          "USD"
      }
    ).format(
      numericValue /
      100
    );
  }

  function createSignature(
    question,
    intent,
    variantId
  ) {
    return [
      normalizeText(
        question
      ),

      cleanText(
        intent
      ),

      cleanText(
        variantId
      )
    ].join(
      "::"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Product Page Detection
  |--------------------------------------------------------------------------
  */

  function isProductPage() {
    return window.location.pathname.includes(
      "/products/"
    );
  }

  function getProductHandle() {
    const productMatch =
      window.location.pathname.match(
        /\/products\/([^/?#]+)/
      );

    return productMatch
      ? decodeURIComponent(
          productMatch[1]
        )
      : "";
  }

  /*
  |--------------------------------------------------------------------------
  | Shopify Product JSON
  |--------------------------------------------------------------------------
  */

  function getEmbeddedProductJson() {
    const candidateSelectors =
      [
        'script[type="application/json"][data-product-json]',
        'script[type="application/json"][id*="ProductJson"]',
        'script[type="application/json"][id*="product-json"]',
        'script[type="application/json"][data-product]',
        'script[type="application/json"]'
      ];

    for (
      let selectorIndex = 0;
      selectorIndex <
        candidateSelectors.length;
      selectorIndex +=
        1
    ) {
      const scripts =
        document.querySelectorAll(
          candidateSelectors[
            selectorIndex
          ]
        );

      for (
        let scriptIndex = 0;
        scriptIndex <
          scripts.length;
        scriptIndex +=
          1
      ) {
        try {
          const parsed =
            JSON.parse(
              scripts[
                scriptIndex
              ].textContent
            );

          const candidates =
            Array.isArray(
              parsed
            )
              ? parsed
              : [
                  parsed,
                  parsed &&
                  parsed.product
                ];

          const product =
            candidates.find(
              function (candidate) {
                return (
                  candidate &&
                  Array.isArray(
                    candidate.variants
                  ) &&
                  candidate.variants.length >
                    0
                );
              }
            );

          if (
            product
          ) {
            return product;
          }
        } catch (
          error
        ) {
          /*
           * Ignore unrelated JSON blocks.
           */
        }
      }
    }

    return null;
  }

  async function fetchProductJson() {
    if (
      state.product
    ) {
      return state.product;
    }

    if (
      state.productPromise
    ) {
      return state.productPromise;
    }

    state.productPromise =
      new Promise(
        async function (
          resolve
        ) {
          const embeddedProduct =
            getEmbeddedProductJson();

          if (
            embeddedProduct
          ) {
            state.product =
              embeddedProduct;

            resolve(
              state.product
            );

            return;
          }

          const handle =
            getProductHandle();

          if (
            !handle
          ) {
            resolve(
              null
            );

            return;
          }

          try {
            const response =
              await fetch(
                "/products/" +
                encodeURIComponent(
                  handle
                ) +
                ".js",
                {
                  method:
                    "GET",

                  credentials:
                    "same-origin",

                  headers: {
                    Accept:
                      "application/json"
                  }
                }
              );

            if (
              !response.ok
            ) {
              throw new Error(
                "Product JSON request returned " +
                response.status
              );
            }

            state.product =
              await response.json();

            resolve(
              state.product
            );
          } catch (
            error
          ) {
            console.error(
              "G-Floor product context could not load Shopify product JSON:",
              error
            );

            resolve(
              null
            );
          }
        }
      )
        .finally(
          function () {
            state.productPromise =
              null;
          }
        );

    return state.productPromise;
  }

  /*
  |--------------------------------------------------------------------------
  | Current Variant Detection
  |--------------------------------------------------------------------------
  */

  function getVariantIdFromUrl() {
    const parameters =
      new URLSearchParams(
        window.location.search
      );

    return cleanText(
      parameters.get(
        "variant"
      )
    );
  }

  function getVariantIdFromForm() {
    const selectors =
      [
        'form[action*="/cart/add"] input[name="id"]',
        'input[name="id"][type="hidden"]',
        'select[name="id"]',
        '[data-product-form] input[name="id"]'
      ];

    for (
      let index = 0;
      index <
        selectors.length;
      index +=
        1
    ) {
      const element =
        document.querySelector(
          selectors[
            index
          ]
        );

      if (
        element &&
        cleanText(
          element.value
        )
      ) {
        return cleanText(
          element.value
        );
      }
    }

    return "";
  }

  function getSelectedOptionFromPage(
    label
  ) {
    const normalizedLabel =
      normalizeText(
        label
      );

    const pageText =
      document.body
        ? document.body.innerText
        : "";

    const expression =
      new RegExp(
        label +
        ":\\s*([^\\n\\r]+)",
        "i"
      );

    const textMatch =
      pageText.match(
        expression
      );

    if (
      textMatch &&
      textMatch[1]
    ) {
      return cleanText(
        textMatch[1]
          .split("\n")[0]
      );
    }

    const selectedSelectors =
      [
        '[data-option-name="' +
          label +
          '"] [aria-checked="true"]',
        '[data-option-name="' +
          label +
          '"] .selected',
        '[data-option-name="' +
          label +
          '"] input:checked',
        'fieldset[data-option-name="' +
          label +
          '"] input:checked',
        'select[name*="' +
          normalizedLabel +
          '"] option:checked'
      ];

    for (
      let index = 0;
      index <
        selectedSelectors.length;
      index +=
        1
    ) {
      const element =
        document.querySelector(
          selectedSelectors[
            index
          ]
        );

      if (
        !element
      ) {
        continue;
      }

      const value =
        cleanText(
          element.value ||
          element.dataset.value ||
          element.getAttribute(
            "aria-label"
          ) ||
          element.textContent
        );

      if (
        value
      ) {
        return value;
      }
    }

    return "";
  }

  function getSelectedVariant(
    product
  ) {
    if (
      !product ||
      !Array.isArray(
        product.variants
      )
    ) {
      return null;
    }

    const variantId =
      getVariantIdFromForm() ||
      getVariantIdFromUrl();

    if (
      variantId
    ) {
      const byId =
        product.variants.find(
          function (variant) {
            return String(
              variant.id
            ) ===
            String(
              variantId
            );
          }
        );

      if (
        byId
      ) {
        return byId;
      }
    }

    const selectedColor =
      getSelectedOptionFromPage(
        "Color"
      );

    const selectedSize =
      getSelectedOptionFromPage(
        "Size"
      );

    const byOptions =
      product.variants.find(
        function (variant) {
          const variantOptions =
            Array.isArray(
              variant.options
            )
              ? variant.options
              : [];

          const title =
            cleanText(
              variant.title
            );

          const colorMatches =
            !selectedColor ||
            variantOptions.some(
              function (option) {
                return normalizeText(
                  option
                ) ===
                normalizeText(
                  selectedColor
                );
              }
            ) ||
            normalizeText(
              title
            ).includes(
              normalizeText(
                selectedColor
              )
            );

          const sizeMatches =
            !selectedSize ||
            variantOptions.some(
              function (option) {
                return normalizeText(
                  option
                ) ===
                normalizeText(
                  selectedSize
                );
              }
            ) ||
            normalizeText(
              title
            ).includes(
              normalizeText(
                selectedSize
              )
            );

          return (
            colorMatches &&
            sizeMatches
          );
        }
      );

    return (
      byOptions ||
      product.variants.find(
        function (variant) {
          return variant.available;
        }
      ) ||
      product.variants[0] ||
      null
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Product Option Helpers
  |--------------------------------------------------------------------------
  */

  function getProductOptionNames(
    product
  ) {
    if (
      !product ||
      !Array.isArray(
        product.options
      )
    ) {
      return [];
    }

    return product.options.map(
      function (option) {
        if (
          typeof option ===
          "string"
        ) {
          return cleanText(
            option
          );
        }

        return cleanText(
          option &&
          option.name
        );
      }
    );
  }

  function getOptionIndex(
    product,
    requestedName
  ) {
    const requested =
      normalizeText(
        requestedName
      );

    return getProductOptionNames(
      product
    ).findIndex(
      function (name) {
        return normalizeText(
          name
        ).includes(
          requested
        );
      }
    );
  }

  function getVariantOption(
    product,
    variant,
    requestedName
  ) {
    if (
      !variant
    ) {
      return "";
    }

    const optionIndex =
      getOptionIndex(
        product,
        requestedName
      );

    if (
      optionIndex >=
        0 &&
      Array.isArray(
        variant.options
      )
    ) {
      return cleanText(
        variant.options[
          optionIndex
        ]
      );
    }

    const directKey =
      requestedName.toLowerCase() ===
        "color"
        ? "option1"
        : "option2";

    return cleanText(
      variant[
        directKey
      ]
    );
  }

  function getAllOptionValues(
    product,
    requestedName
  ) {
    if (
      !product ||
      !Array.isArray(
        product.variants
      )
    ) {
      return [];
    }

    const optionIndex =
      getOptionIndex(
        product,
        requestedName
      );

    if (
      optionIndex <
      0
    ) {
      return [];
    }

    return uniqueValues(
      product.variants.map(
        function (variant) {
          return Array.isArray(
            variant.options
          )
            ? variant.options[
                optionIndex
              ]
            : "";
        }
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Intent Detection
  |--------------------------------------------------------------------------
  */

  function detectIntent(
    rawQuestion
  ) {
    const question =
      normalizeText(
        rawQuestion
      );

    const exactAvailabilityQuestions =
      [
        "is this selection available",
        "is this available",
        "is it available",
        "is this in stock",
        "is it in stock",
        "do you have this in stock",
        "is the selected option available",
        "is the selected combination available",
        "what is the availability",
        "availability"
      ];

    if (
      exactAvailabilityQuestions.includes(
        question
      ) ||
      /\b(is|check)\b.*\b(selection|selected|this|it)\b.*\b(available|availability|stock)\b/.test(
        question
      )
    ) {
      return "availability";
    }

    if (
      [
        "what is the current sku",
        "what is the sku",
        "what's the sku",
        "whats the sku",
        "sku",
        "sku number",
        "product sku"
      ].includes(
        question
      )
    ) {
      return "sku";
    }

    if (
      [
        "how much is this",
        "what is the price",
        "what's the price",
        "whats the price",
        "what does this cost",
        "how much does this cost",
        "price",
        "cost"
      ].includes(
        question
      )
    ) {
      return "price";
    }

    if (
      [
        "what color is selected",
        "which color is selected",
        "what color am i looking at",
        "what color is this",
        "current color"
      ].includes(
        question
      )
    ) {
      return "current_color";
    }

    if (
      [
        "what size is selected",
        "which size is selected",
        "what size am i looking at",
        "what size is this",
        "current size"
      ].includes(
        question
      )
    ) {
      return "current_size";
    }

    if (
      [
        "what colors are available",
        "what colors does this come in",
        "what colors do you have",
        "available colors",
        "color options",
        "what colors"
      ].includes(
        question
      )
    ) {
      return "all_colors";
    }

    if (
      [
        "what sizes are available",
        "what sizes does this come in",
        "what sizes do you have",
        "available sizes",
        "size options",
        "what sizes"
      ].includes(
        question
      )
    ) {
      return "all_sizes";
    }

    if (
      [
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
        "what one am i looking at"
      ].includes(
        question
      )
    ) {
      return "product_identity";
    }

    return "";
  }

  /*
  |--------------------------------------------------------------------------
  | Response Content
  |--------------------------------------------------------------------------
  */

  function createProductAnswer(
    intent,
    product,
    variant
  ) {
    const productTitle =
      cleanText(
        product &&
        product.title
      );

    const sku =
      cleanText(
        variant &&
        variant.sku
      );

    const color =
      getVariantOption(
        product,
        variant,
        "Color"
      ) ||
      getSelectedOptionFromPage(
        "Color"
      );

    const size =
      getVariantOption(
        product,
        variant,
        "Size"
      ) ||
      getSelectedOptionFromPage(
        "Size"
      );

    const price =
      variant
        ? formatMoneyFromCents(
            variant.price
          )
        : "";

    const colors =
      getAllOptionValues(
        product,
        "Color"
      );

    const sizes =
      getAllOptionValues(
        product,
        "Size"
      );

    if (
      intent ===
      "availability"
    ) {
      if (
        !variant
      ) {
        return {
          category:
            "Product Availability",

          answer:
            "I could not identify the currently selected product combination. Please select a color and size, then ask again."
        };
      }

      if (
        variant.available ===
        true
      ) {
        let answer =
          "Yes. The currently selected product combination is available.";

        if (
          color ||
          size
        ) {
          answer +=
            " Selected options: " +
            [
              color,
              size
            ]
              .filter(Boolean)
              .join(" / ") +
            ".";
        }

        if (
          sku
        ) {
          answer +=
            " SKU: " +
            sku +
            ".";
        }

        return {
          category:
            "Product Availability",

          answer
        };
      }

      return {
        category:
          "Product Availability",

        answer:
          "No. The currently selected product combination is not available. Try selecting a different color or size."
      };
    }

    if (
      intent ===
      "sku"
    ) {
      return {
        category:
          "Product Details",

        answer:
          sku
            ? (
                "The current SKU is " +
                sku +
                "."
              )
            : "The currently selected product combination does not have a visible SKU."
      };
    }

    if (
      intent ===
      "price"
    ) {
      return {
        category:
          "Product Pricing",

        answer:
          price
            ? (
                "The current selected price is " +
                price +
                "."
              )
            : "I could not identify a price for the current selection."
      };
    }

    if (
      intent ===
      "current_color"
    ) {
      return {
        category:
          "Product Details",

        answer:
          color
            ? (
                "The selected color is " +
                color +
                "."
              )
            : "I could not identify the currently selected color."
      };
    }

    if (
      intent ===
      "current_size"
    ) {
      return {
        category:
          "Product Details",

        answer:
          size
            ? (
                "The selected size is " +
                size +
                "."
              )
            : "I could not identify the currently selected size."
      };
    }

    if (
      intent ===
      "all_colors"
    ) {
      return {
        category:
          "Product Options",

        answer:
          colors.length
            ? (
                "Available colors include: " +
                colors.join(", ") +
                "."
              )
            : "I could not identify the available colors for this product."
      };
    }

    if (
      intent ===
      "all_sizes"
    ) {
      return {
        category:
          "Product Options",

        answer:
          sizes.length
            ? (
                "Available sizes include: " +
                sizes.join(", ") +
                "."
              )
            : "I could not identify the available sizes for this product."
      };
    }

    if (
      intent ===
      "product_identity"
    ) {
      let answer =
        productTitle
          ? (
              "You are currently viewing " +
              productTitle +
              "."
            )
          : "You are currently viewing a G-Floor product page.";

      const selectedDetails =
        [
          color,
          size
        ].filter(Boolean);

      if (
        selectedDetails.length
      ) {
        answer +=
          " Selected options: " +
          selectedDetails.join(
            " / "
          ) +
          ".";
      }

      return {
        category:
          "Product Details",

        answer
      };
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Chat Elements
  |--------------------------------------------------------------------------
  */

  function getElements() {
    return {
      questionInput:
        document.getElementById(
          "gfloor-chat-question"
        ),

      questionButton:
        document.getElementById(
          "gfloor-question-submit"
        ),

      responseBox:
        document.getElementById(
          "gfloor-response-box"
        ),

      helpfulActions:
        document.getElementById(
          "gfloor-helpful-actions"
        )
    };
  }

  function stopProcessingMascot() {
    const processingElements =
      document.querySelectorAll(
        [
          "#gfloor-mascot-processing",
          ".gfloor-mascot-processing",
          ".gfloor-chat-processing",
          "[data-gfloor-processing]"
        ].join(",")
      );

    processingElements.forEach(
      function (element) {
        element.classList.remove(
          "show"
        );

        element.hidden =
          true;

        element.setAttribute(
          "aria-hidden",
          "true"
        );

        element.style.display =
          "none";
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Analytics
  |--------------------------------------------------------------------------
  */

  function pushAnalytics(
    question,
    intent,
    variant
  ) {
    const variantId =
      variant &&
      variant.id
        ? String(
            variant.id
          )
        : "";

    const signature =
      createSignature(
        question,
        intent,
        variantId
      );

    if (
      state.lastAnalyticsSignature ===
      signature
    ) {
      return;
    }

    state.lastAnalyticsSignature =
      signature;

    window.dataLayer =
      window.dataLayer || [];

    window.dataLayer.push({
      event:
        "gfloor_chat_question_result",

      chat_source:
        "gfloor_custom_chat",

      question_category:
        "product_details",

      question_intent:
        intent,

      response_mode:
        "shopify_product_context",

      answer_status:
        "answered",

      escalation_status:
        "not_escalated",

      product_handle:
        getProductHandle(),

      variant_id:
        variantId,

      product_context_version:
        VERSION
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Render Product Answer
  |--------------------------------------------------------------------------
  */

  function renderAnswer(
    question,
    intent,
    product,
    variant,
    responseData
  ) {
    const elements =
      getElements();

    if (
      !elements.responseBox ||
      !responseData
    ) {
      return false;
    }

    stopProcessingMascot();

    elements.responseBox.dataset.mode =
      "shopify_product_context";

    elements.responseBox.dataset.category =
      responseData.category;

    elements.responseBox.innerHTML =
      [
        '<div class="gfloor-response-title">',
        "G-Floor Support",
        "</div>",

        '<div class="gfloor-response-context">',
        "Answering from the product and selection currently shown on this page.",
        "</div>",

        '<div class="gfloor-response-category">',
        escapeHtml(
          responseData.category
        ),
        "</div>",

        '<div class="gfloor-response-answer">',
        escapeHtml(
          responseData.answer
        ),
        "</div>",

        '<div class="gfloor-response-helpful-question">',
        "Did this answer your question?",
        "</div>"
      ].join("");

    elements.responseBox.classList.add(
      "show"
    );

    elements.responseBox.hidden =
      false;

    elements.responseBox.setAttribute(
      "aria-hidden",
      "false"
    );

    if (
      elements.helpfulActions
    ) {
      elements.helpfulActions.classList.add(
        "show"
      );

      elements.helpfulActions.hidden =
        false;

      elements.helpfulActions.dataset.mode =
        "shopify_product_context";

      elements.helpfulActions.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    pushAnalytics(
      question,
      intent,
      variant
    );

    window.setTimeout(
      function () {
        try {
          elements.responseBox.scrollIntoView({
            behavior:
              "smooth",

            block:
              "nearest"
          });
        } catch (
          error
        ) {
          elements.responseBox.scrollIntoView();
        }
      },
      50
    );

    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Duplicate Protection
  |--------------------------------------------------------------------------
  */

  function isDuplicateSubmission(
    signature
  ) {
    const now =
      Date.now();

    if (
      state.processing
    ) {
      return true;
    }

    if (
      state.lastSubmissionSignature ===
        signature &&
      (
        now -
        state.lastSubmissionTime
      ) <
        DUPLICATE_WINDOW_MS
    ) {
      return true;
    }

    state.lastSubmissionSignature =
      signature;

    state.lastSubmissionTime =
      now;

    return false;
  }

  /*
  |--------------------------------------------------------------------------
  | Handle Product Question
  |--------------------------------------------------------------------------
  */

  async function handleProductQuestion(
    event
  ) {
    if (
      !isProductPage()
    ) {
      return;
    }

    const elements =
      getElements();

    if (
      !elements.questionInput ||
      !elements.questionButton
    ) {
      return;
    }

    const question =
      cleanText(
        elements.questionInput.value
      );

    const intent =
      detectIntent(
        question
      );

    if (
      !intent
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const initialSignature =
      createSignature(
        question,
        intent,
        getVariantIdFromForm() ||
        getVariantIdFromUrl()
      );

    if (
      isDuplicateSubmission(
        initialSignature
      )
    ) {
      return;
    }

    state.processing =
      true;

    elements.questionButton.disabled =
      true;

    elements.questionButton.setAttribute(
      "aria-busy",
      "true"
    );

    try {
      const product =
        await fetchProductJson();

      if (
        !product
      ) {
        throw new Error(
          "Shopify product data is unavailable."
        );
      }

      const variant =
        getSelectedVariant(
          product
        );

      const responseData =
        createProductAnswer(
          intent,
          product,
          variant
        );

      renderAnswer(
        question,
        intent,
        product,
        variant,
        responseData
      );
    } catch (
      error
    ) {
      console.error(
        "G-Floor product context answer failed:",
        error
      );

      /*
       * Do not allow widget.js to run after interception.
       * Show a specific product-context message instead of an unrelated
       * confidence fallback.
       */

      renderAnswer(
        question,
        intent,
        null,
        null,
        {
          category:
            "Product Details",

          answer:
            "I could not read the current product selection. Please refresh the page, select the desired color and size, and try again."
        }
      );
    } finally {
      state.processing =
        false;

      elements.questionButton.disabled =
        false;

      elements.questionButton.removeAttribute(
        "aria-busy"
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Enter-Key Handling
  |--------------------------------------------------------------------------
  */

  function handleQuestionKeydown(
    event
  ) {
    if (
      event.key !==
        "Enter" ||
      event.shiftKey
    ) {
      return;
    }

    const elements =
      getElements();

    if (
      !elements.questionInput ||
      !elements.questionButton ||
      event.target !==
        elements.questionInput
    ) {
      return;
    }

    const intent =
      detectIntent(
        elements.questionInput.value
      );

    if (
      !intent ||
      !isProductPage()
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    elements.questionButton.click();
  }

  /*
  |--------------------------------------------------------------------------
  | Reset Analytics Guard When Question Changes
  |--------------------------------------------------------------------------
  */

  function handleQuestionInput() {
    state.lastAnalyticsSignature =
      "";
  }

  /*
  |--------------------------------------------------------------------------
  | Initialization
  |--------------------------------------------------------------------------
  */

  function initialize() {
    if (
      state.initialized
    ) {
      return true;
    }

    const elements =
      getElements();

    if (
      !elements.questionInput ||
      !elements.questionButton ||
      !elements.responseBox
    ) {
      return false;
    }

    if (
      elements.questionButton.dataset
        .gfloorProductContextAttached ===
      "true"
    ) {
      state.initialized =
        true;

      return true;
    }

    elements.questionButton.dataset
      .gfloorProductContextAttached =
      "true";

    elements.questionButton.addEventListener(
      "click",
      handleProductQuestion,
      true
    );

    elements.questionInput.addEventListener(
      "keydown",
      handleQuestionKeydown,
      true
    );

    elements.questionInput.addEventListener(
      "input",
      handleQuestionInput,
      true
    );

    state.initialized =
      true;

    if (
      isProductPage()
    ) {
      fetchProductJson();
    }

    console.log(
      "G-Floor product context fixes initialized:",
      {
        version:
          VERSION,

        productPage:
          isProductPage()
      }
    );

    return true;
  }

  function beginInitialization() {
    if (
      initialize()
    ) {
      return;
    }

    const initializationTimer =
      window.setInterval(
        function () {
          state.initializationAttempts +=
            1;

          if (
            initialize() ||
            state.initializationAttempts >=
              MAX_INITIALIZATION_ATTEMPTS
          ) {
            window.clearInterval(
              initializationTimer
            );
          }
        },
        INITIALIZATION_INTERVAL_MS
      );
  }

  if (
    document.readyState ===
      "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      beginInitialization,
      {
        once:
          true
      }
    );
  } else {
    beginInitialization();
  }
})();