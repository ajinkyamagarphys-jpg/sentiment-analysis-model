const DEFAULTS = {
  enable_bert: true,
  enable_gemini: true,
  bert_confidence_threshold: 0.58,
  context_window_messages: 8,
  gemini_model: "gemini-2.5-flash",
  gemini_api_key_set: false,
  ui_show_detailed_gemini: true,
};

const DRAFT_KEY = "mindtone.settingsDraft";

export function initSettingsPanel(api) {
  const modal = document.querySelector("#settings-modal");
  const openButton = document.querySelector("#open-settings");
  const closeButtons = modal.querySelectorAll("[data-close='settings']");
  const form = document.querySelector("#settings-form");
  const bertToggle = document.querySelector("#enable-bert");
  const geminiToggle = document.querySelector("#enable-gemini");
  const threshold = document.querySelector("#bert-threshold");
  const thresholdValue = document.querySelector("#threshold-value");
  const contextWindow = document.querySelector("#context-window");
  const geminiKey = document.querySelector("#gemini-api-key");
  const geminiApiNote = document.querySelector("#gemini-api-note");
  const geminiModel = document.querySelector("#gemini-model");
  const backendUrl = document.querySelector("#backend-url");
  const backendValidity = document.querySelector("#backend-validity");
  const testConnectionBtn = document.querySelector("#test-connection");
  const resetBtn = document.querySelector("#reset-settings");
  const showDetailedGemini = document.querySelector("#show-detailed-gemini");

  let lastLoaded = { ...DEFAULTS };

  function normalizeUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function isValidUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function updateValidityState(value) {
    backendValidity.classList.remove("valid", "invalid");
    if (!value) return;
    backendValidity.classList.add(isValidUrl(value) ? "valid" : "invalid");
  }

  function openModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    backendUrl.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    openButton.focus();
  }

  function readDraft() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(readForm()));
  }

  function readForm() {
    const thresholdValueFloat = Number.parseFloat(threshold.value || "0.58");
    const contextInt = Number.parseInt(contextWindow.value || "8", 10);

    const payload = {
      enable_bert: bertToggle.checked,
      enable_gemini: geminiToggle.checked,
      bert_confidence_threshold: Number.isFinite(thresholdValueFloat)
        ? Math.min(1, Math.max(0, thresholdValueFloat))
        : 0.58,
      context_window_messages: Number.isInteger(contextInt)
        ? Math.min(50, Math.max(1, contextInt))
        : 8,
      gemini_model: geminiModel.value.trim() || "gemini-2.5-flash",
      backend_url: normalizeUrl(backendUrl.value),
      ui_show_detailed_gemini: showDetailedGemini.checked,
    };

    if (geminiKey.value.trim()) {
      payload.gemini_api_key = geminiKey.value.trim();
    }
    return payload;
  }

  function applyForm(settings = DEFAULTS) {
    const merged = { ...DEFAULTS, ...settings };
    bertToggle.checked = Boolean(merged.enable_bert);
    geminiToggle.checked = Boolean(merged.enable_gemini);
    threshold.value = Number(merged.bert_confidence_threshold).toFixed(2);
    thresholdValue.textContent = Number(merged.bert_confidence_threshold).toFixed(2);
    contextWindow.value = String(merged.context_window_messages);
    geminiModel.value = merged.gemini_model || DEFAULTS.gemini_model;
    geminiKey.value = "";
    showDetailedGemini.checked = Boolean(merged.ui_show_detailed_gemini);
    backendUrl.value = normalizeUrl(merged.backend_url || api.getApiBase());
    geminiApiNote.textContent = merged.gemini_api_key_set
      ? "API key already saved on backend. Enter a new key only to rotate it."
      : "No key set yet. Add one to enable Gemini calls.";
    updateValidityState(backendUrl.value);
  }

  async function refreshFromBackend() {
    const settings = await api.fetchSettings();
    const payload = {
      ...settings,
      backend_url: api.getApiBase(),
      ui_show_detailed_gemini: lastLoaded.ui_show_detailed_gemini,
    };
    lastLoaded = payload;
    applyForm(payload);
    saveDraft();
  }

  openButton.addEventListener("click", openModal);
  closeButtons.forEach((btn) => btn.addEventListener("click", closeModal));

  threshold.addEventListener("input", () => {
    thresholdValue.textContent = Number(threshold.value).toFixed(2);
    saveDraft();
  });

  [bertToggle, geminiToggle, contextWindow, geminiModel, geminiKey, showDetailedGemini].forEach((el) => {
    el.addEventListener("change", saveDraft);
    el.addEventListener("input", saveDraft);
  });

  showDetailedGemini.addEventListener("change", () => {
    api.setUiPreferences({ showDetailedGemini: showDetailedGemini.checked });
  });

  backendUrl.addEventListener("input", () => {
    updateValidityState(backendUrl.value.trim());
    saveDraft();
  });

  testConnectionBtn.addEventListener("click", async () => {
    const value = normalizeUrl(backendUrl.value);
    updateValidityState(value);
    if (!isValidUrl(value)) {
      api.showToast("Enter a valid backend URL.", "error");
      return;
    }

    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = "Testing...";
    try {
      const healthy = await api.testBackend(value);
      if (!healthy) {
        api.showToast("Could not connect to backend.", "error");
        return;
      }
      api.setApiBase(value);
      await refreshFromBackend();
      api.showToast("Backend connection successful.", "success");
    } catch (error) {
      api.onStatus(error.message || "Connection test failed.", "error");
      api.showToast(error.message || "Connection test failed.", "error");
    } finally {
      testConnectionBtn.disabled = false;
      testConnectionBtn.textContent = "Test connection";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = readForm();

    if (!isValidUrl(payload.backend_url)) {
      updateValidityState(payload.backend_url);
      api.showToast("Please provide a valid backend URL.", "error");
      return;
    }

    api.setApiBase(payload.backend_url);

    const requestPayload = {
      enable_bert: payload.enable_bert,
      enable_gemini: payload.enable_gemini,
      bert_confidence_threshold: payload.bert_confidence_threshold,
      context_window_messages: payload.context_window_messages,
      gemini_model: payload.gemini_model,
    };
    if (payload.gemini_api_key) {
      requestPayload.gemini_api_key = payload.gemini_api_key;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    try {
      const saved = await api.saveSettings(requestPayload);
      lastLoaded = { ...saved, backend_url: api.getApiBase() };
      lastLoaded.ui_show_detailed_gemini = payload.ui_show_detailed_gemini;
      applyForm(lastLoaded);
      saveDraft();
      api.setUiPreferences({ showDetailedGemini: payload.ui_show_detailed_gemini });
      api.showToast("Settings saved.", "success");
    } catch (error) {
      api.showToast(error.message || "Failed to save settings.", "error");
      api.onStatus(error.message || "Failed to save settings.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save";
    }
  });

  resetBtn.addEventListener("click", () => {
    applyForm(lastLoaded);
    saveDraft();
    api.showToast("Settings reset to last loaded values.", "success");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  const draft = readDraft();
  const uiPrefs = typeof api.getUiPreferences === "function" ? api.getUiPreferences() : null;
  const bootPayload = draft
    ? { ...DEFAULTS, ...draft }
    : {
      ...DEFAULTS,
      backend_url: api.getApiBase(),
      ui_show_detailed_gemini: uiPrefs?.showDetailedGemini ?? DEFAULTS.ui_show_detailed_gemini,
    };
  lastLoaded = bootPayload;
  applyForm(bootPayload);
  api.setUiPreferences({ showDetailedGemini: bootPayload.ui_show_detailed_gemini });

  return {
    modal,
    closeModal,
    async sync() {
      await refreshFromBackend();
    },
  };
}
