const ui = {};
const state = {
  lastInput: "",
  lastVibe: "casual",
  lastLength: "medium",
  recognition: null,
  isListening: false,
};

const VIBE_CONFIG = {
  casual: {
    openers: [
      "Quick GenAI build update:",
      "Small build-in-public moment:",
      "Coffee thought from this week:",
    ],
    lessons: [
      "Biggest takeaway:",
      "What surprised me most:",
      "The part that clicked:",
    ],
    ctas: [
      "Curious how others would improve this workflow.",
      "If you are building in GenAI too, would love to compare notes.",
      "Open to feedback before I ship the next version.",
    ],
  },
  professional: {
    openers: [
      "GenAI project update:",
      "A practical GenAI lesson from this sprint:",
      "One implementation insight from my latest GenAI build:",
    ],
    lessons: [
      "Core learning:",
      "Most useful insight:",
      "The execution lesson:",
    ],
    ctas: [
      "Happy to share implementation details with anyone exploring similar systems.",
      "Interested in hearing how others are evaluating quality in similar use cases.",
      "Feedback is welcome from builders working on adjacent GenAI workflows.",
    ],
  },
  funny: {
    openers: [
      "My coffee and I shipped a GenAI experiment:",
      "Status update: I argued with my own prompt and learned something:",
      "Built a GenAI mini tool before my coffee got cold:",
    ],
    lessons: [
      "Plot twist:",
      "Unexpected lesson:",
      "The funny-but-useful part:",
    ],
    ctas: [
      "If your prompts also have moods, we should talk.",
      "Drop your weirdest GenAI debugging moment below.",
      "Would love ideas before I break this in version two.",
    ],
  },
};

const LENGTH_CONFIG = {
  short: { points: 2, detail: 1 },
  medium: { points: 3, detail: 2 },
  long: { points: 4, detail: 3 },
};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setupVoiceCapture();
  renderOutput("", []);
});

function cacheElements() {
  ui.form = document.querySelector("#generatorForm");
  ui.rantInput = document.querySelector("#rantInput");
  ui.lengthSelect = document.querySelector("#lengthSelect");
  ui.authorInput = document.querySelector("#authorInput");
  ui.outputPost = document.querySelector("#outputPost");
  ui.charCount = document.querySelector("#charCount");
  ui.wordCount = document.querySelector("#wordCount");
  ui.copyButton = document.querySelector("#copyButton");
  ui.remixButton = document.querySelector("#remixButton");
  ui.hookList = document.querySelector("#hookList");
  ui.startVoiceButton = document.querySelector("#startVoiceButton");
  ui.stopVoiceButton = document.querySelector("#stopVoiceButton");
  ui.voiceStatus = document.querySelector("#voiceStatus");
}

function bindEvents() {
  ui.form.addEventListener("submit", (event) => {
    event.preventDefault();
    generateFromInput();
  });

  ui.copyButton.addEventListener("click", handleCopy);
  ui.remixButton.addEventListener("click", handleRemix);
}

function setupVoiceCapture() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    ui.startVoiceButton.disabled = true;
    ui.stopVoiceButton.disabled = true;
    ui.voiceStatus.textContent = "Voice capture is not supported in this browser.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  state.recognition = recognition;

  recognition.addEventListener("result", (event) => {
    let finalTranscript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) {
        finalTranscript += `${event.results[index][0].transcript} `;
      }
    }

    if (finalTranscript.trim()) {
      const current = ui.rantInput.value.trim();
      ui.rantInput.value = current ? `${current} ${finalTranscript.trim()}` : finalTranscript.trim();
    }
  });

  recognition.addEventListener("error", (event) => {
    state.isListening = false;
    updateVoiceButtons();
    ui.voiceStatus.textContent = `Voice capture error: ${event.error}.`;
  });

  recognition.addEventListener("end", () => {
    state.isListening = false;
    updateVoiceButtons();
    if (ui.voiceStatus.textContent === "Listening... speak your rough idea.") {
      ui.voiceStatus.textContent = "Voice capture stopped.";
    }
  });

  ui.startVoiceButton.addEventListener("click", () => {
    if (!state.recognition || state.isListening) {
      return;
    }
    state.isListening = true;
    updateVoiceButtons();
    ui.voiceStatus.textContent = "Listening... speak your rough idea.";
    state.recognition.start();
  });

  ui.stopVoiceButton.addEventListener("click", () => {
    if (!state.recognition || !state.isListening) {
      return;
    }
    state.recognition.stop();
  });
}

function updateVoiceButtons() {
  ui.startVoiceButton.disabled = state.isListening;
  ui.stopVoiceButton.disabled = !state.isListening;
}

function generateFromInput() {
  const rant = normalizeWhitespace(ui.rantInput.value);
  if (!rant) {
    ui.voiceStatus.textContent = "Please add a thought before generating.";
    return;
  }

  const vibe = getSelectedVibe();
  const length = ui.lengthSelect.value;
  const author = normalizeWhitespace(ui.authorInput.value);

  state.lastInput = rant;
  state.lastVibe = vibe;
  state.lastLength = length;

  const keywords = extractKeywords(rant);
  const segments = collectSegments(rant, LENGTH_CONFIG[length]?.points || 3);
  const post = buildPost({ rant, vibe, length, author, keywords, segments });
  const hooks = buildHooks({ segments, keywords });

  renderOutput(post, hooks);
}

function handleRemix() {
  if (!state.lastInput) {
    return;
  }

  const nextVibe = rotateVibe(state.lastVibe);
  const author = normalizeWhitespace(ui.authorInput.value);
  const keywords = extractKeywords(state.lastInput);
  const segments = collectSegments(state.lastInput, LENGTH_CONFIG[state.lastLength]?.points || 3);
  const post = buildPost({
    rant: state.lastInput,
    vibe: nextVibe,
    length: state.lastLength,
    author,
    keywords,
    segments,
  });
  const hooks = buildHooks({ segments, keywords });

  state.lastVibe = nextVibe;
  const radio = document.querySelector(`input[name="vibe"][value="${nextVibe}"]`);
  if (radio) {
    radio.checked = true;
  }

  renderOutput(post, hooks);
}

async function handleCopy() {
  const post = ui.outputPost.value;
  if (!post) {
    return;
  }

  try {
    await navigator.clipboard.writeText(post);
    ui.copyButton.textContent = "Copied";
    window.setTimeout(() => {
      ui.copyButton.textContent = "Copy post";
    }, 1200);
  } catch (_error) {
    ui.voiceStatus.textContent = "Copy failed. Please copy manually.";
  }
}

function getSelectedVibe() {
  const selected = document.querySelector('input[name="vibe"]:checked');
  return selected ? selected.value : "casual";
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function collectSegments(text, desiredCount) {
  const parts = String(text)
    .split(/[.!?;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return ["I am building and learning from a GenAI side project."];
  }

  const ranked = parts
    .map((part) => ({ part, score: scoreSegment(part) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, desiredCount)
    .map((item) => sentenceCase(item.part));

  return ranked;
}

function scoreSegment(segment) {
  const lowered = segment.toLowerCase();
  let score = 0;
  const bonusWords = [
    "built",
    "building",
    "learned",
    "result",
    "improved",
    "users",
    "workflow",
    "problem",
    "solution",
    "debug",
    "model",
    "prompt",
    "data",
    "pipeline",
  ];

  bonusWords.forEach((word) => {
    if (lowered.includes(word)) {
      score += 3;
    }
  });

  if (segment.length >= 40 && segment.length <= 180) {
    score += 4;
  }

  const tokenCount = segment.split(/\s+/).length;
  score += Math.max(0, Math.min(8, tokenCount - 4));
  return score;
}

function sentenceCase(text) {
  if (!text) {
    return "";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildPost({ vibe, length, author, keywords, segments }) {
  const cfg = VIBE_CONFIG[vibe] || VIBE_CONFIG.casual;
  const lengthCfg = LENGTH_CONFIG[length] || LENGTH_CONFIG.medium;

  const opener = pick(cfg.openers);
  const lessonLabel = pick(cfg.lessons);
  const cta = pick(cfg.ctas);

  const lead = segments[0] || "I am exploring a practical GenAI idea.";
  const detailLines = segments.slice(1, 1 + lengthCfg.detail).map((segment) => `- ${segment}`);
  const takeaway = buildTakeaway(segments, keywords);
  const hashtags = buildHashtags(keywords);

  const lines = [
    opener,
    "",
    lead.endsWith(".") ? lead : `${lead}.`,
  ];

  if (detailLines.length) {
    lines.push("");
    detailLines.forEach((line) => lines.push(line));
  }

  lines.push("");
  lines.push(`${lessonLabel} ${takeaway}`);
  lines.push("");
  lines.push(cta);
  lines.push("");
  lines.push(hashtags.join(" "));

  if (author) {
    lines.push("");
    lines.push(`- ${author}`);
  }

  return lines.join("\n");
}

function buildTakeaway(segments, keywords) {
  const candidate = segments[1] || segments[0] || "";
  if (candidate) {
    return `clear framing and iteration improved the outcome more than overcomplicating prompts. (${candidate.toLowerCase()})`;
  }

  const keywordText = keywords.length ? keywords.slice(0, 2).join(" + ") : "clear goals + user feedback";
  return `${keywordText} gave the project direction and made the output more useful.`;
}

function buildHashtags(keywords) {
  const map = {
    genai: "GenAI",
    ai: "AI",
    llm: "LLM",
    prompt: "PromptEngineering",
    prompts: "PromptEngineering",
    rag: "RAG",
    resume: "ResumeTech",
    data: "DataScience",
    streamlit: "Streamlit",
    python: "Python",
    javascript: "JavaScript",
    product: "ProductDevelopment",
    startup: "BuildInPublic",
    workflow: "Automation",
  };

  const tags = [];
  keywords.forEach((word) => {
    const normalized = word.toLowerCase();
    if (map[normalized]) {
      tags.push(`#${map[normalized]}`);
    }
  });

  const unique = Array.from(new Set(tags));
  const defaults = ["#GenAI", "#BuildInPublic", "#LinkedIn", "#Tech"];
  const merged = unique.concat(defaults.filter((tag) => !unique.includes(tag)));
  return merged.slice(0, 5);
}

function extractKeywords(text) {
  const stopWords = new Set([
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "have",
    "about",
    "just",
    "really",
    "into",
    "your",
    "for",
    "was",
    "are",
    "but",
    "not",
    "you",
    "our",
    "can",
    "like",
    "more",
    "than",
    "then",
    "when",
    "what",
    "they",
    "them",
    "been",
    "will",
    "would",
    "made",
    "make",
    "also",
  ]);

  const counts = new Map();
  const tokens = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));

  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);
}

function buildHooks({ segments, keywords }) {
  const focus = (segments[0] || "a GenAI side project").replace(/\.$/, "");
  const keyword = keywords[0] || "GenAI";

  return [
    `I tested one ${keyword} idea and it changed how I build side projects.`,
    `What started as "${focus.toLowerCase()}" turned into a useful workflow.`,
    `If you had 30 minutes to improve one ${keyword} workflow, what would you build?`,
  ];
}

function rotateVibe(currentVibe) {
  const order = ["casual", "professional", "funny"];
  const index = order.indexOf(currentVibe);
  if (index === -1 || index === order.length - 1) {
    return order[0];
  }
  return order[index + 1];
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function renderOutput(post, hooks) {
  ui.outputPost.value = post;
  ui.copyButton.disabled = !post;
  ui.remixButton.disabled = !post;

  const charCount = post.length;
  const wordCount = post.trim() ? post.trim().split(/\s+/).length : 0;
  ui.charCount.textContent = `${charCount} characters`;
  ui.wordCount.textContent = `${wordCount} words`;

  ui.hookList.innerHTML = "";
  hooks.forEach((hook) => {
    const item = document.createElement("li");
    item.textContent = hook;
    ui.hookList.appendChild(item);
  });
}
