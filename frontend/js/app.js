import { initSettingsPanel } from "./settings.js";
import { initDiagrams } from "./diagrams.js";
import { updateBackgroundForSentiment, normalizeSentiment, sentimentIconPath } from "./theme.js";

const chatLog = document.querySelector("#chat-log");
const composerForm = document.querySelector("#composer-form");
const statementInput = document.querySelector("#statement");
const sendButton = document.querySelector("#send-message");
const newConversationButton = document.querySelector("#new-conversation");
const typingIndicator = document.querySelector("#typing-indicator");
const statusPill = document.querySelector("#connection-status");
const toastRegion = document.querySelector("#toast-region");
const analysisTemplate = document.querySelector("#analysis-template");

const settingsModal = document.querySelector("#settings-modal");
const howModal = document.querySelector("#how-modal");
const creditsModal = document.querySelector("#credits-modal");

const KEY_API_BASE = "mindtone.apiBase";
const KEY_CONVERSATION = "mindtone.conversationId";
const KEY_UI_PREFS = "mindtone.uiPrefs";

let apiBase = "";
let conversationId = localStorage.getItem(KEY_CONVERSATION) || "";
let uiPreferences = readUiPreferences();

function readUiPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_UI_PREFS) || "{}");
    return {
      showDetailedGemini: parsed.showDetailedGemini !== false,
    };
  } catch {
    return { showDetailedGemini: true };
  }
}

function normalizeApiBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function setConnectionStatus(message, variant = "") {
  statusPill.textContent = message;
  statusPill.className = `status-pill ${variant}`.trim();
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function setUiPreferences(next) {
  uiPreferences = { ...uiPreferences, ...next };
  localStorage.setItem(KEY_UI_PREFS, JSON.stringify(uiPreferences));
}

function openModal(modal) {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  const closeButton = modal.querySelector(".close-btn");
  if (closeButton) closeButton.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  if (howModal.hidden && creditsModal.hidden && settingsModal.hidden) {
    document.body.style.overflow = "";
  }
}

function setApiBase(value) {
  apiBase = normalizeApiBase(value);
  localStorage.setItem(KEY_API_BASE, apiBase);
}

function getApiBase() {
  return apiBase;
}

function candidateApiBases(preferred = "") {
  const host = window.location.hostname ? `http://${window.location.hostname}:8000` : "";
  return [...new Set([
    preferred,
    localStorage.getItem(KEY_API_BASE),
    host,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
  ].map(normalizeApiBase).filter(Boolean))];
}

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.detail || data.message || `Request failed (${response.status})`);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Check backend connection.");
    }
    if (error instanceof SyntaxError) {
      throw new Error("Backend returned malformed JSON.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function probeBackend(base) {
  const normalized = normalizeApiBase(base);
  if (!normalized) return null;
  try {
    const health = await fetchJson(`${normalized}/health`, {}, 3500);
    return { base: normalized, health };
  } catch {
    return null;
  }
}

async function discoverBackend(preferred = "") {
  for (const candidate of candidateApiBases(preferred)) {
    const result = await probeBackend(candidate);
    if (result) {
      setApiBase(result.base);
      const isWarn = (result.health.enable_bert && !result.health.bert_model_loaded)
        || (result.health.enable_gemini && !result.health.gemini_configured);
      setConnectionStatus(
        isWarn ? "Connected with warnings" : "Connected",
        isWarn ? "warn" : "ok"
      );
      return true;
    }
  }

  setConnectionStatus("Backend offline", "error");
  return false;
}

function autoResizeTextarea() {
  statementInput.style.height = "auto";
  statementInput.style.height = `${Math.min(statementInput.scrollHeight, 180)}px`;
}

function appendMessage(role, text, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role} slide-up`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = role === "user" ? "You" : "Analyzer";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  article.append(meta, bubble);

  if (options.analysisResult) {
    const card = buildAnalysisCard(options.analysisResult, {
      showDetailedGemini: uiPreferences.showDetailedGemini,
    });
    article.appendChild(card);
  }

  chatLog.appendChild(article);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function isCrisisMentalLabel(label = "") {
  const normalized = String(label).toLowerCase();
  return normalized.includes("ang")
    || normalized.includes("depress")
    || normalized.includes("suicid");
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function describeDetailedMentalScores(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return "no score breakdown available";
  return scores
    .slice()
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .map((item) => `• ${item.label}: ${formatPercent(item.score)}`)
    .join("\n");
}

function populateScoreList(target, scores) {
  target.innerHTML = "";
  if (!Array.isArray(scores) || scores.length === 0) {
    const empty = document.createElement("p");
    empty.className = "analysis-line";
    empty.textContent = "No category score breakdown returned by Gemini.";
    target.appendChild(empty);
    return;
  }

  scores
    .slice()
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "score-item";

      const label = document.createElement("span");
      label.textContent = item.label;

      const bar = document.createElement("div");
      bar.className = "score-bar";
      const fill = document.createElement("span");
      fill.style.width = formatPercent(item.score);
      bar.appendChild(fill);

      const pct = document.createElement("strong");
      pct.textContent = formatPercent(item.score);

      row.append(label, bar, pct);
      target.appendChild(row);
    });
}

function buildAnalysisCard(result, options = {}) {
  const node = analysisTemplate.content.firstElementChild.cloneNode(true);
  const mental = result.mental_health || result;
  const bert = result.general_sentiment || {};
  
  let sentiment = options.calculatedTone;
  if (!sentiment) {
    const geminiLabel = String(mental.label || "unknown").toLowerCase();
    const bertLabel = String(bert.label || "neutral").toLowerCase();
    if (geminiLabel !== "unknown" && geminiLabel !== "skipped") {
      if (isCrisisMentalLabel(geminiLabel)) {
        sentiment = "crisis";
      } else if (geminiLabel === "normal") {
        sentiment = bertLabel === "positive" ? "positive" : "neutral";
      } else {
        sentiment = bertLabel === "negative" ? "crisis" : "negative";
      }
    } else {
      sentiment = bertLabel === "negative" ? "crisis" : bertLabel;
    }
  }

  const badge = node.querySelector("[data-sentiment-badge]");
  badge.classList.add(sentiment);
  badge.querySelector("img").src = sentimentIconPath(sentiment);
  badge.querySelector("[data-sentiment-text]").textContent = sentiment;
  if (sentiment === "crisis") {
    node.classList.add("crisis");
  }

  node.querySelector("[data-source]").textContent = `Source: ${mental.source || result.source || "model"}`;
  node.querySelector("[data-mental-label]").textContent = `${mental.label || "normal"}`;
  node.querySelector("[data-bert-label]").textContent = bert.label || "neutral";
  node.querySelector("[data-gemini-label]").textContent = mental.label || "normal";

  const confidence = Number(mental.confidence ?? result.confidence ?? 0);
  node.querySelector("[data-confidence-fill]").style.width = `${Math.round(confidence * 100)}%`;
  node.querySelector("[data-confidence-text]").textContent = `${Math.round(confidence * 100)}%`;
  node.querySelector("[data-recommendation]").textContent = result.recommendation || "No recommendation provided.";

  const detailedSection = node.querySelector("[data-detailed-gemini]");
  if (options.showDetailedGemini) {
    detailedSection.hidden = false;
    const scoreList = node.querySelector("[data-gemini-scores]");
    populateScoreList(scoreList, mental.all_scores || result.all_scores || []);
  } else {
    detailedSection.hidden = true;
  }

  return node;
}

function setTyping(active) {
  typingIndicator.classList.toggle("hidden", !active);
  sendButton.classList.toggle("pulse", active);
  sendButton.disabled = active;
}

async function analyzeStatement(statement) {
  if (!apiBase && !(await discoverBackend())) {
    throw new Error("Backend is not reachable.");
  }

  return fetchJson(`${apiBase}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statement, conversation_id: conversationId || null }),
  });
}

async function fetchSettings() {
  if (!apiBase && !(await discoverBackend())) {
    throw new Error("Backend is not reachable.");
  }
  return fetchJson(`${apiBase}/settings`);
}

async function saveSettings(payload) {
  if (!apiBase && !(await discoverBackend())) {
    throw new Error("Backend is not reachable.");
  }
  const saved = await fetchJson(`${apiBase}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const connected = await discoverBackend(apiBase);
  if (!connected) {
    setConnectionStatus("Saved, but backend health check failed.", "warn");
  }
  return saved;
}

async function testBackend(base) {
  const result = await probeBackend(base);
  if (!result) {
    setConnectionStatus("Connection test failed", "error");
    return false;
  }
  setApiBase(result.base);
  setConnectionStatus("Backend reachable", "ok");
  return true;
}

function bindModalEvents() {
  document.querySelector("#open-how").addEventListener("click", () => openModal(howModal));
  document.querySelector("#open-credits").addEventListener("click", () => openModal(creditsModal));

  document.querySelectorAll("[data-close='how']").forEach((button) => {
    button.addEventListener("click", () => closeModal(howModal));
  });

  document.querySelectorAll("[data-close='credits']").forEach((button) => {
    button.addEventListener("click", () => closeModal(creditsModal));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!howModal.hidden) closeModal(howModal);
    if (!creditsModal.hidden) closeModal(creditsModal);
  });
}

composerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const statement = statementInput.value.trim();
  if (!statement) return;

  appendMessage("user", statement);
  statementInput.value = "";
  autoResizeTextarea();
  setTyping(true);

  try {
    const result = await analyzeStatement(statement);
    conversationId = result.conversation_id;
    localStorage.setItem(KEY_CONVERSATION, conversationId);

    const mentalScores = result.mental_health?.all_scores || result.all_scores || [];
    const detailedText = describeDetailedMentalScores(mentalScores);
    const summary = uiPreferences.showDetailedGemini
      ? `Detailed Gemini analysis:\n${detailedText}`
      : `Analysis complete: ${result.general_sentiment?.label || "neutral"} sentiment and ${result.mental_health?.label || "normal"} mental-health label.`;
    appendMessage("ai", summary, { analysisResult: result });

    const crisisTone = isCrisisMentalLabel(result.mental_health?.label);
    const baseLabel = crisisTone ? "crisis" : (result.general_sentiment?.label || "neutral");
    const baseConfidence = result.general_sentiment?.confidence || 0.5;
    updateBackgroundForSentiment(baseLabel, baseConfidence);

    if (result.crisis_detected) {
      showToast("High-risk language detected. Consider immediate professional support.", "error");
    }

    setConnectionStatus("Analysis ready", "ok");
  } catch (error) {
    appendMessage("ai", error.message || "Something went wrong during analysis.");
    setConnectionStatus(error.message || "Analysis failed", "error");
  } finally {
    setTyping(false);
    statementInput.focus();
  }
});

newConversationButton.addEventListener("click", () => {
  conversationId = "";
  localStorage.removeItem(KEY_CONVERSATION);

  chatLog.innerHTML = "";
  appendMessage(
    "ai",
    "Started a new conversation. Share a statement when you are ready."
  );
  updateBackgroundForSentiment("neutral", 0.5);
});

statementInput.addEventListener("input", autoResizeTextarea);
statementInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composerForm.requestSubmit();
  }
});

bindModalEvents();
initDiagrams();
updateBackgroundForSentiment("neutral", 0.5);

const settingsController = initSettingsPanel({
  getApiBase,
  setApiBase,
  setUiPreferences,
  fetchSettings,
  saveSettings,
  testBackend,
  onStatus: setConnectionStatus,
  showToast,
});

(async function boot() {
  setConnectionStatus("Connecting...", "warn");
  const connected = await discoverBackend(localStorage.getItem(KEY_API_BASE) || "");

  if (!connected) {
    showToast("Backend not detected. Open settings to set URL and test connection.", "error");
    return;
  }

  try {
    await settingsController.sync();
    setConnectionStatus("Ready", "ok");
  } catch (error) {
    setConnectionStatus("Connected, settings unavailable", "warn");
    showToast(error.message || "Could not load backend settings.", "error");
  }
})();
