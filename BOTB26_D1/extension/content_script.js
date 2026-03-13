// PromptVault - Content Script
// Observes the DOM for prompts and AI responses across supported services

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

  // Identify which service we're on
  const hostname = window.location.hostname.replace("www.", "");
  const config = Object.keys(SERVICE_CONFIGS).find((key) =>
    hostname.includes(key)
  );

  if (!config) return;

  const service = SERVICE_CONFIGS[config];
  const captured = new Set(); // Track already-captured text to avoid duplicates

  function getTextContent(el) {
    return el?.innerText?.trim() || "";
  }

  function captureEntry(type, text) {
    if (!text || captured.has(text)) return;
    captured.add(text);

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

    prompts.forEach((el) => captureEntry("prompt", getTextContent(el)));
    responses.forEach((el) => captureEntry("response", getTextContent(el)));
  }

  // Watch for dynamically added messages
  const observer = new MutationObserver(() => {
    scanPage();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial scan in case page already has content
  scanPage();

  console.log(`[PromptVault] Monitoring ${service.name}...`);
})();
