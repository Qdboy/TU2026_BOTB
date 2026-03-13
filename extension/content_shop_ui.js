// PromptVault - Shop UI Enhancement v3
// ADDITIVE approach: never removes or replaces content.
// Injects an enhanced product panel AFTER the AI response
// and highlights product names inline with popovers.

(function () {
  "use strict";

  console.log("[PV-ShopUI] Script loaded.");

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

  function isShoppingRelated(text) {
    const lower = text.toLowerCase();
    let score = 0;
    for (const kw of SHOPPING_KEYWORDS) { if (lower.includes(kw)) score += 1; }
    for (const hint of PRODUCT_HINTS) { if (lower.includes(hint)) score += 2; }
    for (const pattern of SHOPPING_PATTERNS) { if (pattern.test(text)) score += 2; }
    return score >= 2;
  }

  // ========================================
  // PRODUCT CATEGORY ICONS
  // ========================================

  const CATEGORY_ICONS = {
    laptop: "💻", phone: "📱", tablet: "📱", monitor: "🖥️",
    headphones: "🎧", earbuds: "🎧", camera: "📷",
    tv: "📺", television: "📺", speaker: "🔊",
    keyboard: "⌨️", mouse: "🖱️",
    gpu: "🎮", console: "🎮", playstation: "🎮", xbox: "🎮", switch: "🎮",
    watch: "⌚", smartwatch: "⌚",
    shoes: "👟", sneakers: "👟", boots: "👢", jacket: "🧥",
    backpack: "🎒", shirt: "👕", pants: "👖",
    mattress: "🛏️", desk: "🪑", chair: "🪑",
    blender: "🍹", microwave: "📡", vacuum: "🧹",
    car: "🚗", bike: "🚲", scooter: "🛴",
    drill: "🔧", saw: "🔧", tools: "🔧",
    house: "🏠", home: "🏠", apartment: "🏢", condo: "🏢",
  };

  function getProductIcon(name) {
    const lower = name.toLowerCase();
    for (const [keyword, icon] of Object.entries(CATEGORY_ICONS)) {
      if (lower.includes(keyword)) return icon;
    }
    return "🛒";
  }

  // ========================================
  // PRODUCT IMAGE FETCHING
  // Uses Google favicon + product search thumbnails
  // ========================================

  function getProductImageUrl(productName) {
    // Google Shopping thumbnail via their search
    const encoded = encodeURIComponent(productName);
    return `https://www.google.com/search?tbm=isch&q=${encoded}&tbs=isz:m`;
  }

  // Generate a search-based image URL that actually works in img tags
  function getProductThumbUrl(productName) {
    const encoded = encodeURIComponent(productName + " product");
    // Use a placeholder with the product initial + gradient
    // Real images would need a backend proxy, but we can make attractive placeholders
    return null; // We'll use CSS gradient + icon instead
  }

  // ========================================
  // PRODUCT EXTRACTION (read-only, no DOM changes)
  // ========================================

  function extractProducts(contentEl) {
    const products = [];
    const seen = new Set();

    // Strategy 1: Bold product names
    const bolds = contentEl.querySelectorAll("strong, b");
    for (const bold of bolds) {
      const name = cleanName(bold.textContent);
      if (!name || seen.has(name.toLowerCase()) || !looksLikeProduct(name)) continue;
      seen.add(name.toLowerCase());

      const block = bold.closest("li") || bold.closest("p") || bold.parentElement;
      const ctx = parseContext(block, bold);

      products.push({
        name,
        icon: getProductIcon(name),
        element: bold,
        description: ctx.description,
        specs: ctx.specs,
        priceRange: ctx.priceRange,
      });
    }

    // Strategy 2: List items with product-like headings
    if (products.length === 0) {
      const items = contentEl.querySelectorAll("li");
      for (const li of items) {
        const text = li.textContent.trim();
        const match = text.match(/^(?:\d+\.\s*)?([A-Z][\w\s\-]+(?:\d{2,}[\w]*)?)/);
        if (!match) continue;
        const name = cleanName(match[1]);
        if (!name || seen.has(name.toLowerCase()) || !looksLikeProduct(name)) continue;
        seen.add(name.toLowerCase());

        const ctx = parseContextText(text.slice(match[0].length));
        products.push({
          name,
          icon: getProductIcon(name),
          element: null,
          description: ctx.description,
          specs: ctx.specs,
          priceRange: ctx.priceRange,
        });
      }
    }

    return products;
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
    if (description.length > 160) description = description.slice(0, 157) + "...";

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
  // UI BUILDING (additive — never replaces)
  // ========================================

  /**
   * Apply shopping mode styling to response wrapper.
   * Adds banner at top of content.
   */
  function styleResponse(responseEl, contentEl) {
    const wrapper = responseEl.closest("article")
      || responseEl.closest('[data-testid^="conversation-turn"]')
      || responseEl.closest(".group")
      || responseEl;

    wrapper.classList.add("pv-shopping-mode");

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
  }

  /**
   * Highlight product names inline — wraps them in a styled span
   * WITHOUT removing or replacing the original element.
   */
  function highlightProductInline(boldEl, product) {
    // Don't replace — just add a class and a data attribute
    boldEl.classList.add("pv-product-highlight");
    boldEl.setAttribute("data-pv-product", product.name);
    boldEl.setAttribute("data-pv-price", product.priceRange || "");
    boldEl.setAttribute("data-pv-icon", product.icon);

    // Add click to scroll to card
    boldEl.style.cursor = "pointer";
    boldEl.addEventListener("click", () => {
      const card = document.querySelector(`.pv-card[data-product="${CSS.escape(product.name)}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("pv-card-flash");
        setTimeout(() => card.classList.remove("pv-card-flash"), 1200);
      }
    });
  }

  /**
   * Build and inject the product showcase panel AFTER the response.
   */
  function injectProductPanel(contentEl, products) {
    const panel = document.createElement("div");
    panel.className = "pv-panel";

    // Panel header
    const header = document.createElement("div");
    header.className = "pv-panel-header";
    header.innerHTML = `
      <div class="pv-panel-header-left">
        <span class="pv-panel-logo">PV</span>
        <span class="pv-panel-title">Products mentioned</span>
        <span class="pv-panel-count">${products.length}</span>
      </div>
      <button class="pv-panel-toggle" aria-label="Toggle">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    // Panel body
    const body = document.createElement("div");
    body.className = "pv-panel-body";

    // Product cards
    const grid = document.createElement("div");
    grid.className = "pv-card-grid";

    products.forEach((product, i) => {
      const encoded = encodeURIComponent(product.name);
      const card = document.createElement("div");
      card.className = "pv-card";
      card.setAttribute("data-product", product.name);
      card.style.animationDelay = `${i * 0.06}s`;

      // Generate a color from product name for the gradient
      const hue = hashString(product.name) % 360;

      let specsHtml = "";
      if (product.specs?.length) {
        specsHtml = `<div class="pv-card-specs">${product.specs.map((s) => `<span class="pv-card-spec">${esc(s)}</span>`).join("")}</div>`;
      }

      card.innerHTML = `
        <div class="pv-card-visual" style="background: linear-gradient(135deg, hsl(${hue}, 45%, 92%), hsl(${(hue + 30) % 360}, 40%, 95%));">
          <span class="pv-card-emoji">${product.icon}</span>
          ${product.priceRange ? `<span class="pv-card-price-badge">${esc(product.priceRange)}</span>` : ""}
        </div>
        <div class="pv-card-content">
          <h3 class="pv-card-name">${esc(product.name)}</h3>
          ${product.description ? `<p class="pv-card-desc">${esc(product.description)}</p>` : ""}
          ${specsHtml}
          <div class="pv-card-actions">
            <a href="https://www.amazon.com/s?k=${encoded}" class="pv-card-btn pv-card-btn-primary" target="_blank" rel="noopener">
              Amazon
            </a>
            <a href="https://www.google.com/search?tbm=shop&q=${encoded}" class="pv-card-btn" target="_blank" rel="noopener">
              Google
            </a>
            <a href="https://www.bestbuy.com/site/searchpage.jsp?st=${encoded}" class="pv-card-btn" target="_blank" rel="noopener">
              Best Buy
            </a>
            <a href="https://www.google.com/search?q=${encoded}+review" class="pv-card-btn" target="_blank" rel="noopener">
              Reviews
            </a>
          </div>
        </div>
      `;

      // Add image search link as a small icon in the visual area
      const imgLink = document.createElement("a");
      imgLink.href = `https://www.google.com/search?tbm=isch&q=${encoded}+product`;
      imgLink.target = "_blank";
      imgLink.rel = "noopener";
      imgLink.className = "pv-card-img-link";
      imgLink.title = "Search images";
      imgLink.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
      card.querySelector(".pv-card-visual").appendChild(imgLink);

      grid.appendChild(card);
    });

    body.appendChild(grid);

    // Quick compare bar (2-4 products only, keeps it tight)
    if (products.length >= 2 && products.length <= 4) {
      const compare = document.createElement("div");
      compare.className = "pv-compare-bar";

      let compareHtml = `<div class="pv-compare-title">Quick compare</div><div class="pv-compare-chips">`;

      products.forEach((p) => {
        const enc = encodeURIComponent(p.name);
        const shortName = p.name.length > 25 ? p.name.slice(0, 23) + "..." : p.name;
        compareHtml += `
          <a href="https://www.google.com/search?tbm=shop&q=${enc}" class="pv-compare-chip" target="_blank" rel="noopener">
            <span class="pv-compare-chip-icon">${p.icon}</span>
            <span class="pv-compare-chip-name">${esc(shortName)}</span>
            ${p.priceRange ? `<span class="pv-compare-chip-price">${esc(p.priceRange)}</span>` : ""}
          </a>`;
      });

      compareHtml += `</div>`;
      compare.innerHTML = compareHtml;
      body.appendChild(compare);
    }

    panel.appendChild(header);
    panel.appendChild(body);

    // Toggle collapse
    header.querySelector(".pv-panel-toggle").addEventListener("click", () => {
      panel.classList.toggle("pv-panel-collapsed");
    });

    // Inject after the content element
    const insertTarget = contentEl.parentElement || contentEl;
    insertTarget.parentNode.insertBefore(panel, insertTarget.nextSibling);
  }

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }

  // ========================================
  // RESPONSE STABILITY
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
  console.log(`[PV-ShopUI] Hostname: ${hostname}, Platform: ${platformKey || "none"}`);
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

      console.log(`[PV-ShopUI] Shopping detected: "${promptText.slice(0, 50)}..."`);
      processed.add(el);

      let contentEl = el;
      if (platform.contentSelector !== platform.responseSelector) {
        const parent = el.closest('[data-testid^="conversation-turn"]') || el.parentElement;
        contentEl = parent?.querySelector(platform.contentSelector) || el;
      }

      waitForStable(contentEl).then((stableEl) => {
        if (!stableEl) return;
        if (stableEl.querySelector(".pv-mode-banner")) return;

        const products = extractProducts(stableEl);

        // 1. Style the response wrapper + add banner
        styleResponse(el, stableEl);

        if (products.length === 0) {
          console.log("[PV-ShopUI] Shopping mode applied, no products to showcase.");
          return;
        }

        // 2. Highlight product names inline (non-destructive)
        for (const product of products) {
          if (product.element && product.element.isConnected) {
            highlightProductInline(product.element, product);
          }
        }

        // 3. Inject product panel AFTER the response
        injectProductPanel(stableEl, products);

        console.log(`[PV-ShopUI] Enhanced: ${products.length} product(s) showcased.`);
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
    console.log(`[PV-ShopUI] Active on ${platform.name}.`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(start, 1500));
  } else {
    setTimeout(start, 1500);
  }
})();
