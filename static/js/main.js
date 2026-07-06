/* ╔══════════════════════════════════════════════════════════════════════╗
   ║  SciMind — Main JavaScript                                           ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

"use strict";

// ─── Globals ──────────────────────────────────────────────────────────────────
const API_BASE   = "";           // same origin
let chatHistory  = [];           // [{role,content}, …]
let isLoading    = false;

// ─── DOM ready ────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initPanelNav();
  initChatInput();
  initDomainChips();
});

// ══════════════════════════════════════════════════════════════════════════════
//  THEME TOGGLE
// ══════════════════════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem("scimind-theme") || "dark";
  applyTheme(saved);

  document.getElementById("themeToggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-bs-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  localStorage.setItem("scimind-theme", theme);
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PANEL NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
function initPanelNav() {
  document.querySelectorAll(".feature-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.panel;
      switchPanel(panel);
      // Active state
      document.querySelectorAll(".feature-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function switchPanel(panelId) {
  document.querySelectorAll(".panel-section").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(`panel-${panelId}`);
  if (target) target.classList.add("active");
  // Scroll to top on mobile
  if (window.innerWidth < 992) window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════════════════════════════════
//  DOMAIN CHIPS + GLOBAL DOMAIN SYNC
// ══════════════════════════════════════════════════════════════════════════════
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
    });
  });

  document.getElementById("globalDomain")?.addEventListener("change", function () {
    const domain = this.value;
    document.querySelectorAll(".domain-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.domain === domain);
    });
  });
}

function getSelectedDomain() {
  return document.getElementById("globalDomain")?.value || "General Science";
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════════════════════
function initChatInput() {
  const ta = document.getElementById("chatInput");
  if (!ta) return;

  // Auto-expand textarea
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  });

  // Enter to send (Shift+Enter = newline)
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
}

async function sendChat() {
  const ta  = document.getElementById("chatInput");
  const msg = ta?.value?.trim();
  if (!msg || isLoading) return;

  appendBubble("user", msg);
  chatHistory.push({ role: "user", content: msg });
  ta.value = "";
  ta.style.height = "auto";

  const typingId = appendTyping();
  setLoading(true, "SciMind is thinking…");

  try {
    const res = await apiFetch("/api/chat", {
      message: msg,
      history: chatHistory.slice(-8),   // last 8 turns for context
      domain:  getSelectedDomain(),
    });
    removeTyping(typingId);
    const reply = res.response || "No response.";
    appendBubble("ai", reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    removeTyping(typingId);
    appendBubble("ai", `⚠️ Error: ${err.message}`);
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
  // Remove welcome screen on first message
  container.querySelector(".chat-welcome")?.remove();

  const isUser = role === "user";
  const html = isUser
    ? escapeHtml(markdown).replace(/\n/g, "<br>")
    : renderMarkdown(markdown);

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const div = document.createElement("div");
  div.className = `chat-bubble ${isUser ? "user" : "ai"}`;
  div.innerHTML = `
    <div class="bubble-avatar ${isUser ? "usr-av" : "ai-av"}">
      <i class="bi ${isUser ? "bi-person-fill" : "bi-robot"}"></i>
    </div>
    <div class="bubble-body">
      <div class="bubble-content">${html}</div>
      <div class="bubble-meta">
        <span>${now}</span>
        ${!isUser ? `<i class="bi bi-clipboard bubble-copy" title="Copy" onclick="copyText(this)"></i>` : ""}
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
  div.id = id;
  div.className = "chat-bubble ai";
  div.innerHTML = `
    <div class="bubble-avatar ai-av"><i class="bi bi-robot"></i></div>
    <div class="bubble-body">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function clearChat() {
  const container = document.getElementById("chatMessages");
  container.innerHTML = `
    <div class="chat-welcome">
      <div class="welcome-icon"><i class="bi bi-robot"></i></div>
      <h3>Welcome to SciMind</h3>
      <p>I'm your AI research assistant powered by IBM Granite. Ask me anything about science!</p>
      <div class="quick-prompts">
        <button class="quick-btn" onclick="sendQuickPrompt('Explain quantum entanglement and its applications in quantum computing.')">Quantum Entanglement</button>
        <button class="quick-btn" onclick="sendQuickPrompt('What are the latest breakthroughs in CRISPR gene editing technology?')">CRISPR Breakthroughs</button>
        <button class="quick-btn" onclick="sendQuickPrompt('Summarize the current state of climate change research and key findings.')">Climate Research</button>
        <button class="quick-btn" onclick="sendQuickPrompt('What are the open problems in theoretical physics today?')">Open Physics Problems</button>
      </div>
    </div>`;
  chatHistory = [];
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUMMARIZE
// ══════════════════════════════════════════════════════════════════════════════
async function runSummarize() {
  const text  = document.getElementById("sumInput")?.value?.trim();
  const style = document.querySelector('input[name="sumStyle"]:checked')?.value || "detailed";
  if (!text) return showToast("Please paste paper text first.", "warning");

  setLoading(true, "Summarizing paper…");
  try {
    const res = await apiFetch("/api/summarize", { text, style });
    showResult("sumResult", res.summary, `Summary Style: ${style.toUpperCase()}`);
  } catch (err) {
    showResult("sumResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  CITATION GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
async function runCitation() {
  const info  = document.getElementById("citInput")?.value?.trim();
  const style = document.getElementById("citStyle")?.value || "APA";
  if (!info) return showToast("Please enter paper details.", "warning");

  setLoading(true, `Generating ${style} citation…`);
  try {
    const res = await apiFetch("/api/citation", { info, style });
    showResult("citResult", res.citation, `${style} Citation`);
  } catch (err) {
    showResult("citResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  LITERATURE REVIEW
// ══════════════════════════════════════════════════════════════════════════════
async function runLitReview() {
  const topic  = document.getElementById("litTopic")?.value?.trim();
  const papers = document.getElementById("litPapers")?.value?.trim();
  const scope  = document.getElementById("litScope")?.value || "comprehensive";
  if (!topic) return showToast("Please enter a research topic.", "warning");

  setLoading(true, "Building literature review…");
  try {
    const res = await apiFetch("/api/literature-review", { topic, papers, scope });
    showResult("litResult", res.review, `Literature Review: ${topic}`);
  } catch (err) {
    showResult("litResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  HYPOTHESIS GENERATOR
// ══════════════════════════════════════════════════════════════════════════════
async function runHypothesis() {
  const topic   = document.getElementById("hypTopic")?.value?.trim();
  const context = document.getElementById("hypContext")?.value?.trim();
  const count   = parseInt(document.getElementById("hypCount")?.value || "3");
  if (!topic) return showToast("Please enter a research topic.", "warning");

  setLoading(true, "Generating hypotheses…");
  try {
    const res = await apiFetch("/api/hypothesis", { topic, context, count });
    showResult("hypResult", res.hypotheses, `${count} Hypotheses for: ${topic}`);
  } catch (err) {
    showResult("hypResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  DRAFT REPORT
// ══════════════════════════════════════════════════════════════════════════════
async function runDraftReport() {
  const topic   = document.getElementById("repTopic")?.value?.trim();
  const section = document.getElementById("repSection")?.value || "full";
  const context = document.getElementById("repContext")?.value?.trim();
  if (!topic) return showToast("Please enter a research topic/title.", "warning");

  setLoading(true, "Drafting report section…");
  try {
    const res = await apiFetch("/api/draft-report", { topic, section, context });
    showResult("repResult", res.draft, `Draft — ${section.toUpperCase()}: ${topic}`);
  } catch (err) {
    showResult("repResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TOPIC EXPLORER
// ══════════════════════════════════════════════════════════════════════════════
async function runExplore() {
  const topic  = document.getElementById("expTopic")?.value?.trim();
  const domain = document.getElementById("expDomain")?.value?.trim();
  if (!topic) return showToast("Please enter a scientific topic.", "warning");

  setLoading(true, `Exploring: ${topic}…`);
  try {
    const res = await apiFetch("/api/explore-topic", { topic, domain });
    showResult("expResult", res.exploration, `Topic Exploration: ${topic}`);
  } catch (err) {
    showResult("expResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

function setTopic(prefix, topic) {
  const el = document.getElementById(`${prefix}Topic`);
  if (el) el.value = topic;
}

// ══════════════════════════════════════════════════════════════════════════════
//  EXPLAIN CONCEPT
// ══════════════════════════════════════════════════════════════════════════════
async function runExplain() {
  const concept = document.getElementById("explConcept")?.value?.trim();
  const level   = document.getElementById("explLevel")?.value || "intermediate";
  if (!concept) return showToast("Please enter a concept to explain.", "warning");

  setLoading(true, `Explaining: ${concept}…`);
  try {
    const res = await apiFetch("/api/explain", { concept, level });
    showResult("explResult", res.explanation, `${concept} — ${level} level`);
  } catch (err) {
    showResult("explResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPARE THEORIES
// ══════════════════════════════════════════════════════════════════════════════
async function runCompare() {
  const theory1 = document.getElementById("cmpTheory1")?.value?.trim();
  const theory2 = document.getElementById("cmpTheory2")?.value?.trim();
  const domain  = document.getElementById("cmpDomain")?.value?.trim();
  if (!theory1 || !theory2) return showToast("Please enter both theories.", "warning");

  setLoading(true, `Comparing theories…`);
  try {
    const res = await apiFetch("/api/compare-theories", { theory1, theory2, domain });
    showResult("cmpResult", res.comparison, `${theory1} vs ${theory2}`);
  } catch (err) {
    showResult("cmpResult", `⚠️ ${err.message}`, "Error");
  } finally {
    setLoading(false);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SHARED UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

/** POST JSON to an API endpoint and return parsed response. */
async function apiFetch(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Render Markdown to safe HTML using marked.js */
function renderMarkdown(text) {
  if (typeof marked === "undefined") return escapeHtml(text).replace(/\n/g, "<br>");
  return marked.parse(text, { breaks: true, gfm: true });
}

/** Show a result card in a container div */
function showResult(containerId, markdown, title) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const html = renderMarkdown(markdown);
  el.className = "result-area mt-3";
  el.innerHTML = `
    <button class="copy-btn" onclick="copyResultText('${containerId}')">
      <i class="bi bi-clipboard"></i> Copy
    </button>
    ${title ? `<div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;">${escapeHtml(title)}</div>` : ""}
    <div class="result-content">${html}</div>`;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/** Show/hide loading overlay */
function setLoading(show, message) {
  isLoading = show;
  const overlay = document.getElementById("loadingOverlay");
  const msg     = document.getElementById("loadingMsg");
  if (!overlay) return;
  if (show) {
    if (msg) msg.textContent = message || "Processing…";
    overlay.classList.remove("d-none");
  } else {
    overlay.classList.add("d-none");
  }
}

/** Copy text from a result container */
function copyResultText(containerId) {
  const el = document.getElementById(containerId)?.querySelector(".result-content");
  if (!el) return;
  copyToClipboard(el.innerText);
}

/** Copy text from nearest bubble-content ancestor */
function copyText(iconEl) {
  const content = iconEl.closest(".bubble-body")?.querySelector(".bubble-content");
  if (content) copyToClipboard(content.innerText);
}

/** Copy text to clipboard and flash tooltip */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const tip = document.getElementById("copyTooltip");
    if (!tip) return;
    tip.classList.remove("d-none");
    setTimeout(() => tip.classList.add("d-none"), 1500);
  }).catch(() => showToast("Copy failed — please copy manually.", "danger"));
}

/** Show a Bootstrap toast notification */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const icons = { info: "bi-info-circle-fill", warning: "bi-exclamation-triangle-fill", danger: "bi-x-circle-fill", success: "bi-check-circle-fill" };
  const colors = { info: "#4f8ef7", warning: "#f59e0b", danger: "#f87171", success: "#34d399" };
  const id  = `toast-${Date.now()}`;
  const div = document.createElement("div");
  div.id = id;
  div.className = "toast align-items-center show";
  div.setAttribute("role", "alert");
  div.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${icons[type] || icons.info}" style="color:${colors[type]||colors.info}"></i>
        ${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

/** HTML-escape a string */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
