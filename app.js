const STORAGE_KEY = "pocket-space-items-v1";
const FILTERS = [
  { id: "all", label: "All" },
  { id: "task", label: "Tasks" },
  { id: "idea", label: "Ideas" },
  { id: "memory", label: "Memories" },
  { id: "reference", label: "References" },
];

const state = {
  items: [],
  filter: "all",
  query: "",
  captureType: "note",
};

const ui = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setCaptureType("note");
  state.items = loadItems();
  if (!state.items.length) {
    seedDemoItems();
  }
  render();
  registerServiceWorker();
});

function cacheElements() {
  ui.searchInput = document.querySelector("#searchInput");
  ui.filterBar = document.querySelector("#filterBar");
  ui.highlights = document.querySelector("#highlights");
  ui.focusList = document.querySelector("#focusList");
  ui.focusSummary = document.querySelector("#focusSummary");
  ui.timeline = document.querySelector("#timeline");
  ui.resultCount = document.querySelector("#resultCount");
  ui.seedButton = document.querySelector("#seedButton");
  ui.openComposer = document.querySelector("#openComposer");
  ui.fabButton = document.querySelector("#fabButton");
  ui.closeComposer = document.querySelector("#closeComposer");
  ui.clipboardButton = document.querySelector("#clipboardButton");
  ui.sheetBackdrop = document.querySelector("#sheetBackdrop");
  ui.composerSheet = document.querySelector("#composerSheet");
  ui.captureForm = document.querySelector("#captureForm");
  ui.captureTypes = Array.from(document.querySelectorAll(".capture-type"));
  ui.conditionalFields = Array.from(document.querySelectorAll("[data-visible-for]"));
}

function bindEvents() {
  ui.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderTimeline();
  });

  ui.seedButton.addEventListener("click", () => {
    seedDemoItems();
    render();
  });

  ui.openComposer.addEventListener("click", openComposer);
  ui.fabButton.addEventListener("click", openComposer);
  ui.closeComposer.addEventListener("click", closeComposer);
  ui.sheetBackdrop.addEventListener("click", closeComposer);

  ui.captureTypes.forEach((button) => {
    button.addEventListener("click", () => {
      setCaptureType(button.dataset.captureType);
    });
  });

  ui.clipboardButton.addEventListener("click", importClipboardText);

  ui.captureForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleCaptureSubmit();
  });

  ui.captureForm.addEventListener("reset", () => {
    setTimeout(() => setCaptureType("note"), 0);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.composerSheet.classList.contains("is-open")) {
      closeComposer();
    }
  });

  ui.timeline.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const itemId = event.target.closest("[data-item-id]")?.dataset.itemId;
    if (!action || !itemId) {
      return;
    }

    if (action === "toggle-done") {
      toggleDone(itemId);
    }

    if (action === "delete") {
      deleteItem(itemId);
    }
  });
}

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    console.warn("Failed to parse saved items", error);
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function seedDemoItems() {
  const now = Date.now();
  const demoEntries = [
    {
      title: "Pay electricity bill",
      content: "Need to pay before tomorrow night. Check the updated amount in the provider app.",
      type: "reminder",
      remindAt: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      title: "Community app idea",
      content: "Build a local volunteering board where colleges can post weekend needs and students can join fast.",
      type: "note",
    },
    {
      title: "Android article for later",
      content: "Interesting post about building share sheets and app shortcuts for quick capture on mobile.",
      type: "link",
      url: "https://developer.android.com",
    },
    {
      title: "Canteen menu screenshot",
      content: "Snapshot from lunch planning group chat.",
      type: "image",
      imageDataUrl: makePlaceholderImage(),
    },
  ];

  state.items = demoEntries.map((entry, index) =>
    buildSpaceItem({
      ...entry,
      createdAt: new Date(now - index * 1000 * 60 * 90).toISOString(),
    }),
  );
  saveItems();
}

async function handleCaptureSubmit() {
  const formData = new FormData(ui.captureForm);
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const url = normalizeUrl(String(formData.get("url") || "").trim());
  const remindAt = String(formData.get("remindAt") || "").trim();
  const imageFile = formData.get("image");

  let imageDataUrl = "";
  if (imageFile instanceof File && imageFile.size > 0) {
    imageDataUrl = await readFileAsDataUrl(imageFile);
  }

  const nextItem = buildSpaceItem({
    title,
    content,
    type: state.captureType,
    url,
    remindAt,
    imageDataUrl,
  });

  state.items.unshift(nextItem);
  saveItems();
  ui.captureForm.reset();
  setCaptureType("note");
  closeComposer();
  render();
}

function buildSpaceItem(entry) {
  const normalizedEntry = {
    ...entry,
    url: normalizeUrl(entry.url || ""),
  };
  const analysis = analyzeEntry(normalizedEntry);

  return {
    id: window.crypto?.randomUUID?.() || String(Date.now() + Math.random()),
    title: normalizedEntry.title,
    content: normalizedEntry.content || "",
    type: normalizedEntry.type,
    createdAt: normalizedEntry.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    url: normalizedEntry.url || "",
    remindAt: normalizedEntry.remindAt || "",
    imageDataUrl: normalizedEntry.imageDataUrl || "",
    summary: analysis.summary,
    category: analysis.category,
    tags: analysis.tags,
    actionLabel: analysis.actionLabel,
    actionNeeded: analysis.actionNeeded,
    priority: analysis.priority,
    status: "active",
  };
}

function analyzeEntry(entry) {
  const combined = `${entry.title || ""} ${entry.content || ""}`.trim();
  const lowered = combined.toLowerCase();
  const isTaskLike =
    entry.type === "reminder" ||
    /\b(todo|finish|submit|pay|call|send|buy|meeting|deadline|need to|must|tomorrow|today|asap)\b/.test(lowered);
  const isIdeaLike = /\bidea|build|could|maybe|prototype|concept|design|plan\b/.test(lowered);
  const isReferenceLike = entry.type === "link" || /\barticle|reference|read|research|guide|docs\b/.test(lowered);
  const isMemoryLike =
    entry.type === "image" || /\bphoto|screenshot|remember|menu|trip|memory|quote\b/.test(lowered);

  let category = "reference";
  if (isTaskLike) {
    category = "task";
  } else if (isIdeaLike) {
    category = "idea";
  } else if (isMemoryLike) {
    category = "memory";
  } else if (isReferenceLike) {
    category = "reference";
  }

  const tags = extractTags(entry, lowered, category);
  const summary = summarize(entry);
  const priority = inferPriority(entry, lowered, category);
  const actionNeeded = category === "task" || priority >= 2;
  const actionLabel = getActionLabel(category, entry.remindAt, lowered);

  return {
    category,
    tags,
    summary,
    priority,
    actionNeeded,
    actionLabel,
  };
}

function extractTags(entry, lowered, category) {
  const tags = new Set([category]);

  if (entry.url) {
    try {
      tags.add(new URL(entry.url).hostname.replace(/^www\./, ""));
    } catch (error) {
      console.warn("Bad URL skipped for tag extraction", error);
    }
  }

  [
    "college",
    "finance",
    "design",
    "android",
    "project",
    "study",
    "shopping",
    "meeting",
    "health",
  ].forEach((keyword) => {
    if (lowered.includes(keyword)) {
      tags.add(keyword);
    }
  });

  return Array.from(tags).slice(0, 5);
}

function summarize(entry) {
  const raw =
    entry.type === "link"
      ? `${entry.title}. ${entry.content || entry.url}`
      : `${entry.title}. ${entry.content || ""}`;

  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "Quick capture saved for later.";
  }

  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0];
  if (firstSentence.length <= 120) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, 117).trim()}...`;
}

function inferPriority(entry, lowered, category) {
  let score = 1;
  if (category === "task") {
    score = 2;
  }

  if (/\b(asap|urgent|important|deadline|today)\b/.test(lowered)) {
    score = 3;
  }

  if (entry.remindAt) {
    const dueAt = new Date(entry.remindAt).getTime();
    const hoursUntil = (dueAt - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil <= 24) {
      score = 3;
    } else if (hoursUntil <= 72) {
      score = Math.max(score, 2);
    }
  }

  return Math.max(1, Math.min(score, 3));
}

function getActionLabel(category, remindAt, lowered) {
  if (remindAt) {
    return "Reminder set";
  }

  if (category === "task") {
    return /\b(call|send)\b/.test(lowered) ? "Needs follow-up" : "Action suggested";
  }

  if (category === "idea") {
    return "Worth exploring";
  }

  if (category === "memory") {
    return "Saved for context";
  }

  return "Reference saved";
}

function render() {
  renderFilters();
  renderFocusSummary();
  renderHighlights();
  renderFocusList();
  renderTimeline();
}

function renderFilters() {
  ui.filterBar.innerHTML = FILTERS.map(
    (filter) => `
      <button
        class="filter-chip ${filter.id === state.filter ? "is-active" : ""}"
        data-filter="${filter.id}"
        type="button"
        role="tab"
        aria-selected="${String(filter.id === state.filter)}"
      >
        ${filter.label}
      </button>
    `,
  ).join("");

  ui.filterBar.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderFilters();
      renderTimeline();
    });
  });
}

function renderFocusSummary() {
  const actionItems = state.items.filter((item) => item.actionNeeded && item.status === "active");
  const urgentItems = actionItems.filter((item) => item.priority === 3);
  ui.focusSummary.innerHTML = `
    <strong>${actionItems.length}</strong>
    <span>${urgentItems.length} urgent, ${actionItems.length - urgentItems.length} worth checking soon</span>
  `;
}

function renderHighlights() {
  const activeItems = state.items.filter((item) => item.status === "active");
  const completedItems = state.items.filter((item) => item.status === "done");
  const ideas = activeItems.filter((item) => item.category === "idea").length;
  const reminders = activeItems.filter((item) => item.remindAt).length;
  const cards = [
    {
      label: "Open loops",
      metric: activeItems.filter((item) => item.category === "task").length,
      note: "Tasks or reminders that still need you",
    },
    {
      label: "Fresh ideas",
      metric: ideas,
      note: "Thoughts you can turn into projects later",
    },
    {
      label: "Completed",
      metric: completedItems.length,
      note: reminders ? `${reminders} reminder${reminders === 1 ? "" : "s"} currently scheduled` : "Nothing scheduled yet",
    },
  ];

  ui.highlights.innerHTML = cards
    .map(
      (card, index) => `
        <article class="highlight-card" style="--delay:${index * 70}ms">
          <span class="section-label">${card.label}</span>
          <strong class="metric">${card.metric}</strong>
          <p>${card.note}</p>
        </article>
      `,
    )
    .join("");
}

function renderFocusList() {
  const items = state.items
    .filter((item) => item.status === "active")
    .sort(sortByPriority)
    .slice(0, 4);

  if (!items.length) {
    ui.focusList.innerHTML = `<div class="empty-state">Capture something and the smart stack will start organizing it here.</div>`;
    return;
  }

  ui.focusList.innerHTML = items
    .map(
      (item, index) => `
        <article class="focus-card" style="--delay:${index * 60}ms">
          <div class="priority-band" data-priority="${item.priority}"></div>
          <div class="focus-top">
            <div>
              <p class="section-label">${friendlyCategory(item.category)}</p>
              <h3>${escapeHtml(item.title)}</h3>
            </div>
            <span class="type-chip" data-tone="${categoryTone(item.category)}">${item.actionLabel}</span>
          </div>
          <p>${escapeHtml(item.summary)}</p>
          <div class="focus-chips">
            <span class="meta-chip">${formatRelativeDate(item.createdAt)}</span>
            ${item.remindAt ? `<span class="meta-chip">Due ${formatDueDate(item.remindAt)}</span>` : ""}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTimeline() {
  const items = getVisibleItems();
  ui.resultCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"} visible`;

  if (!items.length) {
    ui.timeline.innerHTML = `
      <div class="empty-state">
        Nothing matches this filter yet. Try another search or capture a new item.
      </div>
    `;
    return;
  }

  ui.timeline.innerHTML = items
    .map(
      (item, index) => `
        <article class="item-card ${item.status === "done" ? "is-done" : ""}" data-item-id="${item.id}" style="--delay:${index * 45}ms">
          <div class="priority-band" data-priority="${item.priority}"></div>
          <div class="item-top">
            <div>
              <div class="chip-row">
                <span class="type-chip" data-tone="${categoryTone(item.category)}">${friendlyCategory(item.category)}</span>
                <span class="meta-chip">${labelType(item.type)}</span>
              </div>
              <h3>${escapeHtml(item.title)}</h3>
            </div>
            <div class="card-meta">
              <span class="meta-chip">${formatRelativeDate(item.createdAt)}</span>
            </div>
          </div>

          <div class="summary-block">${escapeHtml(item.summary)}</div>
          ${item.content ? `<p>${escapeHtml(item.content)}</p>` : ""}
          ${item.url ? `<p><a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a></p>` : ""}
          ${item.imageDataUrl ? `<img class="thumb" src="${item.imageDataUrl}" alt="Saved visual capture">` : ""}

          <div class="card-foot">
            <div class="chip-row">
              ${item.tags.map((tag) => `<span class="meta-chip">#${escapeHtml(tag)}</span>`).join("")}
              ${item.remindAt ? `<span class="meta-chip">Due ${formatDueDate(item.remindAt)}</span>` : ""}
            </div>
            <div class="card-actions">
              <button class="mini-button" data-action="toggle-done" type="button">
                ${item.status === "done" ? "Restore" : "Mark done"}
              </button>
              <button class="mini-button" data-action="delete" type="button">Delete</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function getVisibleItems() {
  return state.items
    .filter((item) => (state.filter === "all" ? true : item.category === state.filter))
    .filter((item) => {
      if (!state.query) {
        return true;
      }

      const haystack = [item.title, item.content, item.summary, item.tags.join(" ")].join(" ").toLowerCase();
      return haystack.includes(state.query);
    })
    .sort(sortByPriority);
}

function sortByPriority(a, b) {
  const dueA = a.remindAt ? new Date(a.remindAt).getTime() : Number.POSITIVE_INFINITY;
  const dueB = b.remindAt ? new Date(b.remindAt).getTime() : Number.POSITIVE_INFINITY;
  return (
    b.priority - a.priority ||
    Number(a.status === "done") - Number(b.status === "done") ||
    dueA - dueB ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function toggleDone(itemId) {
  state.items = state.items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status: item.status === "done" ? "active" : "done",
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  saveItems();
  render();
}

function deleteItem(itemId) {
  state.items = state.items.filter((item) => item.id !== itemId);
  saveItems();
  render();
}

function setCaptureType(nextType) {
  state.captureType = nextType;

  ui.captureTypes.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.captureType === nextType);
  });

  ui.conditionalFields.forEach((field) => {
    field.hidden = field.dataset.visibleFor !== nextType;
  });
}

function openComposer() {
  ui.composerSheet.classList.add("is-open");
  ui.composerSheet.setAttribute("aria-hidden", "false");
  ui.sheetBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  ui.captureForm.elements.title.focus();
}

function closeComposer() {
  ui.composerSheet.classList.remove("is-open");
  ui.composerSheet.setAttribute("aria-hidden", "true");
  ui.sheetBackdrop.hidden = true;
  document.body.style.overflow = "";
}

async function importClipboardText() {
  if (!navigator.clipboard?.readText) {
    ui.clipboardButton.textContent = "Clipboard unavailable here";
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      ui.clipboardButton.textContent = "Clipboard was empty";
      return;
    }

    ui.captureForm.elements.content.value = text;
    if (!ui.captureForm.elements.title.value) {
      ui.captureForm.elements.title.value = inferTitleFromText(text);
    }
    ui.clipboardButton.textContent = "Clipboard imported";
    setTimeout(() => {
      ui.clipboardButton.textContent = "Import clipboard text";
    }, 1800);
  } catch (error) {
    console.warn("Clipboard import failed", error);
    ui.clipboardButton.textContent = "Clipboard permission denied";
  }
}

function inferTitleFromText(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  return compact.slice(0, 60);
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch (error) {
    console.warn("Ignoring invalid URL", error);
  }

  return "";
}

function friendlyCategory(category) {
  return {
    task: "Task",
    idea: "Idea",
    memory: "Memory",
    reference: "Reference",
  }[category] || "Captured";
}

function labelType(type) {
  return {
    note: "Note",
    link: "Link",
    reminder: "Reminder",
    image: "Snapshot",
  }[type] || "Capture";
}

function categoryTone(category) {
  return {
    task: "sun",
    idea: "teal",
    memory: "teal",
    reference: "default",
  }[category] || "default";
}

function formatRelativeDate(isoString) {
  const deltaMs = Date.now() - new Date(isoString).getTime();
  const deltaHours = Math.floor(deltaMs / (1000 * 60 * 60));
  if (deltaHours < 1) {
    return "Just now";
  }
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }
  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays}d ago`;
  }
  return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDueDate(isoString) {
  return new Date(isoString).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function makePlaceholderImage() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b6f6d"/>
          <stop offset="100%" stop-color="#e46f2a"/>
        </linearGradient>
      </defs>
      <rect width="420" height="220" rx="26" fill="url(#bg)"/>
      <circle cx="80" cy="70" r="24" fill="rgba(255,255,255,0.55)"/>
      <path d="M35 170L128 104L198 152L280 92L386 170" fill="none" stroke="rgba(255,255,255,0.76)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="36" y="198" font-size="24" fill="white" font-family="Trebuchet MS, sans-serif">Saved visual context</text>
    </svg>
  `);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed", error);
      });
    });
  }
}
