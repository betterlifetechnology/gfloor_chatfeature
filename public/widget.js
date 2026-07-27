(function () {
  "use strict";

  /*
  |--------------------------------------------------------------------------
  | API Configuration
  |--------------------------------------------------------------------------
  */

  const API_BASE_URL =
    "https://gfloor-chatfeature.onrender.com";

  const MESSAGE_API_URL =
    API_BASE_URL + "/chat/message";

  const STATUS_API_URL =
    API_BASE_URL + "/chat/status";

  const KNOWLEDGE_BASE_URL =
    API_BASE_URL + "/knowledge-base.js";

  /*
  |--------------------------------------------------------------------------
  | Knowledge Base Configuration
  |--------------------------------------------------------------------------
  */

  const MATCH_CONFIG = {
    strongMatchScore: 0.72,
    minimumMatchScore: 0.43,
    intentMatchBonus: 0.32,
    intentMismatchPenalty: 0.24,
    productContextBonus: 0.18
  };

  const STOP_WORDS =
    new Set([
      "a",
      "an",
      "and",
      "are",
      "as",
      "at",
      "be",
      "can",
      "could",
      "do",
      "does",
      "for",
      "from",
      "how",
      "i",
      "in",
      "is",
      "it",
      "me",
      "my",
      "of",
      "on",
      "or",
      "the",
      "this",
      "to",
      "use",
      "what",
      "where",
      "which",
      "with",
      "would",
      "you",
      "your"
    ]);

  const GENERIC_WORDS =
    new Set([
      "floor",
      "floors",
      "flooring",
      "gfloor",
      "g",
      "product",
      "products",
      "vinyl"
    ]);

  const GLUE_REMOVAL_PHRASES = [
    "get glue off",
    "remove glue",
    "removing glue",
    "clean glue",
    "clean off glue",
    "glue residue",
    "adhesive residue",
    "remove adhesive",
    "get adhesive off",
    "adhesive off",
    "glue stain"
  ];

  const GLUE_INSTALLATION_PHRASES = [
    "glue down",
    "glue it down",
    "have to glue",
    "need to glue",
    "need glue",
    "require glue",
    "requires glue",
    "need adhesive",
    "require adhesive",
    "requires adhesive",
    "use adhesive",
    "install with adhesive",
    "fully adhere",
    "floating install",
    "floating installation",
    "loose lay"
  ];

  /*
  |--------------------------------------------------------------------------
  | Product-Context Question Phrases
  |--------------------------------------------------------------------------
  |
  | These are questions where words such as "this" or "it" usually mean
  | the product currently being viewed.
  |
  */

  const CONTEXTUAL_QUESTION_PHRASES = [
    "this",
    "this product",
    "this flooring",
    "this floor",
    "it",
    "this one",
    "how thick",
    "what size",
    "what sizes",
    "is it waterproof",
    "is this waterproof",
    "can it go outside",
    "can this go outside",
    "can i use this outside",
    "can this be used outside",
    "do i need adhesive",
    "do i need glue",
    "do i have to glue",
    "does this need adhesive",
    "does this need glue",
    "how do i clean this",
    "how do i clean it",
    "how do i install this",
    "how do i install it",
    "is this slip resistant",
    "is it slip resistant",
    "what is this made of",
    "what is it made of"
  ];

  let knowledgeBase = [];
  let knowledgeBaseLoaded = false;
  let knowledgeBaseLoading = false;
  let knowledgeBaseLoadPromise = null;

  /*
  |--------------------------------------------------------------------------
  | Conversation
  |--------------------------------------------------------------------------
  */

  function generateConversationId() {
    const now =
      new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        now.getDate()
      ).padStart(
        2,
        "0"
      );

    const randomPart =
      Math.random()
        .toString(36)
        .substring(
          2,
          8
        )
        .toUpperCase();

    return (
      `GFCHAT-${year}${month}${day}-${randomPart}`
    );
  }

  let conversationId =
    generateConversationId();

  let transcript = [];

  let lastQuestion = "";

  let lastMatchedIntent =
    null;

  let lastMatchScore =
    0;

  let lastSearchQuestion =
    "";

  let currentSupportStatus = {
    liveAgentAvailable:
      false,

    estimatedWaitMinutes:
      null,

    businessHours:
      "Monday-Friday, 8 AM-5 PM Central Time",

    queueStatus:
      "unknown",

    message:
      ""
  };

  /*
  |--------------------------------------------------------------------------
  | Generic Utilities
  |--------------------------------------------------------------------------
  */

  function escapeHtml(
    value
  ) {
    return String(
      value || ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  function normalizeText(
    value
  ) {
    return String(
      value || ""
    )
      .toLowerCase()
      .replace(
        /g-floor/g,
        "gfloor"
      )
      .replace(
        /g floor/g,
        "gfloor"
      )
      .replace(
        /®/g,
        ""
      )
      .replace(
        /™/g,
        ""
      )
      .replace(
        /&/g,
        " and "
      )
      .replace(
        /[^a-z0-9\s]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  function getWords(
    value
  ) {
    return normalizeText(
      value
    )
      .split(" ")
      .filter(
        function (
          word
        ) {
          return (
            word.length >
              1 &&
            !STOP_WORDS.has(
              word
            )
          );
        }
      );
  }

  function uniqueWords(
    words
  ) {
    return Array.from(
      new Set(
        words
      )
    );
  }

  function hasAnyPhrase(
    text,
    phrases
  ) {
    const normalized =
      normalizeText(
        text
      );

    return phrases.some(
      function (
        phrase
      ) {
        return normalized.includes(
          normalizeText(
            phrase
          )
        );
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Shopify Page Context
  |--------------------------------------------------------------------------
  */

  function detectPageType() {
    const path =
      window.location.pathname;

    if (
      path === "/" ||
      path === ""
    ) {
      return "home";
    }

    if (
      path.includes(
        "/products/"
      )
    ) {
      return "product";
    }

    if (
      path.includes(
        "/collections/"
      )
    ) {
      return "collection";
    }

    if (
      path.includes(
        "/blogs/"
      )
    ) {
      return "article";
    }

    if (
      path.includes(
        "/pages/"
      )
    ) {
      return "page";
    }

    if (
      path.includes(
        "/cart"
      )
    ) {
      return "cart";
    }

    if (
      path.includes(
        "/search"
      )
    ) {
      return "search";
    }

    try {
      if (
        window.ShopifyAnalytics &&
        window.ShopifyAnalytics.meta &&
        window.ShopifyAnalytics.meta.page &&
        window.ShopifyAnalytics.meta.page.pageType
      ) {
        return String(
          window.ShopifyAnalytics
            .meta
            .page
            .pageType
        );
      }
    } catch (
      error
    ) {
      // Continue.
    }

    return "unknown";
  }

  function getPageHeading() {
    const heading =
      document.querySelector(
        "h1"
      );

    if (
      !heading
    ) {
      return "";
    }

    return (
      heading.textContent ||
      ""
    ).trim();
  }

  function getProductHandleFromUrl() {
    const match =
      window.location.pathname.match(
        /\/products\/([^/?#]+)/
      );

    if (
      !match ||
      !match[1]
    ) {
      return "";
    }

    return decodeURIComponent(
      match[1]
    );
  }

  function getCollectionHandleFromUrl() {
    const match =
      window.location.pathname.match(
        /\/collections\/([^/?#]+)/
      );

    if (
      !match ||
      !match[1]
    ) {
      return "";
    }

    return decodeURIComponent(
      match[1]
    );
  }

  function getUrlVariantId() {
    try {
      const parameters =
        new URLSearchParams(
          window.location.search
        );

      return (
        parameters.get(
          "variant"
        ) ||
        ""
      );
    } catch (
      error
    ) {
      return "";
    }
  }

  function getShopifyProductData() {
    if (
      detectPageType() !==
      "product"
    ) {
      return null;
    }

    try {
      if (
        window.ShopifyAnalytics &&
        window.ShopifyAnalytics.meta &&
        window.ShopifyAnalytics.meta.product
      ) {
        return (
          window.ShopifyAnalytics
            .meta
            .product
        );
      }
    } catch (
      error
    ) {
      // Continue.
    }

    try {
      if (
        window.meta &&
        window.meta.product
      ) {
        return (
          window.meta.product
        );
      }
    } catch (
      error
    ) {
      // Continue.
    }

    return null;
  }

  function getSelectedVariantId() {
    const urlVariantId =
      getUrlVariantId();

    if (
      urlVariantId
    ) {
      return urlVariantId;
    }

    const variantInput =
      document.querySelector(
        'form[action*="/cart/add"] [name="id"]'
      );

    if (
      variantInput &&
      variantInput.value
    ) {
      return String(
        variantInput.value
      );
    }

    return "";
  }

  function getVariantFromProduct(
    product,
    variantId
  ) {
    if (
      !product ||
      !Array.isArray(
        product.variants
      )
    ) {
      return null;
    }

    if (
      variantId
    ) {
      const selected =
        product.variants.find(
          function (
            variant
          ) {
            return (
              String(
                variant.id
              ) ===
              String(
                variantId
              )
            );
          }
        );

      if (
        selected
      ) {
        return selected;
      }
    }

    return (
      product.variants[0] ||
      null
    );
  }

  function getCollectionFromBreadcrumb() {
    const links =
      Array.from(
        document.querySelectorAll(
          'a[href*="/collections/"]'
        )
      );

    for (
      let i = 0;
      i < links.length;
      i += 1
    ) {
      const href =
        links[i].getAttribute(
          "href"
        ) ||
        "";

      const match =
        href.match(
          /\/collections\/([^/?#]+)/
        );

      if (
        match &&
        match[1]
      ) {
        return {
          handle:
            decodeURIComponent(
              match[1]
            ),

          title:
            (
              links[i].textContent ||
              ""
            ).trim()
        };
      }
    }

    return {
      handle:
        "",
      title:
        ""
    };
  }

  function getFriendlyPageTitle(
    pageType
  ) {
    const heading =
      getPageHeading();

    if (
      pageType ===
      "home"
    ) {
      return (
        "G-Floor Homepage"
      );
    }

    if (
      pageType ===
      "cart"
    ) {
      return (
        "Shopping Cart"
      );
    }

    if (
      pageType ===
      "search"
    ) {
      return (
        "G-Floor Search Results"
      );
    }

    if (
      heading
    ) {
      return heading;
    }

    return (
      document.title ||
      "G-Floor"
    );
  }

  function captureShopifyContext() {
    const pageType =
      detectPageType();

    const product =
      pageType ===
      "product"
        ? getShopifyProductData()
        : null;

    const productHandle =
      pageType ===
      "product"
        ? getProductHandleFromUrl()
        : "";

    const selectedVariantId =
      pageType ===
      "product"
        ? getSelectedVariantId()
        : "";

    const selectedVariant =
      pageType ===
      "product"
        ? getVariantFromProduct(
            product,
            selectedVariantId
          )
        : null;

    const breadcrumbCollection =
      getCollectionFromBreadcrumb();

    const directCollectionHandle =
      getCollectionHandleFromUrl();

    const productTitle =
      pageType ===
      "product"
        ? (
            (
              product &&
              (
                product.title ||
                product.name
              )
            ) ||
            getPageHeading()
          )
        : "";

    const productId =
      pageType ===
        "product" &&
      product
        ? (
            product.id ||
            product.productId ||
            ""
          )
        : "";

    const variantId =
      pageType ===
      "product"
        ? (
            selectedVariantId ||
            (
              selectedVariant &&
              selectedVariant.id
            ) ||
            ""
          )
        : "";

    const variantTitle =
      pageType ===
        "product" &&
      selectedVariant
        ? (
            selectedVariant.public_title ||
            selectedVariant.title ||
            selectedVariant.name ||
            ""
          )
        : "";

    const sku =
      pageType ===
        "product" &&
      selectedVariant
        ? (
            selectedVariant.sku ||
            ""
          )
        : "";

    const vendor =
      pageType ===
        "product" &&
      product
        ? (
            product.vendor ||
            ""
          )
        : "";

    const productType =
      pageType ===
        "product" &&
      product
        ? (
            product.type ||
            product.product_type ||
            ""
          )
        : "";

    let collectionHandle =
      "";

    let collectionTitle =
      "";

    if (
      pageType ===
      "collection"
    ) {
      collectionHandle =
        directCollectionHandle;

      collectionTitle =
        getPageHeading();
    } else if (
      pageType ===
      "product"
    ) {
      collectionHandle =
        breadcrumbCollection.handle;

      collectionTitle =
        breadcrumbCollection.title;
    }

    return {
      pageType:
        String(
          pageType ||
          ""
        ),

      pageTitle:
        String(
          getFriendlyPageTitle(
            pageType
          ) ||
          ""
        ),

      browserTitle:
        String(
          document.title ||
          ""
        ),

      pageUrl:
        String(
          window.location.href ||
          ""
        ),

      referrer:
        String(
          document.referrer ||
          ""
        ),

      productTitle:
        String(
          productTitle ||
          ""
        ),

      productHandle:
        String(
          productHandle ||
          ""
        ),

      productId:
        String(
          productId ||
          ""
        ),

      variantId:
        String(
          variantId ||
          ""
        ),

      variantTitle:
        String(
          variantTitle ||
          ""
        ),

      sku:
        String(
          sku ||
          ""
        ),

      vendor:
        String(
          vendor ||
          ""
        ),

      productType:
        String(
          productType ||
          ""
        ),

      collectionHandle:
        String(
          collectionHandle ||
          ""
        ),

      collectionTitle:
        String(
          collectionTitle ||
          ""
        )
    };
  }

  let pageContext =
    captureShopifyContext();

  /*
  |--------------------------------------------------------------------------
  | Product-Aware Search
  |--------------------------------------------------------------------------
  */

  function isContextDependentQuestion(
    question
  ) {
    if (
      !question
    ) {
      return false;
    }

    /*
     * Explicit "this / it" questions.
     */

    if (
      hasAnyPhrase(
        question,
        CONTEXTUAL_QUESTION_PHRASES
      )
    ) {
      return true;
    }

    /*
     * Very short generic questions on a product page are also likely
     * referring to the current product.
     */

    const words =
      getWords(
        question
      );

    if (
      words.length <= 5
    ) {
      return true;
    }

    return false;
  }

  function buildContextualSearchQuestion(
    customerQuestion
  ) {
    pageContext =
      captureShopifyContext();

    /*
     * Do not inject product context when we're not on a product page.
     */

    if (
      pageContext.pageType !==
        "product" ||
      !pageContext.productTitle
    ) {
      return customerQuestion;
    }

    /*
     * If the customer already named the product,
     * don't unnecessarily duplicate the title.
     */

    const normalizedQuestion =
      normalizeText(
        customerQuestion
      );

    const normalizedProduct =
      normalizeText(
        pageContext.productTitle
      );

    if (
      normalizedProduct &&
      normalizedQuestion.includes(
        normalizedProduct
      )
    ) {
      return customerQuestion;
    }

    if (
      !isContextDependentQuestion(
        customerQuestion
      )
    ) {
      return customerQuestion;
    }

    const contextParts = [
      customerQuestion,

      `Product ${pageContext.productTitle}`
    ];

    if (
      pageContext.productType
    ) {
      contextParts.push(
        `Product type ${pageContext.productType}`
      );
    }

    if (
      pageContext.collectionTitle
    ) {
      contextParts.push(
        `Collection ${pageContext.collectionTitle}`
      );
    }

    if (
      pageContext.productHandle
    ) {
      contextParts.push(
        pageContext.productHandle
          .replace(
            /-/g,
            " "
          )
      );
    }

    return contextParts.join(
      " "
    );
  }

  function getProductContextWords() {
    if (
      pageContext.pageType !==
      "product"
    ) {
      return [];
    }

    return uniqueWords(
      getWords(
        [
          pageContext.productTitle,
          pageContext.productType,
          pageContext.collectionTitle,
          pageContext.productHandle
            .replace(
              /-/g,
              " "
            )
        ].join(
          " "
        )
      )
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Transcript
  |--------------------------------------------------------------------------
  */

  function addTranscriptEntry(
    role,
    message
  ) {
    const cleanRole =
      String(
        role ||
        ""
      ).trim();

    const cleanMessage =
      String(
        message ||
        ""
      ).trim();

    if (
      !cleanRole ||
      !cleanMessage
    ) {
      return;
    }

    transcript.push({
      role:
        cleanRole,

      message:
        cleanMessage,

      timestamp:
        new Date()
          .toISOString()
    });

    if (
      transcript.length >
      100
    ) {
      transcript =
        transcript.slice(
          -100
        );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Intent Detection
  |--------------------------------------------------------------------------
  */

  function detectQuestionIntent(
    question
  ) {
    if (
      hasAnyPhrase(
        question,
        GLUE_REMOVAL_PHRASES
      )
    ) {
      return "cleaning";
    }

    if (
      hasAnyPhrase(
        question,
        GLUE_INSTALLATION_PHRASES
      )
    ) {
      return "installation";
    }

    const normalized =
      normalizeText(
        question
      );

    const rules = [
      [
        "cleaning",
        [
          "clean",
          "cleaning",
          "wash",
          "stain",
          "tar",
          "scrub",
          "cleaner",
          "bleach",
          "remove"
        ]
      ],

      [
        "installation",
        [
          "adhesive",
          "glue",
          "install",
          "installation",
          "seam",
          "subfloor",
          "threshold",
          "floating"
        ]
      ],

      [
        "shipping",
        [
          "shipping",
          "ship",
          "delivery",
          "freight",
          "tracking"
        ]
      ],

      [
        "ordering",
        [
          "order",
          "buy",
          "purchase",
          "price",
          "pricing",
          "cost"
        ]
      ],

      [
        "warranty",
        [
          "warranty",
          "return",
          "claim",
          "defect"
        ]
      ],

      [
        "pet",
        [
          "dog",
          "cat",
          "pet",
          "crate",
          "kennel",
          "litter"
        ]
      ],

      [
        "marine",
        [
          "boat",
          "pontoon",
          "marine",
          "dock",
          "outdoor",
          "outside"
        ]
      ],

      [
        "shed",
        [
          "shed"
        ]
      ],

      [
        "garage",
        [
          "garage",
          "epoxy"
        ]
      ],

      [
        "sport",
        [
          "gym",
          "gymnastics",
          "cheer",
          "tumbling",
          "sport",
          "exercise"
        ]
      ]
    ];

    for (
      let i = 0;
      i <
      rules.length;
      i += 1
    ) {
      if (
        rules[i][1].some(
          function (
            phrase
          ) {
            return normalized.includes(
              phrase
            );
          }
        )
      ) {
        return rules[i][0];
      }
    }

    return null;
  }

  function getEntryIntent(
    entry
  ) {
    const category =
      normalizeText(
        entry.category
      );

    const question =
      normalizeText(
        entry.question
      );

    if (
      category.includes(
        "installation"
      )
    ) {
      return "installation";
    }

    if (
      category.includes(
        "cleaning"
      )
    ) {
      return "cleaning";
    }

    if (
      category.includes(
        "shipping"
      )
    ) {
      return "shipping";
    }

    if (
      category.includes(
        "ordering"
      )
    ) {
      return "ordering";
    }

    if (
      category.includes(
        "warranty"
      ) ||
      question.includes(
        "return"
      )
    ) {
      return "warranty";
    }

    if (
      category.includes(
        "pet"
      )
    ) {
      return "pet";
    }

    if (
      category.includes(
        "marine"
      ) ||
      category.includes(
        "outdoor"
      )
    ) {
      return "marine";
    }

    if (
      category.includes(
        "shed"
      )
    ) {
      return "shed";
    }

    if (
      category.includes(
        "garage"
      )
    ) {
      return "garage";
    }

    if (
      category.includes(
        "sport"
      )
    ) {
      return "sport";
    }

    return null;
  }

  /*
  |--------------------------------------------------------------------------
  | Matching
  |--------------------------------------------------------------------------
  */

  function scorePhrase(
    question,
    phrase
  ) {
    const normalizedQuestion =
      normalizeText(
        question
      );

    const normalizedPhrase =
      normalizeText(
        phrase
      );

    if (
      normalizedQuestion ===
      normalizedPhrase
    ) {
      return 1;
    }

    if (
      normalizedQuestion.includes(
        normalizedPhrase
      ) ||
      normalizedPhrase.includes(
        normalizedQuestion
      )
    ) {
      const shorter =
        Math.min(
          normalizedQuestion.length,
          normalizedPhrase.length
        );

      const longer =
        Math.max(
          normalizedQuestion.length,
          normalizedPhrase.length
        );

      return Math.max(
        0.78,
        shorter /
          longer
      );
    }

    const questionWords =
      uniqueWords(
        getWords(
          question
        )
      );

    const phraseWords =
      uniqueWords(
        getWords(
          phrase
        )
      );

    if (
      !questionWords.length ||
      !phraseWords.length
    ) {
      return 0;
    }

    let matched =
      0;

    phraseWords.forEach(
      function (
        word
      ) {
        if (
          questionWords.includes(
            word
          )
        ) {
          matched +=
            GENERIC_WORDS.has(
              word
            )
              ? 0.3
              : 1;
        }
      }
    );

    return (
      matched /
      Math.max(
        questionWords.length,
        phraseWords.length
      )
    );
  }

  function calculateProductContextBonus(
    entry
  ) {
    if (
      pageContext.pageType !==
      "product"
    ) {
      return 0;
    }

    const productWords =
      getProductContextWords();

    if (
      productWords.length ===
      0
    ) {
      return 0;
    }

    const entryWords =
      new Set(
        getWords(
          [
            entry.category,
            entry.question,
            entry.product,
            ...(Array.isArray(
              entry.variations
            )
              ? entry.variations
              : [])
          ].join(
            " "
          )
        )
      );

    let matchedWords =
      0;

    productWords.forEach(
      function (
        word
      ) {
        if (
          entryWords.has(
            word
          ) &&
          !GENERIC_WORDS.has(
            word
          )
        ) {
          matchedWords +=
            1;
        }
      }
    );

    if (
      matchedWords ===
      0
    ) {
      return 0;
    }

    return Math.min(
      MATCH_CONFIG
        .productContextBonus,
      matchedWords *
        0.06
    );
  }

  function searchKnowledgeBase(
    customerQuestion
  ) {
    const searchQuestion =
      buildContextualSearchQuestion(
        customerQuestion
      );

    lastSearchQuestion =
      searchQuestion;

    const detectedIntent =
      detectQuestionIntent(
        customerQuestion
      );

    const isGlueRemoval =
      hasAnyPhrase(
        customerQuestion,
        GLUE_REMOVAL_PHRASES
      );

    const isGlueInstallation =
      hasAnyPhrase(
        customerQuestion,
        GLUE_INSTALLATION_PHRASES
      );

    let bestResult =
      null;

    knowledgeBase.forEach(
      function (
        entry
      ) {
        const phrases = [
          entry.question
        ].concat(
          Array.isArray(
            entry.variations
          )
            ? entry.variations
            : []
        );

        let score =
          0;

        phrases.forEach(
          function (
            phrase
          ) {
            score =
              Math.max(
                score,
                scorePhrase(
                  searchQuestion,
                  phrase
                )
              );
          }
        );

        const entryIntent =
          getEntryIntent(
            entry
          );

        if (
          detectedIntent &&
          entryIntent ===
          detectedIntent
        ) {
          score +=
            MATCH_CONFIG
              .intentMatchBonus;
        }

        if (
          detectedIntent &&
          entryIntent &&
          entryIntent !==
          detectedIntent
        ) {
          score -=
            MATCH_CONFIG
              .intentMismatchPenalty;
        }

        /*
         * Existing glue disambiguation.
         */

        if (
          isGlueInstallation
        ) {
          if (
            entry.id ===
            "kb-013-installation-adhesive-tape-and-seams"
          ) {
            score +=
              0.5;
          }

          if (
            entry.id ===
            "kb-019-how-to-remove-stains-or-tar-from-vinyl"
          ) {
            score -=
              0.5;
          }
        }

        if (
          isGlueRemoval
        ) {
          if (
            entry.id ===
            "kb-019-how-to-remove-stains-or-tar-from-vinyl"
          ) {
            score +=
              0.55;
          }

          if (
            entry.id ===
              "kb-013-installation-adhesive-tape-and-seams" ||
            entry.id ===
              "kb-039-glue-vinyl-to-wood"
          ) {
            score -=
              0.55;
          }
        }

        /*
         * Product-aware context bonus.
         */

        score +=
          calculateProductContextBonus(
            entry
          );

        score =
          Math.max(
            0,
            Math.min(
              score,
              1
            )
          );

        if (
          !bestResult ||
          score >
            bestResult.score
        ) {
          bestResult = {
            entry:
              entry,

            score:
              score,

            searchQuestion:
              searchQuestion
          };
        }
      }
    );

    if (
      !bestResult ||
      bestResult.score <
        MATCH_CONFIG
          .minimumMatchScore
    ) {
      return null;
    }

    return bestResult;
  }

  /*
  |--------------------------------------------------------------------------
  | Knowledge Base Loader
  |--------------------------------------------------------------------------
  */

  function loadKnowledgeBase() {
    if (
      knowledgeBaseLoaded
    ) {
      return Promise.resolve(
        knowledgeBase
      );
    }

    if (
      knowledgeBaseLoading
    ) {
      return knowledgeBaseLoadPromise;
    }

    knowledgeBaseLoading =
      true;

    knowledgeBaseLoadPromise =
      new Promise(
        function (
          resolve,
          reject
        ) {
          if (
            Array.isArray(
              window
                .GFloorKnowledgeBase
            )
          ) {
            knowledgeBase =
              window
                .GFloorKnowledgeBase;

            knowledgeBaseLoaded =
              true;

            knowledgeBaseLoading =
              false;

            resolve(
              knowledgeBase
            );

            return;
          }

          const script =
            document.createElement(
              "script"
            );

          script.src =
            KNOWLEDGE_BASE_URL +
            "?v=" +
            Date.now();

          script.async =
            true;

          script.onload =
            function () {
              if (
                Array.isArray(
                  window
                    .GFloorKnowledgeBase
                )
              ) {
                knowledgeBase =
                  window
                    .GFloorKnowledgeBase;

                knowledgeBaseLoaded =
                  true;

                knowledgeBaseLoading =
                  false;

                resolve(
                  knowledgeBase
                );

                return;
              }

              knowledgeBaseLoading =
                false;

              reject(
                new Error(
                  "Knowledge base did not initialize."
                )
              );
            };

          script.onerror =
            function () {
              knowledgeBaseLoading =
                false;

              reject(
                new Error(
                  "Knowledge base could not be loaded."
                )
              );
            };

          document.head.appendChild(
            script
          );
        }
      );

    return knowledgeBaseLoadPromise;
  }

  /*
  |--------------------------------------------------------------------------
  | Styles
  |--------------------------------------------------------------------------
  */

  const style =
    document.createElement(
      "style"
    );

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
      padding: 16px;
      background: #333e48;
      color: #ffffff;
    }

    .gfloor-chat-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .gfloor-chat-header strong {
      font-size: 18px;
    }

    .gfloor-conversation-id {
      color: #dfe4e8;
      font-size: 10px;
    }

    #gfloor-chat-close {
      border: 0;
      background: transparent;
      color: #ffffff;
      font-size: 26px;
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
    }

    .gfloor-primary-button {
      border: 0;
      background: #d2232a;
      color: #ffffff;
    }

    .gfloor-primary-button:disabled {
      opacity: .65;
      cursor: wait;
    }

    .gfloor-secondary-button {
      border: 1px solid #333e48;
      background: #ffffff;
      color: #333e48;
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
      font: 14px Arial, sans-serif;
    }

    .gfloor-question-row textarea,
    .gfloor-chat-field textarea {
      min-height: 92px;
      resize: vertical;
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
      margin-bottom: 6px;
      font-weight: 700;
      font-size: 15px;
    }

    .gfloor-response-category {
      display: inline-block;
      margin-bottom: 8px;
      padding: 3px 7px;
      border-radius: 999px;
      background: #e7e9eb;
      color: #4c5156;
      font-size: 11px;
      font-weight: 700;
    }

    .gfloor-context-note {
      margin-bottom: 10px;
      padding: 8px;
      border-radius: 6px;
      background: #eef2f4;
      color: #555555;
      font-size: 12px;
      line-height: 1.4;
    }

    .gfloor-response-source {
      margin-top: 12px;
    }

    .gfloor-response-source a {
      color: #b91f25;
      font-weight: 700;
    }

    .gfloor-escalation-note {
      margin-top: 12px;
      padding: 10px;
      border-left: 4px solid #d2232a;
      background: #fff7f7;
      font-size: 13px;
    }

    .gfloor-helpful-question {
      margin-top: 12px;
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

    .gfloor-back {
      margin-bottom: 12px;
      border: 0;
      background: transparent;
      color: #333e48;
      font: 700 13px Arial, sans-serif;
      cursor: pointer;
      padding: 0;
    }

    .gfloor-status-box,
    .gfloor-page-context-box {
      padding: 12px;
      margin-bottom: 14px;
      border-radius: 6px;
      background: #f2f3f4;
      font-size: 13px;
      line-height: 1.5;
    }

    .gfloor-status-box.available {
      border-left: 4px solid #16733c;
    }

    .gfloor-status-box.offline {
      border-left: 4px solid #d2232a;
    }

    .gfloor-page-context-label {
      display: block;
      margin-bottom: 4px;
      color: #555555;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .gfloor-page-context-product {
      display: block;
      font-weight: 700;
    }

    .gfloor-page-context-variant {
      display: block;
      margin-top: 3px;
      color: #555555;
      font-size: 12px;
    }

    .gfloor-page-context-type {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 7px;
      border-radius: 999px;
      background: #e2e5e8;
      color: #555555;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .gfloor-human-title {
      margin: 0 0 10px;
      font-size: 18px;
    }

    .gfloor-human-actions {
      display: grid;
      gap: 9px;
      margin-top: 16px;
    }

    .gfloor-wait-time {
      margin-top: 8px;
      font-weight: 700;
    }

    .gfloor-chat-field {
      margin-bottom: 12px;
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

  document.head.appendChild(
    style
  );

  /*
  |--------------------------------------------------------------------------
  | HTML
  |--------------------------------------------------------------------------
  */

  const panel =
    document.createElement(
      "section"
    );

  panel.id =
    "gfloor-chat-panel";

  panel.setAttribute(
    "aria-label",
    "G-Floor customer support chat"
  );

  panel.innerHTML = `
    <div class="gfloor-chat-header">

      <div class="gfloor-chat-title-wrap">
        <strong>
          Chat with G-Floor
        </strong>

        <span class="gfloor-conversation-id">
          ${conversationId}
        </span>
      </div>

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
          <button class="gfloor-topic-button" type="button" data-topic="flooring">Find the Right Flooring</button>
          <button class="gfloor-topic-button" type="button" data-topic="installation">Installation Questions</button>
          <button class="gfloor-topic-button" type="button" data-topic="shipping">Shipping & Delivery</button>
          <button class="gfloor-topic-button" type="button" data-topic="order">Order Help</button>
          <button class="gfloor-topic-button" type="button" data-topic="cleaning">Cleaning & Maintenance</button>
          <button class="gfloor-topic-button" type="button" data-topic="warranty">Warranty & Returns</button>
          <button class="gfloor-topic-button" type="button" data-topic="other">Something Else</button>
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
        id="gfloor-human-view"
        hidden
      >

        <button
          id="gfloor-human-back-button"
          class="gfloor-back"
          type="button"
        >
          &larr; Back
        </button>

        <h2 class="gfloor-human-title">
          Connect with Customer Service
        </h2>

        <div
          id="gfloor-human-status"
          class="gfloor-status-box"
        >
          Checking Customer Service availability...
        </div>

        <div
          id="gfloor-human-actions"
          class="gfloor-human-actions"
          hidden
        >

          <button
            id="gfloor-connect-button"
            class="gfloor-primary-button"
            type="button"
          >
            Yes, connect me
          </button>

          <button
            id="gfloor-stay-chat-button"
            class="gfloor-secondary-button"
            type="button"
          >
            No, keep using chat
          </button>

        </div>

      </div>

      <div
        id="gfloor-contact-view"
        hidden
      >

        <button
          id="gfloor-contact-back-button"
          class="gfloor-back"
          type="button"
        >
          &larr; Back
        </button>

        <p class="gfloor-form-note">
          Please provide your contact information so our Customer Service team can help.
        </p>

        <div
          id="gfloor-page-context-box"
          class="gfloor-page-context-box"
          hidden
        ></div>

        <div
          id="gfloor-agent-status"
          class="gfloor-status-box"
        ></div>

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

  /*
  |--------------------------------------------------------------------------
  | Launcher
  |--------------------------------------------------------------------------
  */

  const button =
    document.createElement(
      "button"
    );

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

  document.body.appendChild(
    panel
  );

  document.body.appendChild(
    button
  );

  /*
  |--------------------------------------------------------------------------
  | Elements
  |--------------------------------------------------------------------------
  */

  const closeButton =
    panel.querySelector(
      "#gfloor-chat-close"
    );

  const homeView =
    panel.querySelector(
      "#gfloor-chat-home"
    );

  const humanView =
    panel.querySelector(
      "#gfloor-human-view"
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

  const humanBackButton =
    panel.querySelector(
      "#gfloor-human-back-button"
    );

  const humanStatus =
    panel.querySelector(
      "#gfloor-human-status"
    );

  const humanActions =
    panel.querySelector(
      "#gfloor-human-actions"
    );

  const connectButton =
    panel.querySelector(
      "#gfloor-connect-button"
    );

  const stayChatButton =
    panel.querySelector(
      "#gfloor-stay-chat-button"
    );

  const contactBackButton =
    panel.querySelector(
      "#gfloor-contact-back-button"
    );

  const pageContextBox =
    panel.querySelector(
      "#gfloor-page-context-box"
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

  /*
  |--------------------------------------------------------------------------
  | Views
  |--------------------------------------------------------------------------
  */

  function hideAllViews() {
    homeView.hidden =
      true;

    humanView.hidden =
      true;

    contactView.hidden =
      true;
  }

  function showHome() {
    hideAllViews();

    homeView.hidden =
      false;
  }

  function togglePanel(
    open
  ) {
    panel.classList.toggle(
      "open",
      open
    );

    button.setAttribute(
      "aria-expanded",
      String(
        open
      )
    );

    if (
      open
    ) {
      pageContext =
        captureShopifyContext();

      loadKnowledgeBase()
        .catch(
          function (
            error
          ) {
            console.error(
              "G-Floor knowledge base error:",
              error
            );
          }
        );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Customer Service Status
  |--------------------------------------------------------------------------
  */

  async function getAgentAvailability() {
    try {
      const response =
        await fetch(
          STATUS_API_URL
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.message ||
          "Availability check failed."
        );
      }

      currentSupportStatus =
        data;

      return data;
    } catch (
      error
    ) {
      return (
        currentSupportStatus
      );
    }
  }

  async function showHumanConfirmation() {
    hideAllViews();

    humanView.hidden =
      false;

    humanActions.hidden =
      true;

    humanStatus.className =
      "gfloor-status-box";

    humanStatus.textContent =
      "Checking Customer Service availability...";

    const status =
      await getAgentAvailability();

    if (
      status.liveAgentAvailable
    ) {
      humanStatus.className =
        "gfloor-status-box available";

      humanStatus.innerHTML = `
        I can connect you with a G-Floor Customer Service representative.

        <div class="gfloor-wait-time">
          Estimated wait time: approximately
          ${escapeHtml(
            status.estimatedWaitMinutes ||
            "2-5"
          )} minutes.
        </div>
      `;

      connectButton.textContent =
        "Yes, connect me";
    } else {
      humanStatus.className =
        "gfloor-status-box offline";

      humanStatus.innerHTML = `
        Our Customer Service team is currently offline.

        <div style="margin-top:8px;">
          Live support hours are Monday-Friday, 8 AM-5 PM Central Time.
        </div>

        <div style="margin-top:8px;">
          You can leave a message and our team will follow up.
        </div>
      `;

      connectButton.textContent =
        "Leave a Message";
    }

    humanActions.hidden =
      false;
  }

  /*
  |--------------------------------------------------------------------------
  | Page Context Display
  |--------------------------------------------------------------------------
  */

  function getPageTypeLabel(
    pageType
  ) {
    const labels = {
      home:
        "Homepage",

      product:
        "Product",

      collection:
        "Collection",

      page:
        "Page",

      article:
        "Article",

      cart:
        "Cart",

      search:
        "Search",

      unknown:
        "Page"
    };

    return (
      labels[
        pageType
      ] ||
      "Page"
    );
  }

  function renderPageContext() {
    pageContext =
      captureShopifyContext();

    if (
      pageContext.pageType ===
        "product" &&
      pageContext.productTitle
    ) {
      pageContextBox.innerHTML = `
        <span class="gfloor-page-context-label">
          You're viewing
        </span>

        <span class="gfloor-page-context-product">
          ${escapeHtml(
            pageContext.productTitle
          )}
        </span>

        ${
          pageContext.variantTitle
            ? `
              <span class="gfloor-page-context-variant">
                Variant: ${escapeHtml(
                  pageContext.variantTitle
                )}
              </span>
            `
            : ""
        }

        ${
          pageContext.sku
            ? `
              <span class="gfloor-page-context-variant">
                SKU: ${escapeHtml(
                  pageContext.sku
                )}
              </span>
            `
            : ""
        }

        <span class="gfloor-page-context-type">
          Product
        </span>
      `;

      pageContextBox.hidden =
        false;

      return;
    }

    pageContextBox.innerHTML = `
      <span class="gfloor-page-context-label">
        You're viewing
      </span>

      <span class="gfloor-page-context-product">
        ${escapeHtml(
          pageContext.pageTitle ||
          "G-Floor"
        )}
      </span>

      <span class="gfloor-page-context-type">
        ${escapeHtml(
          getPageTypeLabel(
            pageContext.pageType
          )
        )}
      </span>
    `;

    pageContextBox.hidden =
      false;
  }

  function showContactForm() {
    hideAllViews();

    contactView.hidden =
      false;

    renderPageContext();

    if (
      lastQuestion
    ) {
      messageField.value =
        lastQuestion;
    }

    if (
      currentSupportStatus
        .liveAgentAvailable
    ) {
      agentStatus.className =
        "gfloor-status-box available";

      agentStatus.textContent =
        "A Customer Service representative is currently available. Estimated wait time: approximately " +
        (
          currentSupportStatus
            .estimatedWaitMinutes ||
          "2-5"
        ) +
        " minutes.";
    } else {
      agentStatus.className =
        "gfloor-status-box offline";

      agentStatus.textContent =
        "Our Customer Service team is currently offline. Your message will be sent to Customer Service for follow-up.";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Response Rendering
  |--------------------------------------------------------------------------
  */

  function showNoMatchResponse() {
    lastMatchedIntent =
      null;

    lastMatchScore =
      0;

    const answer =
      "I couldn't find a confident answer to that question in our approved support information.";

    addTranscriptEntry(
      "G-Floor Support",
      answer
    );

    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      <div>
        ${escapeHtml(
          answer
        )}
      </div>

      <div class="gfloor-escalation-note">
        A Customer Service representative can help with this question.
      </div>

      <div class="gfloor-helpful-question">
        Would you like help from Customer Service?
      </div>
    `;

    responseBox.classList.add(
      "show"
    );

    helpfulActions.dataset.mode =
      "escalation";

    helpfulActions.classList.add(
      "show"
    );
  }

  function showKnowledgeResponse(
    match,
    originalQuestion
  ) {
    const entry =
      match.entry;

    lastMatchedIntent =
      entry;

    lastMatchScore =
      match.score;

    addTranscriptEntry(
      "G-Floor Support",
      entry.answer
    );

    const responseType =
      String(
        entry.responseType ||
        ""
      )
        .trim()
        .toUpperCase();

    const needsReview =
      responseType.includes(
        "HUMAN"
      ) ||
      responseType.includes(
        "ESCALATE"
      );

    const contextWasUsed =
      pageContext.pageType ===
        "product" &&
      pageContext.productTitle &&
      lastSearchQuestion !==
        originalQuestion;

    responseBox.innerHTML = `
      <span class="gfloor-response-title">
        G-Floor Support
      </span>

      ${
        contextWasUsed
          ? `
            <div class="gfloor-context-note">
              Answering based on the product you're currently viewing:
              <strong>
                ${escapeHtml(
                  pageContext.productTitle
                )}
              </strong>
            </div>
          `
          : ""
      }

      <span class="gfloor-response-category">
        ${escapeHtml(
          entry.category
        )}
      </span>

      <div>
        ${escapeHtml(
          entry.answer
        )}
      </div>

      ${
        entry.sourceUrl
          ? `
            <div class="gfloor-response-source">
              <a
                href="${escapeHtml(
                  entry.sourceUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn More
              </a>
            </div>
          `
          : ""
      }

      ${
        needsReview
          ? `
            <div class="gfloor-escalation-note">
              This question may depend on your specific situation. Customer Service can review the details with you before you make a final decision.
            </div>
          `
          : ""
      }

      <div class="gfloor-helpful-question">
        Did this answer your question?
      </div>
    `;

    responseBox.classList.add(
      "show"
    );

    helpfulActions.dataset.mode =
      "helpful";

    helpfulActions.classList.add(
      "show"
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Process Question
  |--------------------------------------------------------------------------
  */

  async function processQuestion(
    question
  ) {
    const cleanQuestion =
      String(
        question ||
        ""
      ).trim();

    if (
      !cleanQuestion
    ) {
      return;
    }

    pageContext =
      captureShopifyContext();

    lastQuestion =
      cleanQuestion;

    addTranscriptEntry(
      "Customer",
      cleanQuestion
    );

    /*
     * Record product context in the transcript when applicable.
     */

    if (
      pageContext.pageType ===
        "product" &&
      pageContext.productTitle
    ) {
      addTranscriptEntry(
        "System",
        "Customer is viewing: " +
        pageContext.productTitle +
        (
          pageContext.variantTitle
            ? " | Variant: " +
              pageContext.variantTitle
            : ""
        ) +
        (
          pageContext.sku
            ? " | SKU: " +
              pageContext.sku
            : ""
        )
      );
    }

    questionSubmit.disabled =
      true;

    questionSubmit.textContent =
      "Searching...";

    try {
      await loadKnowledgeBase();

      const match =
        searchKnowledgeBase(
          cleanQuestion
        );

      console.log(
        "G-Floor product-aware match:",
        {
          customerQuestion:
            cleanQuestion,

          searchQuestion:
            lastSearchQuestion,

          product:
            pageContext.productTitle,

          variant:
            pageContext.variantTitle,

          sku:
            pageContext.sku,

          matchedQuestion:
            match
              ? match.entry.question
              : null,

          score:
            match
              ? match.score
              : null
        }
      );

      if (
        match
      ) {
        showKnowledgeResponse(
          match,
          cleanQuestion
        );
      } else {
        showNoMatchResponse();
      }
    } catch (
      error
    ) {
      console.error(
        "G-Floor chat search error:",
        error
      );

      showNoMatchResponse();
    } finally {
      questionSubmit.disabled =
        false;

      questionSubmit.textContent =
        "Ask a Question";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Events
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
      togglePanel(
        false
      );
    }
  );

  topicButtons.forEach(
    function (
      topicButton
    ) {
      topicButton.addEventListener(
        "click",
        function () {
          const prompts = {
            flooring:
              "What is the best flooring for a garage?",

            installation:
              "Do I have to glue this down?",

            shipping:
              "What are your shipping and delivery details?",

            order:
              "Where can I buy G-Floor?",

            cleaning:
              "How do I clean this?",

            warranty:
              "I have a warranty or return question."
          };

          const topic =
            topicButton.dataset
              .topic;

          if (
            topic ===
            "other"
          ) {
            questionInput.focus();

            return;
          }

          questionInput.value =
            prompts[
              topic
            ];

          processQuestion(
            prompts[
              topic
            ]
          );
        }
      );
    }
  );

  questionSubmit.addEventListener(
    "click",
    function () {
      processQuestion(
        questionInput.value
      );
    }
  );

  questionInput.addEventListener(
    "keydown",
    function (
      event
    ) {
      if (
        event.key ===
          "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        processQuestion(
          questionInput.value
        );
      }
    }
  );

  helpfulYes.addEventListener(
    "click",
    function () {
      if (
        helpfulActions
          .dataset
          .mode ===
        "escalation"
      ) {
        addTranscriptEntry(
          "Customer",
          "Yes, I would like help from Customer Service."
        );

        showHumanConfirmation();

        return;
      }

      addTranscriptEntry(
        "Customer",
        "Yes, this answered my question."
      );

      responseBox.innerHTML = `
        <span class="gfloor-response-title">
          Glad we could help!
        </span>
      `;

      helpfulActions.classList.remove(
        "show"
      );
    }
  );

  helpfulNo.addEventListener(
    "click",
    function () {
      addTranscriptEntry(
        "Customer",
        "No, this did not answer my question."
      );

      showHumanConfirmation();
    }
  );

  humanButton.addEventListener(
    "click",
    function () {
      addTranscriptEntry(
        "Customer",
        "Requested Customer Service assistance."
      );

      showHumanConfirmation();
    }
  );

  humanBackButton.addEventListener(
    "click",
    showHome
  );

  stayChatButton.addEventListener(
    "click",
    function () {
      addTranscriptEntry(
        "Customer",
        "Chose to keep using automated chat."
      );

      showHome();
    }
  );

  connectButton.addEventListener(
    "click",
    function () {
      addTranscriptEntry(
        "Customer",
        currentSupportStatus
          .liveAgentAvailable
          ? "Requested connection to a live Customer Service representative."
          : "Requested to leave a message for Customer Service."
      );

      showContactForm();
    }
  );

  contactBackButton.addEventListener(
    "click",
    showHumanConfirmation
  );

  /*
  |--------------------------------------------------------------------------
  | Form Submission
  |--------------------------------------------------------------------------
  */

  form.addEventListener(
    "submit",
    async function (
      event
    ) {
      event.preventDefault();

      result.textContent =
        "";

      submitButton.disabled =
        true;

      submitButton.textContent =
        "Sending...";

      await getAgentAvailability();

      pageContext =
        captureShopifyContext();

      const contactMessage =
        form.message.value.trim();

      addTranscriptEntry(
        "Customer",
        "Customer Service message: " +
        contactMessage
      );

      const payload = {
        conversationId:
          conversationId,

        name:
          form.name.value.trim(),

        email:
          form.email.value.trim(),

        phone:
          form.phone.value.trim(),

        message:
          contactMessage,

        pageUrl:
          window.location.href,

        pageTitle:
          document.title,

        pageContext:
          pageContext,

        requestedLiveAgent:
          currentSupportStatus
            .liveAgentAvailable,

        matchedIntent:
          lastMatchedIntent
            ? lastMatchedIntent.id
            : null,

        matchedQuestion:
          lastMatchedIntent
            ? lastMatchedIntent.question
            : null,

        matchScore:
          lastMatchScore,

        transcript:
          transcript
      };

      try {
        const response =
          await fetch(
            MESSAGE_API_URL,
            {
              method:
                "POST",

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
        } catch (
          jsonError
        ) {
          data = {};
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
            "Message could not be sent."
          );
        }

        addTranscriptEntry(
          "System",
          "Message successfully sent to Customer Service."
        );

        result.style.color =
          "#16733c";

        result.textContent =
          "Thank you. Your message has been sent to G-Floor Customer Service. Reference: " +
          conversationId;

        form.reset();
      } catch (
        error
      ) {
        addTranscriptEntry(
          "System",
          "Customer Service email delivery is not active yet."
        );

        result.style.color =
          "#b42318";

        result.textContent =
          "Email delivery is not active yet. Your reference number is " +
          conversationId +
          ".";
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
    function (
      event
    ) {
      if (
        event.key ===
          "Escape" &&
        panel.classList.contains(
          "open"
        )
      ) {
        togglePanel(
          false
        );
      }
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Preload
  |--------------------------------------------------------------------------
  */

  setTimeout(
    function () {
      loadKnowledgeBase()
        .catch(
          function (
            error
          ) {
            console.error(
              "G-Floor knowledge base preload error:",
              error
            );
          }
        );
    },
    1000
  );
})();