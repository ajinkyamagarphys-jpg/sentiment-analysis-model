const form = document.querySelector("#analysis-form");
const settingsForm = document.querySelector("#settings-form");
const statementInput = document.querySelector("#statement");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");
const saveSettingsButton = document.querySelector("#save-settings-button");
const refreshSettingsButton = document.querySelector("#refresh-settings-button");
const reconnectButton = document.querySelector("#reconnect-button");
const statusEl = document.querySelector("#status");
const settingsStatusEl = document.querySelector("#settings-status");
const apiBaseEl = document.querySelector("#api-base");
const backendBaseInput = document.querySelector("#backend-base");
const enableBertInput = document.querySelector("#enable-bert");
const enableGeminiInput = document.querySelector("#enable-gemini");
const bertThresholdInput = document.querySelector("#bert-threshold");
const contextWindowInput = document.querySelector("#context-window");
const geminiModelInput = document.querySelector("#gemini-model");
const geminiApiKeyInput = document.querySelector("#gemini-api-key");
const geminiKeyStatusEl = document.querySelector("#gemini-key-status");
const mentalLabelEl = document.querySelector("#mental-label");
const mentalConfidenceEl = document.querySelector("#mental-confidence");
const mentalSourceEl = document.querySelector("#mental-source");
const bertLabelEl = document.querySelector("#bert-label");
const bertConfidenceEl = document.querySelector("#bert-confidence");
const bertSourceEl = document.querySelector("#bert-source");
const recommendationEl = document.querySelector("#recommendation");
const disclaimerEl = document.querySelector("#disclaimer");
const mentalScoresEl = document.querySelector("#mental-scores");
const bertScoresEl = document.querySelector("#bert-scores");

let conversationId = localStorage.getItem("conversationId");
let apiBase = "";
let reconnectTimer = null;

function setStatus(message, className = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${className}`.trim();
}

function setSettingsStatus(message) {
  settingsStatusEl.textContent = message;
}

function setApiBaseLabel(message) {
  apiBaseEl.textContent = message;
}

function normalizeApiBase(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
}

function backendCandidates(preferred = "") {
  const fromStorage = normalizeApiBase(localStorage.getItem("apiBase"));
  const fromInput = normalizeApiBase(preferred);
  const fromHost = window.location.hostname ? `http://${window.location.hostname}:8000` : "";
  return [...new Set([fromInput, fromStorage, fromHost, "http://127.0.0.1:8000", "http://localhost:8000"].map(normalizeApiBase).filter(Boolean))];
}

function setAppAvailability(available) {
  submitButton.disabled = !available;
  saveSettingsButton.disabled = !available;
  refreshSettingsButton.disabled = !available;
}

function isConnectivityError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("timed out") || text.includes("failed to fetch") || text.includes("networkerror") || text.includes("backend offline");
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = window.setInterval(async () => {
    if (apiBase) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      return;
    }
    const connected = await discoverBackend(backendBaseInput.value);
    if (connected) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      await loadSettings();
    }
  }, 4000);
}

function onConnected(base, healthData) {
  apiBase = normalizeApiBase(base);
  localStorage.setItem("apiBase", apiBase);
  backendBaseInput.value = apiBase;
  setApiBaseLabel(`Connected: ${apiBase}`);
  const bertText = healthData.enable_bert
    ? (healthData.bert_model_loaded ? "BERT ready" : "BERT enabled, model not loaded")
    : "BERT disabled";
  const geminiText = healthData.enable_gemini
    ? (healthData.gemini_configured ? "Gemini ready" : "Gemini enabled, key missing")
    : "Gemini disabled";
  const warn = (healthData.enable_bert && !healthData.bert_model_loaded) || (healthData.enable_gemini && !healthData.gemini_configured);
  setStatus(`${bertText}, ${geminiText}`, warn ? "warn" : "ok");
  setAppAvailability(true);
}

function onOffline(message) {
  apiBase = "";
  setApiBaseLabel("Backend offline. Auto-retrying...");
  setStatus(message || "Backend offline", "warn");
  setSettingsStatus("Waiting for backend...");
  setAppAvailability(false);
  scheduleReconnect();
}

async function fetchJson(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const errorText = body?.detail || body?.message || text || `Request failed (${response.status})`;
      throw new Error(errorText);
    }
    return body || {};
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Check backend connection.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function probeBackend(base) {
  const normalized = normalizeApiBase(base);
  if (!normalized) return null;
  try {
    const data = await fetchJson(`${normalized}/health`, {}, 3500);
    return { base: normalized, data };
  } catch {
    return null;
  }
}

async function discoverBackend(preferred = "") {
  const candidates = backendCandidates(preferred);
  for (const candidate of candidates) {
    const match = await probeBackend(candidate);
    if (match) {
      onConnected(match.base, match.data);
      return true;
    }
  }
  onOffline("Could not reach backend. Start backend and keep this tab open.");
  return false;
}

async function ensureBackend() {
  if (apiBase) return true;
  return discoverBackend(backendBaseInput.value);
}

function percent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function renderScores(target, scores) {
  target.innerHTML = "";
  if (!scores || scores.length === 0) {
    target.textContent = "No score distribution available.";
    return;
  }

  scores.forEach((item) => {
    const row = document.createElement("div");
    row.className = "score-row";

    const label = document.createElement("span");
    label.textContent = item.label;

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("span");
    fill.style.width = percent(item.score);
    bar.appendChild(fill);

    const value = document.createElement("strong");
    value.textContent = percent(item.score);

    row.append(label, bar, value);
    target.appendChild(row);
  });
}

function applySettings(settings) {
  enableBertInput.checked = Boolean(settings.enable_bert);
  enableGeminiInput.checked = Boolean(settings.enable_gemini);
  bertThresholdInput.value = Number(settings.bert_confidence_threshold ?? 0.58).toFixed(2);
  contextWindowInput.value = String(settings.context_window_messages ?? 8);
  geminiModelInput.value = settings.gemini_model || "gemini-2.5-flash";
  geminiApiKeyInput.value = "";
  geminiKeyStatusEl.textContent = settings.gemini_api_key_set ? "Gemini API key is set." : "Gemini API key not set.";
}

function settingsPayload() {
  const parsedThreshold = Number.parseFloat(bertThresholdInput.value || "0.58");
  const parsedContext = Number.parseInt(contextWindowInput.value || "8", 10);
  const payload = {
    enable_bert: enableBertInput.checked,
    enable_gemini: enableGeminiInput.checked,
    bert_confidence_threshold: Number.isFinite(parsedThreshold) ? parsedThreshold : 0.58,
    context_window_messages: Number.isInteger(parsedContext) ? parsedContext : 8,
    gemini_model: geminiModelInput.value.trim() || "gemini-2.5-flash",
  };
  const key = geminiApiKeyInput.value.trim();
  if (key) {
    payload.gemini_api_key = key;
  }
  return payload;
}

async function loadSettings() {
  if (!apiBase) return;
  setSettingsStatus("Loading settings...");
  try {
    const settings = await fetchJson(`${apiBase}/settings`);
    applySettings(settings);
    setSettingsStatus("Settings loaded");
  } catch (error) {
    setSettingsStatus("Could not load settings");
    if (isConnectivityError(error.message)) {
      onOffline(error.message);
    }
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const statement = statementInput.value.trim();
  if (!statement) return;
  if (!(await ensureBackend())) {
    recommendationEl.textContent = "Backend is offline. Start backend, then retry.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Analyzing...";

  try {
    const result = await fetchJson(`${apiBase}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement, conversation_id: conversationId }),
    });
    conversationId = result.conversation_id;
    localStorage.setItem("conversationId", conversationId);

    const mental = result.mental_health || result;
    const bert = result.general_sentiment || {
      label: "unknown",
      confidence: 0,
      source: "unavailable",
      all_scores: [],
    };

    mentalLabelEl.textContent = mental.label;
    mentalConfidenceEl.textContent = `Confidence: ${percent(mental.confidence)}`;
    mentalSourceEl.textContent = `Source: ${mental.source}`;

    bertLabelEl.textContent = bert.label;
    bertConfidenceEl.textContent = `Confidence: ${percent(bert.confidence)}`;
    bertSourceEl.textContent = `Source: ${bert.source}`;

    recommendationEl.textContent = result.recommendation;
    disclaimerEl.textContent = result.disclaimer;
    renderScores(mentalScoresEl, mental.all_scores);
    renderScores(bertScoresEl, bert.all_scores);
    
    if (result.model_status) {
      const isWarn = result.model_status.toLowerCase().includes("error") || 
                     result.model_status.toLowerCase().includes("failed") || 
                     result.model_status.toLowerCase().includes("exceeded");
      setStatus(isWarn ? result.model_status : "Analysis complete", isWarn ? "warn" : "ok");
    }
  } catch (error) {
    recommendationEl.textContent = error.message;
    if (isConnectivityError(error.message)) {
      onOffline(error.message);
    } else {
      setStatus(error.message, "warn");
    }
  } finally {
    submitButton.disabled = !apiBase;
    submitButton.textContent = "Analyze";
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await ensureBackend())) return;
  saveSettingsButton.disabled = true;
  saveSettingsButton.textContent = "Saving...";
  setSettingsStatus("Saving settings...");
  try {
    const updated = await fetchJson(`${apiBase}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settingsPayload()),
    });
    applySettings(updated);
    setSettingsStatus("Settings saved");
    await discoverBackend(apiBase);
  } catch (error) {
    setSettingsStatus(error.message);
    if (isConnectivityError(error.message)) {
      onOffline(error.message);
    } else {
      setStatus(error.message, "warn");
    }
  } finally {
    saveSettingsButton.disabled = false;
    saveSettingsButton.textContent = "Save backend settings";
  }
});

refreshSettingsButton.addEventListener("click", async () => {
  if (!(await ensureBackend())) return;
  await loadSettings();
});

reconnectButton.addEventListener("click", async () => {
  setSettingsStatus("Reconnecting...");
  const connected = await discoverBackend(backendBaseInput.value);
  if (connected) {
    await loadSettings();
    return;
  }
  setSettingsStatus("Could not connect");
});

resetButton.addEventListener("click", () => {
  conversationId = null;
  localStorage.removeItem("conversationId");
  statementInput.value = "";
  mentalLabelEl.textContent = "Waiting";
  mentalConfidenceEl.textContent = "Confidence: --";
  mentalSourceEl.textContent = "Source: --";
  bertLabelEl.textContent = "Waiting";
  bertConfidenceEl.textContent = "Confidence: --";
  bertSourceEl.textContent = "Source: --";
  recommendationEl.textContent = "Submit a statement to see the analysis.";
  mentalScoresEl.innerHTML = "";
  bertScoresEl.innerHTML = "";
});

window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  onOffline("Unexpected browser error. Retrying backend detection.");
});

(async function boot() {
  setAppAvailability(false);
  backendBaseInput.value = normalizeApiBase(localStorage.getItem("apiBase"));
  const connected = await discoverBackend(backendBaseInput.value);
  if (connected) {
    await loadSettings();
  }
})();
