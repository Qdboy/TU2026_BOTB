// PromptVault - Background Service Worker
// Receives captured entries from content scripts and persists them.
// Enforces 1:1 prompt/response pairing as a second line of defence.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === "save_entry") {
    const entry = message.entry;

    chrome.storage.local.get(["entries"], (result) => {
      const entries = result.entries || [];

      // Reject if we already have an entry for this pairIndex + type.
      // pairIndex is set by content_script and guarantees each prompt
      // and response slot is only written once.
      const isDuplicate = entries.some(
        (e) =>
          e.pairIndex === entry.pairIndex &&
          e.type      === entry.type      &&
          e.service   === entry.service
      );

      if (!isDuplicate) {
        entries.push(entry);
        chrome.storage.local.set({ entries });
      }
    });
  }

  if (message.action === "get_entries") {
    chrome.storage.local.get(["entries"], (result) => {
      const entries = result.entries || [];

      // Build a clean, paired list so the popup always sees balanced data.
      // Group by service + pairIndex, only surface pairs where both sides exist.
      const pairMap = {};
      entries.forEach((e) => {
        const key = `${e.service}__${e.pairIndex}`;
        if (!pairMap[key]) pairMap[key] = {};
        pairMap[key][e.type] = e;
      });

      const paired = [];
      Object.values(pairMap).forEach((pair) => {
        if (pair.prompt)   paired.push(pair.prompt);
        if (pair.response) paired.push(pair.response);
      });

      // Sort by timestamp so the popup shows conversations in order
      paired.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      sendResponse({ entries: paired });
    });
    return true; // keep channel open for async response
  }

  if (message.action === "clear_entries") {
    chrome.storage.local.set({ entries: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

