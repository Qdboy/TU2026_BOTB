// PromptVault - Popup Script

let allEntries = [];
let activeFilter = "all";

// ── Load entries from storage ──────────────────────────────────────────
function loadEntries() {
  chrome.runtime.sendMessage({ action: "get_entries" }, (res) => {
    allEntries = (res?.entries || []).reverse(); // newest first
    updateStats();
    renderEntries();
  });
}

// ── Update stat counters ───────────────────────────────────────────────
function updateStats() {
  const prompts = allEntries.filter((e) => e.type === "prompt").length;
  const responses = allEntries.filter((e) => e.type === "response").length;

  document.getElementById("count-total").textContent = allEntries.length;
  document.getElementById("count-prompts").textContent = prompts;
  document.getElementById("count-responses").textContent = responses;
}

// ── Filter entries ─────────────────────────────────────────────────────
function getFilteredEntries() {
  if (activeFilter === "all") return allEntries;
  return allEntries.filter(
    (e) => e.type === activeFilter || e.service === activeFilter
  );
}

// ── Render entry list ──────────────────────────────────────────────────
function renderEntries() {
  const container = document.getElementById("entries-container");
  const emptyState = document.getElementById("empty-state");
  const filtered = getFilteredEntries();

  // Remove old entry cards (keep empty state in DOM)
  container.querySelectorAll(".entry").forEach((el) => el.remove());

  if (filtered.length === 0) {
    emptyState.style.display = "flex";
    return;
  }

  emptyState.style.display = "none";

  filtered.forEach((entry, i) => {
    const card = document.createElement("div");
    card.className = `entry ${entry.type}`;

    const time = formatTime(entry.timestamp);
    const preview = entry.text.slice(0, 120);

    card.innerHTML = `
      <div class="entry-meta">
        <span class="entry-type">${entry.type}</span>
        <span class="entry-service">${entry.service || "Unknown"}</span>
        <span class="entry-time">${time}</span>
      </div>
      <div class="entry-text">${escapeHtml(preview)}${entry.text.length > 120 ? "…" : ""}</div>
    `;

    card.addEventListener("click", () => openModal(entry));
    container.appendChild(card);
  });
}

// ── Detail modal ───────────────────────────────────────────────────────
function openModal(entry) {
  const overlay = document.getElementById("modal-overlay");
  const title = document.getElementById("modal-title");
  const body = document.getElementById("modal-body");
  const footer = document.getElementById("modal-footer");

  const typeLabel = entry.type === "prompt" ? "📝 Prompt" : "🤖 Response";
  title.textContent = `${typeLabel} — ${entry.service}`;
  body.textContent = entry.text;
  footer.textContent = `Captured: ${new Date(entry.timestamp).toLocaleString()}  ·  ${entry.url}`;

  overlay.classList.add("open");
}

document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("modal-overlay").classList.remove("open");
});

document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove("open");
  }
});

// ── Export CSV ─────────────────────────────────────────────────────────
document.getElementById("btn-export").addEventListener("click", () => {
  const filtered = getFilteredEntries();
  if (filtered.length === 0) {
    showToast("Nothing to export");
    return;
  }

  const headers = ["type", "service", "text", "timestamp", "url"];
  const rows = filtered.map((e) =>
    headers.map((h) => `"${(e[h] || "").replace(/"/g, '""')}"`)
  );

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `promptvault_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`Exported ${filtered.length} entries`);
});

// ── Clear all ──────────────────────────────────────────────────────────
document.getElementById("btn-clear").addEventListener("click", () => {
  if (!confirm("Clear all captured data?")) return;
  chrome.runtime.sendMessage({ action: "clear_entries" }, () => {
    allEntries = [];
    updateStats();
    renderEntries();
    showToast("Cleared");
  });
});

// ── Filter tabs & stat clicks ──────────────────────────────────────────
document.querySelectorAll(".tab, .stat").forEach((el) => {
  el.addEventListener("click", () => {
    activeFilter = el.dataset.filter;

    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".stat").forEach((s) => s.classList.remove("active"));

    const matchingTab = document.querySelector(`.tab[data-filter="${activeFilter}"]`);
    const matchingStat = document.querySelector(`.stat[data-filter="${activeFilter}"]`);
    if (matchingTab) matchingTab.classList.add("active");
    if (matchingStat) matchingStat.classList.add("active");

    renderEntries();
  });
});

// ── Helpers ────────────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// ── Init ───────────────────────────────────────────────────────────────
loadEntries();

// Poll for new entries every 2s while popup is open
setInterval(loadEntries, 2000);
