/* ==========================================================================
   SciMind — Main JavaScript
   ========================================================================== */
"use strict";

const API_BASE  = "";
let chatHistory = [];
let isLoading   = false;

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNav();
  initPanelNav();
  initToolCards();
  initChatInput();
  initDomainChips();
  initConsoleDemo();
  initScrollReveal();
  initStatCounters();
});

/* ==========================================================================
   THEME
   ========================================================================== */
function initTheme() {
  const saved = localStorage.getItem("scimind-theme") || "dark";
  applyTheme(saved);
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("scimind-theme", theme);
  const use = document.getElementById("themeIconUse");
  if (use) use.setAttribute("href", theme === "dark" ? "#icon-sun" : "#icon-moon");
}

/* ==========================================================================
   NAV — smooth scroll + active state
   ========================================================================== */
function initNav() {
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(link => {
    link.addEventListener("click", e => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

/* ==========================================================================
   TOOL CARDS (marketing grid) → jump into the app on the right panel
   ========================================================================== */
function initToolCards() {
  document.querySelectorAll(".tool-card").forEach(card => {
    card.addEventListener("click", () => {
      const panel = card.dataset.panel;
      if (panel) openTool(panel);
    });
  });
}
function openTool(panelId) {
  const btn = document.querySelector(`.feature-tab-btn[data-panel="${panelId}"]`);
  if (btn) btn.click();
  document.getElementById("app")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ==========================================================================
   PANEL NAVIGATION
   ========================================================================== */
function initPanelNav() {
  document.querySelectorAll(".feature-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchPanel(btn.dataset.panel);
      document.querySelectorAll(".feature-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}
function switchPanel(panelId) {
  document.querySelectorAll(".panel-section").forEach(p => p.classList.remove("active"));
  document.getElementById(`panel-${panelId}`)?.classList.add("active");
}

/* ==========================================================================
   DOMAIN CHIPS + GLOBAL DOMAIN SYNC
   ========================================================================== */
function initDomainChips() {
  document.querySelectorAll(".domain-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".domain-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const domain = chip.dataset.domain;
      const sel = document.getElementById("globalDomain");
      if (sel) {
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === domain) { sel.selectedIndex = i; break; }
        }
      }
      openTool("chat");
    });
  });
  document.getElementById("globalDomain")?.addEventListener("change", function () {
    document.querySelectorAll(".domain-chip").forEach(c => c.classList.toggle("active", c.dataset.domain === this.value));
  });
}
function getSelectedDomain() {
  return document.getElementById("globalDomain")?.value || "General Science";
}

/* ==========================================================================
   CHAT
   ========================================================================== */
function initChatInput() {
  const ta = document.getElementById("chatInput");
  if (!ta) return;
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  });
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
}

async function sendChat() {
  const ta  = document.getElementById("chatInput");
  const msg = ta?.value?.trim();
  if (!msg || isLoading) return;

  appendBubble("user", msg);
  chatHistory.push({ role: "user", content: msg });
  ta.value = ""; ta.style.height = "auto";

  const typingId = appendTyping();
  setLoading(true, "SciMind is thinking\u2026");

  try {
    const res = await apiFetch("/api/chat", {
      message: msg,
      history: chatHistory.slice(-8),
      domain:  getSelectedDomain(),
    });
    removeTyping(typingId);
    const reply = res.response || "No response.";
    appendBubble("ai", reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    removeTyping(typingId);
    appendBubble("ai", `Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}
function sendQuickPrompt(text) {
  const ta = document.getElementById("chatInput");
  if (ta) ta.value = text;
  sendChat();
}
function appendBubble(role, markdown) {
  const container = document.getElementById("chatMessages");
  container.querySelector(".chat-welcome")?.remove();
  const isUser = role === "user";
  const html = isUser ? escapeHtml(markdown).replace(/\n/g, "<br>") : renderMarkdown(markdown);
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const div = document.createElement("div");
  div.className = `chat-bubble ${isUser ? "user" : "ai"}`;
  div.innerHTML = `
    <div class="bubble-avatar ${isUser ? "usr-av" : "ai-av"}">${isUser ? "U" : svgIcon("cpu")}</div>
    <div class="bubble-body">
      <div class="bubble-content">${html}</div>
      <div class="bubble-meta">
        <span>${now}</span>
        ${!isUser ? `<span class="bubble-copy" title="Copy" onclick="copyText(this)">${svgIcon("copy")}</span>` : ""}
      </div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}
function appendTyping() {
  const container = document.getElementById("chatMessages");
  const id = `typing-${Date.now()}`;
  const div = document.createElement("div");
  div.id = id; div.className = "chat-bubble ai";
  div.innerHTML = `
    <div class="bubble-avatar ai-av">${svgIcon("cpu")}</div>
    <div class="bubble-body"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}
function removeTyping(id) { document.getElementById(id)?.remove(); }
function clearChat() {
  const container = document.getElementById("chatMessages");
  container.innerHTML = `
    <div class="chat-welcome">
      <div class="icon-wrap">${svgIcon("cpu")}</div>
      <h3>Start a research conversation</h3>
      <p>Powered by IBM Granite on watsonx.ai. Pick a domain above, then ask a question.</p>
      <div class="quick-prompts">
        <span class="quick-chip" onclick="sendQuickPrompt('Explain quantum entanglement and its applications in quantum computing.')">Quantum entanglement</span>
        <span class="quick-chip" onclick="sendQuickPrompt('What are the latest breakthroughs in CRISPR gene editing technology?')">CRISPR breakthroughs</span>
        <span class="quick-chip" onclick="sendQuickPrompt('Summarize the current state of climate change research and key findings.')">Climate research</span>
        <span class="quick-chip" onclick="sendQuickPrompt('What are the open problems in theoretical physics today?')">Open physics problems</span>
      </div>
    </div>`;
  chatHistory = [];
}

/* ==========================================================================
   SUMMARIZE
   ========================================================================== */
async function runSummarize() {
  const text  = document.getElementById("sumInput")?.value?.trim();
  const style = document.querySelector('input[name="sumStyle"]:checked')?.value || "detailed";
  if (!text) return showToast("Please paste paper text first.", "warning");
  setLoading(true, "Summarizing paper\u2026");
  try {
    const res = await apiFetch("/api/summarize", { text, style });
    showResult("sumResult", res.summary, `Summary style: ${style}`);
  } catch (err) { showResult("sumResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}

/* ==========================================================================
   CITATION
   ========================================================================== */
async function runCitation() {
  const info  = document.getElementById("citInput")?.value?.trim();
  const style = document.getElementById("citStyle")?.value || "APA";
  if (!info) return showToast("Please enter paper details.", "warning");
  setLoading(true, `Generating ${style} citation\u2026`);
  try {
    const res = await apiFetch("/api/citation", { info, style });
    showResult("citResult", res.citation, `${style} citation`);
  } catch (err) { showResult("citResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}

/* ==========================================================================
   LITERATURE REVIEW
   ========================================================================== */
async function runLitReview() {
  const topic  = document.getElementById("litTopic")?.value?.trim();
  const papers = document.getElementById("litPapers")?.value?.trim();
  const scope  = document.getElementById("litScope")?.value || "comprehensive";
  if (!topic) return showToast("Please enter a research topic.", "warning");
  setLoading(true, "Building literature review\u2026");
  try {
    const res = await apiFetch("/api/literature-review", { topic, papers, scope });
    showResult("litResult", res.review, `Literature review: ${topic}`);
  } catch (err) { showResult("litResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}

/* ==========================================================================
   HYPOTHESIS
   ========================================================================== */
async function runHypothesis() {
  const topic   = document.getElementById("hypTopic")?.value?.trim();
  const context = document.getElementById("hypContext")?.value?.trim();
  const count   = parseInt(document.getElementById("hypCount")?.value || "3");
  if (!topic) return showToast("Please enter a research topic.", "warning");
  setLoading(true, "Generating hypotheses\u2026");
  try {
    const res = await apiFetch("/api/hypothesis", { topic, context, count });
    showResult("hypResult", res.hypotheses, `${count} hypotheses for: ${topic}`);
  } catch (err) { showResult("hypResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}

/* ==========================================================================
   DRAFT REPORT
   ========================================================================== */
async function runDraftReport() {
  const topic   = document.getElementById("repTopic")?.value?.trim();
  const section = document.getElementById("repSection")?.value || "full";
  const context = document.getElementById("repContext")?.value?.trim();
  if (!topic) return showToast("Please enter a research topic/title.", "warning");
  setLoading(true, "Drafting report section\u2026");
  try {
    const res = await apiFetch("/api/draft-report", { topic, section, context });
    showResult("repResult", res.draft, `Draft \u2014 ${section}: ${topic}`);
  } catch (err) { showResult("repResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}

/* ==========================================================================
   TOPIC EXPLORER
   ========================================================================== */
async function runExplore() {
  const topic  = document.getElementById("expTopic")?.value?.trim();
  const domain = document.getElementById("expDomain")?.value?.trim();
  if (!topic) return showToast("Please enter a scientific topic.", "warning");
  setLoading(true, `Exploring: ${topic}\u2026`);
  try {
    const res = await apiFetch("/api/explore-topic", { topic, domain });
    showResult("expResult", res.exploration, `Topic exploration: ${topic}`);
  } catch (err) { showResult("expResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}
function setTopic(prefix, topic) {
  const el = document.getElementById(`${prefix}Topic`);
  if (el) el.value = topic;
}

/* ==========================================================================
   EXPLAIN CONCEPT
   ========================================================================== */
async function runExplain() {
  const concept = document.getElementById("explConcept")?.value?.trim();
  const level   = document.getElementById("explLevel")?.value || "intermediate";
  if (!concept) return showToast("Please enter a concept to explain.", "warning");
  setLoading(true, `Explaining: ${concept}\u2026`);
  try {
    const res = await apiFetch("/api/explain", { concept, level });
    showResult("explResult", res.explanation, `${concept} \u2014 ${level} level`);
  } catch (err) { showResult("explResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}

/* ==========================================================================
   COMPARE THEORIES
   ========================================================================== */
async function runCompare() {
  const theory1 = document.getElementById("cmpTheory1")?.value?.trim();
  const theory2 = document.getElementById("cmpTheory2")?.value?.trim();
  const domain  = document.getElementById("cmpDomain")?.value?.trim();
  if (!theory1 || !theory2) return showToast("Please enter both theories.", "warning");
  setLoading(true, "Comparing theories\u2026");
  try {
    const res = await apiFetch("/api/compare-theories", { theory1, theory2, domain });
    showResult("cmpResult", res.comparison, `${theory1} vs ${theory2}`);
  } catch (err) { showResult("cmpResult", `Error: ${err.message}`, "Error"); }
  finally { setLoading(false); }
}

/* ==========================================================================
   SIGNATURE MOMENT — live watsonx console in the hero
   Loops through a few domains so the console stays alive if you linger.
   ========================================================================== */
const CONSOLE_EXCHANGES = [
  {
    question: "Explain the significance of the Higgs boson discovery.",
    answer:
`**\u269b\ufe0f [Physics]**

The Higgs boson confirms the mechanism by which elementary
particles acquire **mass** via the Higgs field.

**Key Takeaways**
- Predicted in 1964, confirmed at CERN's LHC in 2012
- Completes the Standard Model of particle physics
- Opens paths to physics beyond the Standard Model

---
*Domain: Physics*`,
  },
  {
    question: "How does CRISPR-Cas9 edit a genome?",
    answer:
`**\ud83e\uddec [Biology]**

CRISPR-Cas9 uses a guide RNA to direct the **Cas9 enzyme**
to a specific DNA sequence, where it cuts both strands.

**Key Takeaways**
- Cell repair machinery then edits the cut site
- Enables precise gene knockout or correction
- Widely used in research, agriculture, and gene therapy

---
*Domain: Biology*`,
  },
  {
    question: "Compare transformer and recurrent neural network architectures.",
    answer:
`**\ud83d\udcbb [Computer Science]**

Transformers process sequences in **parallel** using self-attention;
RNNs process tokens **sequentially**, carrying a hidden state.

**Key Takeaways**
- Transformers scale better on long sequences and modern hardware
- RNNs are lighter but struggle with long-range dependencies
- Most large language models today are transformer-based

---
*Domain: Computer Science*`,
  },
];

function initConsoleDemo() {
  const out = document.getElementById("consoleOut");
  const inputLine = document.getElementById("consoleInputText");
  if (!out || !inputLine) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let idx = 0;

  function runExchange() {
    const { question, answer } = CONSOLE_EXCHANGES[idx % CONSOLE_EXCHANGES.length];
    idx++;

    out.classList.remove("visible");
    out.innerHTML = "";
    inputLine.textContent = "";

    if (reduceMotion) {
      inputLine.textContent = question;
      out.innerHTML = renderMarkdown(answer);
      out.classList.add("visible");
      setTimeout(runExchange, 6000);
      return;
    }

    let i = 0;
    (function typeQuestion() {
      if (i <= question.length) {
        inputLine.textContent = question.slice(0, i);
        i++;
        setTimeout(typeQuestion, 26);
      } else {
        setTimeout(() => {
          out.innerHTML = renderMarkdown(answer);
          out.classList.add("visible");
          setTimeout(runExchange, 5500);
        }, 450);
      }
    })();
  }

  setTimeout(runExchange, 900);
}

/* ==========================================================================
   SCROLL REVEAL
   ========================================================================== */
function initScrollReveal() {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach(t => t.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

  targets.forEach(t => io.observe(t));
}

/* ==========================================================================
   ANIMATED STAT COUNTERS
   ========================================================================== */
function initStatCounters() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    counters.forEach(el => { el.textContent = el.dataset.count; });
    return;
  }

  const animate = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    }
    requestAnimationFrame(tick);
  };

  if (!("IntersectionObserver" in window)) {
    counters.forEach(animate);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => io.observe(el));
}

/* ==========================================================================
   SHARED UTILITIES
   ========================================================================== */
async function apiFetch(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
function renderMarkdown(text) {
  if (typeof marked === "undefined") return escapeHtml(text).replace(/\n/g, "<br>");
  return marked.parse(text, { breaks: true, gfm: true });
}
function showResult(containerId, markdown, title) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const html = renderMarkdown(markdown);
  el.className = "result-area mt-3";
  el.innerHTML = `
    <div class="result-actions">
      <button class="copy-btn" onclick="copyResultText('${containerId}')">${svgIcon("copy")} Copy</button>
      <button class="copy-btn" onclick="exportResultPdf('${containerId}', '${escapeHtml(title || "Result").replace(/'/g, "\\'")}')">${svgIcon("doc")} PDF</button>
    </div>
    ${title ? `<div style="font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;">${escapeHtml(title)}</div>` : ""}
    <div class="result-content" id="${containerId}-content">${html}</div>`;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function setLoading(show, message) {
  isLoading = show;
  const overlay = document.getElementById("loadingOverlay");
  const msg = document.getElementById("loadingMsg");
  if (!overlay) return;
  if (show) { if (msg) msg.textContent = message || "Processing\u2026"; overlay.classList.remove("d-none"); }
  else { overlay.classList.add("d-none"); }
}
function copyResultText(containerId) {
  const el = document.getElementById(`${containerId}-content`);
  if (el) copyToClipboard(el.innerText);
}
function exportResultPdf(containerId, title) {
  const el = document.getElementById(`${containerId}-content`);
  if (!el) return;
  const win = window.open("", "_blank");
  if (!win) { showToast("Please allow pop-ups to export a PDF.", "warning"); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:'IBM Plex Sans',Georgia,serif;max-width:760px;margin:48px auto;padding:0 24px;color:#161616;line-height:1.7}
      h1{font-size:22px;margin-bottom:4px}
      .meta{font-family:monospace;font-size:11px;color:#6f6f6f;margin-bottom:28px;text-transform:uppercase;letter-spacing:.04em}
      h2,h3{margin:20px 0 8px}
      p{margin-bottom:10px}
      ul,ol{margin:0 0 10px 22px}
      hr{border:none;border-top:1px solid #dcdcdc;margin:18px 0}
      code{background:#f4f4f4;padding:1px 5px;font-size:13px}
      strong{font-weight:600}
      @media print{body{margin:20px auto}}
    </style></head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Generated by SciMind &middot; IBM Granite on watsonx.ai</div>
      ${el.innerHTML}
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
function copyText(iconEl) {
  const content = iconEl.closest(".bubble-body")?.querySelector(".bubble-content");
  if (content) copyToClipboard(content.innerText);
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast("Copied to clipboard.", "success"))
    .catch(() => showToast("Copy failed \u2014 please copy manually.", "danger"));
}
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { info: "info", warning: "alert", danger: "alert", success: "check" };
  const div = document.createElement("div");
  div.className = "toast";
  div.dataset.type = type;
  div.innerHTML = `${svgIcon(icons[type] || "info")}<span>${escapeHtml(message)}</span><span class="toast-close">${svgIcon("close")}</span>`;
  div.querySelector(".toast-close").addEventListener("click", () => div.remove());
  container.appendChild(div);
  setTimeout(() => div.remove(), 4500);
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function svgIcon(name) {
  return `<svg class="icon" style="width:14px;height:14px"><use href="#icon-${name}"></use></svg>`;
}