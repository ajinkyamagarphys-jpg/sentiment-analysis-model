const THEMES = {
  positive: [
    "linear-gradient(135deg, #dff5ea 0%, #f4f8d8 50%, #d6ebff 100%)",
    "linear-gradient(135deg, #d9f3e5 0%, #e6f5ce 45%, #d4e9ff 100%)",
  ],
  neutral: [
    "linear-gradient(135deg, #f5f7fb 0%, #eceff4 100%)",
    "linear-gradient(135deg, #f8f9fb 0%, #ebeff5 100%)",
  ],
  negative: [
    "linear-gradient(135deg, #d8e4f1 0%, #ddd8ef 45%, #d9dde6 100%)",
    "linear-gradient(135deg, #d5e0ec 0%, #d5d1e7 45%, #d6d9e2 100%)",
  ],
  crisis: [
    "linear-gradient(135deg, #f8dddd 0%, #f3d7da 45%, #f0e0e2 100%)",
    "linear-gradient(135deg, #f7d8d7 0%, #f1d1d6 45%, #ecdde2 100%)",
  ],
};

let cycle = 0;

export function normalizeSentiment(label = "neutral") {
  const value = String(label).toLowerCase();
  if (value.includes("crisis") || value.includes("alert")) return "crisis";
  if (value.includes("ang") || value.includes("depress") || value.includes("suicid")) return "crisis";
  if (value.includes("pos") || value.includes("happy")) return "positive";
  if (value.includes("neg") || value.includes("sad")) return "negative";
  return "neutral";
}

export function updateBackgroundForSentiment(sentiment, confidence = 0.5) {
  const tone = normalizeSentiment(sentiment);
  const gradients = THEMES[tone] || THEMES.neutral;
  const selected = gradients[cycle % gradients.length];
  cycle += confidence >= 0.7 ? 2 : 1;

  const backdrop = document.querySelector(".app-backdrop");
  if (backdrop) {
    const layer = document.createElement("div");
    layer.className = "backdrop-layer";
    layer.style.background = selected;
    backdrop.appendChild(layer);

    // Trigger reflow and fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        layer.style.opacity = "1";
      });
    });

    setTimeout(() => {
      const layers = backdrop.querySelectorAll(".backdrop-layer");
      if (layers.length > 1) {
        for (let i = 0; i < layers.length - 1; i++) {
          layers[i].remove();
        }
      }
    }, 1600);
  } else {
    document.documentElement.style.setProperty("--dynamic-gradient", selected);
  }

  document.body.setAttribute("data-tone", tone);
}

export function sentimentIconPath(sentiment) {
  const tone = normalizeSentiment(sentiment);
  if (tone === "crisis") return "./assets/icons/negative.svg";
  if (tone === "positive") return "./assets/icons/positive.svg";
  if (tone === "negative") return "./assets/icons/negative.svg";
  return "./assets/icons/neutral.svg";
}
