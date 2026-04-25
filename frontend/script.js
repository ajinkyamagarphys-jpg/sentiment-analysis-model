const API_BASE = "http://localhost:8000";

const form = document.querySelector("#analysis-form");
const statementInput = document.querySelector("#statement");
const submitButton = document.querySelector("#submit-button");
const resetButton = document.querySelector("#reset-button");
const statusEl = document.querySelector("#status");
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

function setStatus(message, className = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${className}`.trim();
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

checkHealth();
