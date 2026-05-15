function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildArcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function renderBertPie(target) {
  const data = [
    { label: "Positive", value: 36, color: "#5aa87d" },
    { label: "Neutral", value: 34, color: "#8b97a8" },
    { label: "Negative", value: 30, color: "#6b78c5" },
  ];

  const svg = svgEl("svg", { viewBox: "0 0 280 180", role: "img", "aria-label": "BERT training data distribution" });
  let angle = 0;
  data.forEach((slice) => {
    const next = angle + (slice.value / 100) * 360;
    const path = svgEl("path", {
      d: buildArcPath(80, 90, 60, angle, next),
      fill: slice.color,
      opacity: 0.92,
    });
    svg.appendChild(path);
    angle = next;
  });

  const center = svgEl("circle", { cx: 80, cy: 90, r: 30, fill: "#f8fbff" });
  const text = svgEl("text", {
    x: 80,
    y: 95,
    "text-anchor": "middle",
    fill: "#334155",
    "font-size": "12",
    "font-family": "Inter, sans-serif",
  });
  text.textContent = "BERT";
  svg.append(center, text);

  data.forEach((slice, idx) => {
    const row = svgEl("g", { transform: `translate(152 ${45 + idx * 32})` });
    row.appendChild(svgEl("rect", { x: 0, y: -9, width: 12, height: 12, rx: 3, fill: slice.color }));

    const label = svgEl("text", {
      x: 18,
      y: 1,
      fill: "#334155",
      "font-size": "11",
      "font-family": "Inter, sans-serif",
    });
    label.textContent = `${slice.label} ${slice.value}%`;
    row.appendChild(label);
    svg.appendChild(row);
  });

  target.innerHTML = "";
  target.appendChild(svg);
}

function renderGauge(target) {
  const value = 78;
  const circumference = 2 * Math.PI * 46;
  const stroke = (value / 100) * circumference;

  const svg = svgEl("svg", { viewBox: "0 0 200 140", role: "img", "aria-label": "Confidence gauge example", style: "display: block; margin: 0 auto;" });

  const bgArc = svgEl("path", {
    d: "M 40 110 A 60 60 0 0 1 160 110",
    fill: "none",
    stroke: "#d9e2ef",
    "stroke-width": "12",
    "stroke-linecap": "round",
  });

  const fgArc = svgEl("path", {
    d: "M 40 110 A 60 60 0 0 1 160 110",
    fill: "none",
    stroke: "url(#confidenceGradient)",
    "stroke-width": "12",
    "stroke-linecap": "round",
    "stroke-dasharray": `${stroke} ${circumference}`,
    transform: "rotate(180 100 110)",
  });

  const defs = svgEl("defs");
  const gradient = svgEl("linearGradient", { id: "confidenceGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%" });
  gradient.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#8db0d7" }));
  gradient.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#4f7aa7" }));
  defs.appendChild(gradient);

  const pct = svgEl("text", {
    x: 100,
    y: 92,
    "text-anchor": "middle",
    fill: "#334155",
    "font-size": "24",
    "font-weight": "700",
    "font-family": "Plus Jakarta Sans, Inter, sans-serif",
  });
  pct.textContent = `${value}%`;

  const label = svgEl("text", {
    x: 100,
    y: 116,
    "text-anchor": "middle",
    fill: "#64748b",
    "font-size": "12",
    "font-family": "Inter, sans-serif",
  });
  label.textContent = "Sample confidence";

  svg.append(defs, bgArc, fgArc, pct, label);
  target.innerHTML = "";
  target.appendChild(svg);
}

function initRevealObserver() {
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = `${Math.random() * 120}ms`;
          entry.target.classList.add("fade-in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  reveals.forEach((node) => observer.observe(node));
}

export function initDiagrams() {
  const pieTarget = document.querySelector("#bert-pie-chart");
  const gaugeTarget = document.querySelector("#confidence-gauge");
  if (pieTarget) renderBertPie(pieTarget);
  if (gaugeTarget) renderGauge(gaugeTarget);
  initRevealObserver();
}
