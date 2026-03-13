// PromptVault - Background Service Worker
// Receives captured entries from content scripts and persists them

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "save_entry") {
    const entry = message.entry;

    chrome.storage.local.get(["entries"], (result) => {
      const entries = result.entries || [];

      // Avoid duplicates (belt + suspenders alongside content script dedup)
      const isDuplicate = entries.some(
        (e) => e.text === entry.text && e.service === entry.service
      );

      if (!isDuplicate) {
        entries.push(entry);
        chrome.storage.local.set({ entries });
      }
    });
  }

  if (message.action === "get_entries") {
    chrome.storage.local.get(["entries"], (result) => {
      sendResponse({ entries: result.entries || [] });
    });
    return true; // Keep channel open for async response
  }

  if (message.action === "clear_entries") {
    chrome.storage.local.set({ entries: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
