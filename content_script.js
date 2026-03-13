// PromptVault - Content Script
// Captures prompt/response pairs from AI services with a strict 1:1 ratio.
//
// Key insight: prompts are user-submitted text — they never stream and are
// complete the moment they appear in the DOM. Responses stream word-by-word
// and need a settle delay before capture. These two facts require separate
// tracking strategies, not a single shared timer.

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

  const hostname = window.location.hostname.replace("www.", "");
  const configKey = Object.keys(SERVICE_CONFIGS).find((key) =>
    hostname.includes(key)
  );
  if (!configKey) return;

  const service = SERVICE_CONFIGS[configKey];

  // Separate counters for prompts and responses.
  // Responses are only saved up to the number of saved prompts,
  // which enforces the 1:1 ratio at the source.
  let savedPromptCount   = 0;
  let savedResponseCount = 0;

  // Only responses need a settle delay — prompts are captured immediately.
  let responseSettleTimer = null;
  const SETTLE_DELAY = 1500;

  function getTextContent(el) {
    return el?.innerText?.trim() || "";
  }

  function sendEntry(type, text, pairIndex) {
    if (!text) return;
    chrome.runtime.sendMessage({
      action: "save_entry",
      entry: {
        type,
        text,
        pairIndex,
        service: service.name,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Prompts are complete the moment the user submits them — capture immediately,
  // no debounce needed. Stash the text in savedPrompts[] so even if ChatGPT
  // later replaces the DOM element, we still have the original text.
  const savedPromptTexts = [];

  function checkPrompts() {
    const prompts = [...document.querySelectorAll(service.promptSelector)];

    for (let i = savedPromptCount; i < prompts.length; i++) {
      const text = getTextContent(prompts[i]);
      if (!text) continue;

      savedPromptTexts[i] = text;          // stash text before element can change
      sendEntry("prompt", text, i);
      savedPromptCount = i + 1;
    }
  }

  // Responses stream — only capture after SETTLE_DELAY ms of DOM silence.
  // Never save more responses than we have saved prompts (1:1 guarantee).
  function checkResponses() {
    const responses = [...document.querySelectorAll(service.responseSelector)];

    // Cap at savedPromptCount — never get ahead of prompts
    const limit = Math.min(responses.length, savedPromptCount);

    for (let i = savedResponseCount; i < limit; i++) {
      const text = getTextContent(responses[i]);
      if (!text) continue;

      sendEntry("response", text, i);
      savedResponseCount = i + 1;
    }
  }

  const observer = new MutationObserver(() => {
    // Prompts: check immediately on every mutation — they're already complete
    checkPrompts();

    // Responses: reset the settle timer so we only capture once streaming stops
    clearTimeout(responseSettleTimer);
    responseSettleTimer = setTimeout(checkResponses, SETTLE_DELAY);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Initial scan for pre-existing conversation history (e.g. page reload)
  checkPrompts();
  checkResponses();

  console.log(`[PromptVault] Monitoring ${service.name}...`);
})();
