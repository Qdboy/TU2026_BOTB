// PromptVault - Content Script
// Observes the DOM for prompts and AI responses across supported services
// MODIFIED: Only captures prompts/responses related to shopping

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

    for (const kw of SHOPPING_KEYWORDS) {
      if (lower.includes(kw)) score += 1;
    }
    for (const pattern of SHOPPING_PATTERNS) {
      if (pattern.test(text)) score += 2;
    }

    return score >= 2;
  }

  // ---- Original PromptVault Logic (with shopping filter added) ----

  const hostname = window.location.hostname.replace("www.", "");
  const config = Object.keys(SERVICE_CONFIGS).find((key) =>
    hostname.includes(key)
  );

  if (!config) return;

  const service = SERVICE_CONFIGS[config];
  const seen = new Set();            // All text we've evaluated (shopping or not)
  const shoppingPrompts = new Set(); // Prompt texts confirmed as shopping-related

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

  function scanPage() {
    const prompts = document.querySelectorAll(service.promptSelector);
    const responses = document.querySelectorAll(service.responseSelector);

    // Build ordered list of all prompt texts so we can pair with responses
    const promptTexts = [];

    prompts.forEach((el) => {
      const text = getTextContent(el);
      if (!text) return;

      promptTexts.push(text);

      // Skip if already evaluated
      if (seen.has(text)) return;
      seen.add(text);

      if (isShoppingRelated(text)) {
        shoppingPrompts.add(text);
        saveEntry("prompt", text);
        console.log(`[PromptVault] Shopping prompt saved: "${text.slice(0, 60)}..."`);
      } else {
        console.log(`[PromptVault] Skipped non-shopping prompt: "${text.slice(0, 60)}..."`);
      }
    });

    responses.forEach((el, index) => {
      const text = getTextContent(el);
      if (!text || seen.has(text)) return;
      seen.add(text);

      // Pair response[i] with prompt[i]
      const matchingPrompt = promptTexts[index];

      if (matchingPrompt && shoppingPrompts.has(matchingPrompt)) {
        saveEntry("response", text);
        console.log(`[PromptVault] Shopping response saved (${text.length} chars)`);
      } else {
        console.log(`[PromptVault] Skipped response (prompt wasn't shopping-related)`);
      }
    });
  }

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
