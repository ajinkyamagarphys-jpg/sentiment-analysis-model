const API_BASE = "http://localhost:8000";

const form = document.querySelector("#analysis-form");
const statementInput = document.querySelector("#statement");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");
const statusEl = document.querySelector("#status");
const labelEl = document.querySelector("#result-label");
const confidenceEl = document.querySelector("#confidence");
const sourceEl = document.querySelector("#source");
const recommendationEl = document.querySelector("#recommendation");
const disclaimerEl = document.querySelector("#disclaimer");
const scoresEl = document.querySelector("#scores");

let conversationId = localStorage.getItem("conversationId");

function setStatus(message, className = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${className}`.trim();
}

function percent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function renderScores(scores) {
  scoresEl.innerHTML = "";
  if (!scores || scores.length === 0) {
    scoresEl.textContent = "No score distribution available.";
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
    scoresEl.appendChild(row);
  });
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) throw new Error("API health check failed");
    const data = await response.json();
    const modelText = data.bert_model_loaded ? "BERT ready" : "BERT not trained";
    const fallbackText = data.gemini_configured ? "Gemini ready" : "Gemini off";
    setStatus(`${modelText}, ${fallbackText}`, data.bert_model_loaded || data.gemini_configured ? "ok" : "warn");
  } catch (error) {
    setStatus("API offline", "warn");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const statement = statementInput.value.trim();
  if (!statement) return;

  submitButton.disabled = true;
  submitButton.textContent = "Analyzing...";

  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement, conversation_id: conversationId }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Analysis failed");
    }

    const result = await response.json();
    conversationId = result.conversation_id;
    localStorage.setItem("conversationId", conversationId);

    labelEl.textContent = result.label;
    confidenceEl.textContent = `Confidence: ${percent(result.confidence)}`;
    sourceEl.textContent = `Source: ${result.source}`;
    recommendationEl.textContent = result.recommendation;
    disclaimerEl.textContent = result.disclaimer;
    renderScores(result.all_scores);
  } catch (error) {
    recommendationEl.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Analyze";
  }
});

resetButton.addEventListener("click", () => {
  conversationId = null;
  localStorage.removeItem("conversationId");
  statementInput.value = "";
  labelEl.textContent = "Waiting";
  confidenceEl.textContent = "Confidence: --";
  sourceEl.textContent = "Source: --";
  recommendationEl.textContent = "Submit a statement to see the analysis.";
  scoresEl.innerHTML = "";
});

checkHealth();
