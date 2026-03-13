// PromptVault - Shop UI Enhancement
// Transforms AI chat response bubbles when shopping intent is detected.
// Restyles the response container, reformats product mentions into
// interactive structured layouts, and makes product names clickable.

(function () {
  "use strict";

  // ========================================
  // PLATFORM CONFIGS
  // ========================================

  const PLATFORMS = {
    "chatgpt.com": {
      name: "ChatGPT",
      container: "main",
      promptSelector: '[data-message-author-role="user"]',
      responseSelector: '[data-message-author-role="assistant"]',
      contentSelector: ".markdown",
    },
    "chat.openai.com": {
      name: "ChatGPT",
      container: "main",
      promptSelector: '[data-message-author-role="user"]',
      responseSelector: '[data-message-author-role="assistant"]',
      contentSelector: ".markdown",
    },
    "perplexity.ai": {
      name: "Perplexity",
      container: "main",
      promptSelector: ".my-md.md\\:my-lg",
      responseSelector: ".prose",
      contentSelector: ".prose",
    },
    "claude.ai": {
      name: "Claude",
      container: "main",
      promptSelector: '[data-testid="user-message"]',
      responseSelector: '[data-testid="assistant-message"]',
      contentSelector: '[data-testid="assistant-message"]',
    },
  };

  // ========================================
  // SHOPPING DETECTION
  // ========================================

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

  function getShoppingScore(text) {
    const lower = text.toLowerCase();
    let score = 0;
    for (const kw of SHOPPING_KEYWORDS) { if (lower.includes(kw)) score += 1; }
    for (const hint of PRODUCT_HINTS) { if (lower.includes(hint)) score += 2; }
    for (const pattern of SHOPPING_PATTERNS) { if (pattern.test(text)) score += 2; }
    return score;
  }

  function isShoppingRelated(text) {
    return getShoppingScore(text) >= 2;
  }

  // ========================================
  // PRODUCT EXTRACTION
  // ========================================

  function extractProductSections(contentEl) {
    const sections = [];
    const seen = new Set();

    // Strategy 1: Bold product names — most common AI recommendation format
    const bolds = contentEl.querySelectorAll("strong, b");
    for (const bold of bolds) {
      const name = cleanName(bold.textContent);
      if (!name || seen.has(name.toLowerCase()) || !looksLikeProduct(name)) continue;
      seen.add(name.toLowerCase());

      // Get the containing block (li, p, or parent)
      const block = bold.closest("li") || bold.closest("p") || bold.parentElement;
      const ctx = parseContext(block, bold);

      sections.push({
        name,
        element: bold,
        block,
        description: ctx.description,
        specs: ctx.specs,
        priceRange: ctx.priceRange,
      });
    }

    // Strategy 2: List items with product-like headings
    if (sections.length === 0) {
      const items = contentEl.querySelectorAll("li");
      for (const li of items) {
        const text = li.textContent.trim();
        const match = text.match(/^(?:\d+\.\s*)?([A-Z][\w\s\-]+(?:\d{2,}[\w]*)?)/);
        if (!match) continue;
        const name = cleanName(match[1]);
        if (!name || seen.has(name.toLowerCase()) || !looksLikeProduct(name)) continue;
        seen.add(name.toLowerCase());

        const rest = text.slice(match[0].length);
        const ctx = parseContextText(rest);

        sections.push({
          name,
          element: null,
          block: li,
          description: ctx.description,
          specs: ctx.specs,
          priceRange: ctx.priceRange,
        });
      }
    }

    return sections;
  }

  function parseContext(block, boldEl) {
    const full = block ? block.textContent : "";
    const after = full.split(boldEl.textContent).slice(1).join("").trim();
    return parseContextText(after);
  }

  function parseContextText(text) {
    const clean = text.replace(/^[\s:—–\-]+/, "").trim();

    const priceMatch = clean.match(/\$[\d,]+(?:\s*[-–—to]+\s*\$[\d,]+)?/);
    const priceRange = priceMatch ? priceMatch[0] : null;

    const specPatterns = [
      /\d+\s*(?:GB|TB|MB)\s*(?:RAM|SSD|storage|memory)/gi,
      /\d+\.?\d*[\s-]*inch/gi,
      /\d+\s*(?:mAh|W|Hz|MP)/gi,
      /\d+\s*(?:hours?|hrs?)\s*battery/gi,
      /(?:IP)\d{2}/gi,
    ];
    const specs = [];
    for (const p of specPatterns) {
      const m = clean.match(p);
      if (m) specs.push(...m);
    }

    let description = clean;
    if (priceRange) description = description.replace(priceMatch[0], "").trim();
    if (description.length > 180) description = description.slice(0, 177) + "...";

    return { description: description || null, specs: specs.length ? specs : null, priceRange };
  }

  function looksLikeProduct(name) {
    if (name.length < 3 || name.length > 80) return false;
    const skip = [
      "pros", "cons", "features", "summary", "conclusion", "overview",
      "note", "tip", "warning", "option", "here are", "things to consider",
      "key factors", "final thoughts", "bottom line", "important",
    ];
    const lower = name.toLowerCase();
    if (skip.some((t) => lower === t || lower.startsWith(t))) return false;
    return /[A-Z]/.test(name) && (/\d/.test(name) || name.includes(" "));
  }

  function cleanName(raw) {
    return raw.replace(/[*_`]/g, "").replace(/^\d+\.\s*/, "").replace(/[:—–\-]\s*$/, "").trim();
  }

  // ========================================
  // UI TRANSFORMATION
  // ========================================

  /**
   * Apply shopping mode to the entire response container.
   */
  function transformResponse(responseEl, contentEl, promptText) {
    // Find the wrapper we want to restyle
    // On ChatGPT this is the closest article or turn container
    const wrapper = responseEl.closest("article")
      || responseEl.closest('[data-testid^="conversation-turn"]')
      || responseEl.closest(".group")
      || responseEl;

    // Mark it as shopping mode
    wrapper.classList.add("pv-shopping-mode");

    // Inject the shopping mode banner at the top of the content
    const banner = document.createElement("div");
    banner.className = "pv-mode-banner";
    banner.innerHTML = `
      <span class="pv-mode-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
      </span>
      <span class="pv-mode-text">Shopping Mode</span>
    `;
    contentEl.insertBefore(banner, contentEl.firstChild);

    return wrapper;
  }

  /**
   * Transform product bold text into interactive inline elements.
   * Rewrites the bold elements in-place.
   */
  function transformProductInline(boldEl, product) {
    const encoded = encodeURIComponent(product.name);

    // Create the interactive product chip
    const chip = document.createElement("span");
    chip.className = "pv-product-chip";
    chip.textContent = product.name;

    // Build the hover popover
    const popover = document.createElement("div");
    popover.className = "pv-product-popover";

    let popoverInner = `<div class="pv-pop-name">${esc(product.name)}</div>`;

    if (product.priceRange) {
      popoverInner += `<div class="pv-pop-price">${esc(product.priceRange)}</div>`;
    }

    if (product.specs?.length) {
      popoverInner += `<div class="pv-pop-specs">${product.specs.map((s) => `<span class="pv-pop-spec">${esc(s)}</span>`).join("")}</div>`;
    }

    popoverInner += `
      <div class="pv-pop-links">
        <a href="https://www.amazon.com/s?k=${encoded}" target="_blank" rel="noopener">Amazon</a>
        <a href="https://www.google.com/search?tbm=shop&q=${encoded}" target="_blank" rel="noopener">Google</a>
        <a href="https://www.bestbuy.com/site/searchpage.jsp?st=${encoded}" target="_blank" rel="noopener">Best Buy</a>
        <a href="https://www.google.com/search?q=${encoded}+review" target="_blank" rel="noopener">Reviews</a>
      </div>
    `;

    popover.innerHTML = popoverInner;
    chip.appendChild(popover);

    // Replace the bold element with our chip
    boldEl.replaceWith(chip);
  }

  /**
   * Transform list items that contain products into structured cards.
   */
  function transformProductList(contentEl, sections) {
    // Find all list items that contain products and group by their parent <ul>/<ol>
    const listsToTransform = new Map();

    for (const section of sections) {
      if (!section.block || section.block.tagName !== "LI") continue;
      const parentList = section.block.parentElement;
      if (!parentList) continue;

      if (!listsToTransform.has(parentList)) {
        listsToTransform.set(parentList, []);
      }
      listsToTransform.get(parentList).push(section);
    }

    // Replace each product list with a structured grid
    for (const [listEl, products] of listsToTransform) {
      if (products.length < 2) continue; // Only transform lists with 2+ products

      const grid = document.createElement("div");
      grid.className = "pv-product-grid";

      for (const product of products) {
        const encoded = encodeURIComponent(product.name);
        const card = document.createElement("div");
        card.className = "pv-grid-card";

        let cardHtml = `
          <div class="pv-grid-header">
            <span class="pv-grid-name">${esc(product.name)}</span>
            ${product.priceRange ? `<span class="pv-grid-price">${esc(product.priceRange)}</span>` : ""}
          </div>
        `;

        if (product.description) {
          cardHtml += `<p class="pv-grid-desc">${esc(product.description)}</p>`;
        }

        if (product.specs?.length) {
          cardHtml += `<div class="pv-grid-specs">${product.specs.map((s) => `<span class="pv-grid-spec">${esc(s)}</span>`).join("")}</div>`;
        }

        cardHtml += `
          <div class="pv-grid-links">
            <a href="https://www.amazon.com/s?k=${encoded}" target="_blank" rel="noopener">Amazon</a>
            <a href="https://www.google.com/search?tbm=shop&q=${encoded}" target="_blank" rel="noopener">Google</a>
            <a href="https://www.bestbuy.com/site/searchpage.jsp?st=${encoded}" target="_blank" rel="noopener">Best Buy</a>
            <a href="https://www.google.com/search?q=${encoded}+review" target="_blank" rel="noopener">Reviews</a>
          </div>
        `;

        card.innerHTML = cardHtml;
        grid.appendChild(card);
      }

      // Replace the original list with the grid
      listEl.replaceWith(grid);
    }
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ========================================
  // RESPONSE STABILITY DETECTOR
  // ========================================

  function waitForStable(el, stableMs = 1500) {
    return new Promise((resolve) => {
      if (!el) { resolve(null); return; }
      let timeout = setTimeout(() => { obs.disconnect(); resolve(el); }, stableMs);
      const obs = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => { obs.disconnect(); resolve(el); }, stableMs);
      });
      obs.observe(el, { childList: true, subtree: true, characterData: true });
    });
  }

  // ========================================
  // MAIN CONTROLLER
  // ========================================

  const hostname = window.location.hostname.replace("www.", "");
  const platformKey = Object.keys(PLATFORMS).find((k) => hostname.includes(k));
  if (!platformKey) return;

  const platform = PLATFORMS[platformKey];
  const processed = new WeakSet();
  let promptTexts = [];

  function scanAndTransform() {
    const prompts = document.querySelectorAll(platform.promptSelector);
    const responses = document.querySelectorAll(platform.responseSelector);

    promptTexts = [];
    prompts.forEach((el) => {
      promptTexts.push(el.innerText?.trim() || "");
    });

    responses.forEach((el, index) => {
      if (processed.has(el)) return;

      const promptText = promptTexts[index];
      if (!promptText || !isShoppingRelated(promptText)) return;

      processed.add(el);

      // Find the content rendering area
      let contentEl = el;
      if (platform.contentSelector !== platform.responseSelector) {
        // For ChatGPT, look for .markdown inside the response turn
        const parent = el.closest('[data-testid^="conversation-turn"]') || el.parentElement;
        contentEl = parent?.querySelector(platform.contentSelector) || el;
      }

      waitForStable(contentEl).then((stableEl) => {
        if (!stableEl) return;

        // Already transformed?
        if (stableEl.querySelector(".pv-mode-banner")) return;

        const sections = extractProductSections(stableEl);
        if (sections.length === 0) {
          console.log("[PV-ShopUI] Shopping detected but no products found. Applying style only.");
        }

        // 1. Transform the response wrapper (restyle bubble)
        transformResponse(el, stableEl, promptText);

        // 2. Transform product list items into structured cards
        if (sections.length >= 2) {
          transformProductList(stableEl, sections);
        }

        // 3. Transform remaining bold product names into interactive chips
        // (must run after list transform since list transform may remove some elements)
        const remainingSections = extractProductSections(stableEl);
        for (const section of remainingSections) {
          if (section.element && section.element.isConnected) {
            transformProductInline(section.element, section);
          }
        }

        console.log(`[PV-ShopUI] Transformed response: ${sections.length} product(s) found`);
      });
    });
  }

  // ========================================
  // OBSERVER
  // ========================================

  function start() {
    const container = document.querySelector(platform.container) || document.body;
    const observer = new MutationObserver(() => scanAndTransform());
    observer.observe(container, { childList: true, subtree: true });
    scanAndTransform();
    console.log(`[PV-ShopUI] Active on ${platform.name}. Watching for shopping responses...`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 1500));
  } else {
    setTimeout(start, 1500);
  }
})();
