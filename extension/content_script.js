// PromptVault - Content Script
// Observes the DOM for prompts and AI responses across supported services
// Only captures prompts/responses related to shopping
// Waits for responses to finish streaming before saving

(function () {
  const SERVICE_CONFIGS = {
    "chatgpt.com": {
      name: "ChatGPT",
      promptSelector: '[data-message-author-role="user"]',
      responseSelector: '[data-message-author-role="assistant"]',
    },
    "chat.openai.com": {
      name: "ChatGPT",
      promptSelector: '[data-message-author-role="user"]',
      responseSelector: '[data-message-author-role="assistant"]',
    },
    "perplexity.ai": {
      name: "Perplexity",
      promptSelector: ".my-md.md\\:my-lg",
      responseSelector: ".prose",
    },
    "claude.ai": {
      name: "Claude",
      promptSelector: '[data-testid="user-message"]',
      responseSelector: '[data-testid="assistant-message"]',
    },
  };

  // ---- Shopping Intent Detection ----

  const SHOPPING_KEYWORDS = [
    "buy", "buying", "purchase", "shop", "shopping",
    "price", "pricing", "cost", "costs",
    "cheap", "cheapest", "affordable", "budget",
    "best", "top", "recommend", "recommendation",
    "compare", "comparison", "versus", "vs",
    "deal", "deals", "discount", "sale",
    "review", "reviews", "rating", "ratings",
    "specs", "specifications",
    "worth it", "worth buying",
    "upgrade", "alternative", "alternatives",
    "where to buy", "where can i get",
  ];

  const PRODUCT_HINTS = [
    "laptop", "phone", "tablet", "monitor", "headphones", "earbuds",
    "camera", "tv", "television", "speaker", "keyboard", "mouse",
    "gpu", "graphics card", "cpu", "processor", "ssd", "ram",
    "watch", "smartwatch", "fitness tracker",
    "console", "playstation", "xbox", "switch",
    "shoes", "sneakers", "boots", "jacket", "backpack", "shirt", "pants",
    "mattress", "desk", "chair", "office chair", "couch", "sofa",
    "blender", "microwave", "air fryer", "vacuum",
    "car", "bike", "scooter", "ebike",
    "drill", "saw", "tools", "mower",
  ];

  const SHOPPING_PATTERNS = [
    /what('s| is) the best .+ (for|under|around)/i,
    /which .+ should i (buy|get|pick)/i,
    /looking for (a|an|the|some) .+/i,
    /recommend .+ (for|under|around)/i,
    /how much (does|do|is|are) .+/i,
    /is (the |it |this )?.+ worth/i,
    /\$\d+/,
    /.+ or .+ \?/i,
    /best .+ (under|for|in) .+/i,
  ];

  function isShoppingRelated(text) {
    const lower = text.toLowerCase();
    let score = 0;
    for (const kw of SHOPPING_KEYWORDS) { if (lower.includes(kw)) score += 1; }
    for (const hint of PRODUCT_HINTS) { if (lower.includes(hint)) score += 2; }
    for (const pattern of SHOPPING_PATTERNS) { if (pattern.test(text)) score += 2; }
    return score >= 2;
  }

  // ---- Platform Detection ----

  const hostname = window.location.hostname.replace("www.", "");
  const config = Object.keys(SERVICE_CONFIGS).find((key) =>
    hostname.includes(key)
  );

  if (!config) return;

  const service = SERVICE_CONFIGS[config];

  // Track by DOM element, not text content — prevents streaming spam
  const seenPromptEls = new WeakSet();
  const seenResponseEls = new WeakSet();
  const pendingResponses = new WeakSet(); // Responses waiting to stabilize
  const shoppingPrompts = new Set();      // Prompt texts confirmed as shopping

  function getTextContent(el) {
    return el?.innerText?.trim() || "";
  }

  function saveEntry(type, text) {
    const entry = {
      type,
      text,
      service: service.name,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };
    chrome.runtime.sendMessage({ action: "save_entry", entry });
  }

  // Wait for an element's content to stop changing (streaming done)
  function waitForStable(el, stableMs = 1500) {
    return new Promise((resolve) => {
      let timeout = setTimeout(() => { obs.disconnect(); resolve(); }, stableMs);
      const obs = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => { obs.disconnect(); resolve(); }, stableMs);
      });
      obs.observe(el, { childList: true, subtree: true, characterData: true });
    });
  }

  function scanPage() {
    const prompts = document.querySelectorAll(service.promptSelector);
    const responses = document.querySelectorAll(service.responseSelector);

    // Build ordered prompt list for pairing
    const promptEls = [];
    prompts.forEach((el) => {
      const text = getTextContent(el);
      if (!text) return;
      promptEls.push({ el, text });

      if (seenPromptEls.has(el)) return;
      seenPromptEls.add(el);

      if (isShoppingRelated(text)) {
        shoppingPrompts.add(text);
        saveEntry("prompt", text);
        console.log(`[PromptVault] Shopping prompt saved: "${text.slice(0, 60)}..."`);
      } else {
        console.log(`[PromptVault] Skipped non-shopping prompt: "${text.slice(0, 60)}..."`);
      }
    });

    responses.forEach((el, index) => {
      // Skip if already saved or already waiting to stabilize
      if (seenResponseEls.has(el) || pendingResponses.has(el)) return;

      // Check if matching prompt was shopping-related
      const matchingPrompt = promptEls[index];
      if (!matchingPrompt || !shoppingPrompts.has(matchingPrompt.text)) return;

      // Mark as pending so we don't start another wait
      pendingResponses.add(el);

      // Wait for streaming to finish, then save once
      waitForStable(el).then(() => {
        const finalText = getTextContent(el);
        if (!finalText) return;

        seenResponseEls.add(el);
        saveEntry("response", finalText);
        console.log(`[PromptVault] Shopping response saved (${finalText.length} chars, final)`);
      });
    });
  }

  // Watch for new messages
  const observer = new MutationObserver(() => {
    scanPage();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  scanPage();

  console.log(`[PromptVault] Monitoring ${service.name} (shopping filter active)...`);
})();
