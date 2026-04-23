(() => {
  if (window.__myvocabsLoaded) return;
  window.__myvocabsLoaded = true;

  let hostEl = null;
  let shadowRoot = null;
  let currentAudio = null;

  // ─── Popup styles (isolated in Shadow DOM) ───
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :host { all: initial; }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    .mv-trigger {
      position: fixed;
      z-index: 2147483647;
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #3861fb, #2846c8);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(56,97,251,0.45);
      transition: transform 0.15s, box-shadow 0.15s;
      font-size: 16px; line-height: 1;
      animation: mvPop 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    .mv-trigger:hover {
      transform: scale(1.15);
      box-shadow: 0 6px 20px rgba(56,97,251,0.55);
    }
    @keyframes mvPop {
      from { transform: scale(0); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    .mv-popup {
      position: fixed;
      z-index: 2147483647;
      width: 380px;
      max-height: 440px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a202c;
      overflow: hidden;
      display: flex; flex-direction: column;
      animation: mvSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes mvSlideIn {
      from { transform: translateY(8px) scale(0.96); opacity: 0; }
      to   { transform: translateY(0) scale(1); opacity: 1; }
    }

    /* ── Header ── */
    .mv-header {
      background: linear-gradient(135deg, #3861fb, #2846c8);
      padding: 16px 18px 14px;
      color: #fff;
      display: flex; flex-direction: column; gap: 8px;
    }
    .mv-header-top {
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .mv-word-row { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .mv-word {
      font-size: 20px; font-weight: 700;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .mv-phonetic {
      font-size: 13px; opacity: 0.8; font-weight: 400;
    }
    .mv-audio-btn {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; flex-shrink: 0;
      transition: background 0.2s;
    }
    .mv-audio-btn:hover { background: rgba(255,255,255,0.35); }
    .mv-header-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .mv-icon-btn {
      background: rgba(255,255,255,0.15); border: none; color: #fff;
      width: 30px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px;
      transition: background 0.2s;
    }
    .mv-icon-btn:hover { background: rgba(255,255,255,0.3); }
    .mv-icon-btn.saved { background: rgba(76,175,80,0.5); }

    /* ── Source Tabs ── */
    .mv-tabs {
      display: flex; gap: 0; background: #f0f4ff; border-bottom: 1px solid #e2e8f0;
    }
    .mv-tab {
      flex: 1; padding: 10px 8px; text-align: center;
      font-size: 12px; font-weight: 600; color: #64748b;
      cursor: pointer; border: none; background: none;
      border-bottom: 2px solid transparent;
      transition: all 0.2s; letter-spacing: 0.3px;
    }
    .mv-tab:hover { color: #3861fb; background: rgba(56,97,251,0.05); }
    .mv-tab.active {
      color: #3861fb; border-bottom-color: #3861fb;
      background: #fff;
    }

    /* ── Body ── */
    .mv-body {
      flex: 1; overflow-y: auto; padding: 16px 18px;
    }
    .mv-body::-webkit-scrollbar { width: 5px; }
    .mv-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

    .mv-loading {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 0; gap: 12px;
    }
    .mv-spinner {
      width: 28px; height: 28px;
      border: 3px solid #e2e8f0; border-top-color: #3861fb;
      border-radius: 50%;
      animation: mvSpin 0.8s linear infinite;
    }
    @keyframes mvSpin { to { transform: rotate(360deg); } }
    .mv-loading-text { font-size: 13px; color: #94a3b8; }

    .mv-def-group { margin-bottom: 14px; }
    .mv-pos {
      display: inline-block;
      font-size: 11px; font-weight: 600;
      color: #3861fb; background: #eef2ff;
      padding: 2px 8px; border-radius: 4px;
      margin-bottom: 8px; text-transform: lowercase;
    }
    .mv-def-item {
      display: flex; gap: 8px; margin-bottom: 10px;
      padding-left: 2px;
    }
    .mv-def-num {
      color: #3861fb; font-weight: 700; font-size: 13px;
      min-width: 18px; padding-top: 1px;
    }
    .mv-def-content { flex: 1; }
    .mv-def-text {
      font-size: 14px; line-height: 1.55; color: #1e293b;
    }
    .mv-def-example {
      font-size: 13px; color: #64748b; font-style: italic;
      margin-top: 4px; padding-left: 12px;
      border-left: 2px solid #e2e8f0;
    }

    /* ── No results ── */
    .mv-no-results {
      text-align: center; padding: 24px 0;
    }
    .mv-no-results-icon { font-size: 32px; opacity: 0.3; margin-bottom: 10px; }
    .mv-no-results-text { font-size: 14px; color: #64748b; margin-bottom: 16px; }
    .mv-link-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    }
    .mv-link-btn {
      display: flex; align-items: center; justify-content: center;
      gap: 6px; padding: 10px;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      font-size: 12px; font-weight: 600; color: #3861fb;
      text-decoration: none; cursor: pointer;
      transition: all 0.2s;
    }
    .mv-link-btn:hover { background: #eef2ff; border-color: #3861fb; }

    /* ── Footer ── */
    .mv-footer {
      padding: 10px 18px;
      border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
      background: #f8fafc;
    }
    .mv-source {
      font-size: 11px; color: #94a3b8;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .mv-footer-links { display: flex; gap: 8px; }
    .mv-footer-link {
      font-size: 11px; color: #3861fb; text-decoration: none;
      font-weight: 500; cursor: pointer;
    }
    .mv-footer-link:hover { text-decoration: underline; }

    /* ── Toast ── */
    .mv-toast {
      position: absolute; bottom: 50px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #fff;
      padding: 8px 16px; border-radius: 8px;
      font-size: 12px; font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: mvToast 2s ease forwards;
      pointer-events: none; white-space: nowrap;
    }
    .mv-toast.success { background: #16a34a; }
    .mv-toast.error   { background: #dc2626; }
    @keyframes mvToast {
      0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
      15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `;

  // ─── Create Shadow DOM host ───
  function ensureHost() {
    if (hostEl && document.body.contains(hostEl)) return;
    hostEl = document.createElement("div");
    hostEl.id = "myvocabs-host";
    hostEl.style.cssText = "all:initial; position:fixed; z-index:2147483647; top:0; left:0; pointer-events:none;";
    shadowRoot = hostEl.attachShadow({ mode: "closed" });
    const styleEl = document.createElement("style");
    styleEl.textContent = STYLES;
    shadowRoot.appendChild(styleEl);
    document.body.appendChild(hostEl);
  }

  // ─── Position helper ───
  function clampPosition(x, y, w, h) {
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + w + pad > vw) left = vw - w - pad;
    if (left < pad) left = pad;
    if (top + h + pad > vh) top = vh - h - pad;
    if (top < pad) top = pad;
    return { left, top };
  }

  // ─── Show trigger button ───
  function showTrigger(x, y, text) {
    cleanup();
    ensureHost();

    const btn = document.createElement("div");
    btn.className = "mv-trigger";
    btn.innerHTML = "📖";
    btn.style.pointerEvents = "auto";

    const pos = clampPosition(x + 8, y - 40, 32, 32);
    btn.style.left = pos.left + "px";
    btn.style.top = pos.top + "px";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showPopup(pos.left, pos.top + 40, text);
    });

    shadowRoot.appendChild(btn);
  }

  // ─── Show popup ───
  function showPopup(x, y, text) {
    // Remove old popups but keep host
    clearShadowContent();
    ensureHost();

    const popup = document.createElement("div");
    popup.className = "mv-popup";
    popup.style.pointerEvents = "auto";

    const pos = clampPosition(x, y, 380, 440);
    popup.style.left = pos.left + "px";
    popup.style.top = pos.top + "px";

    // ── Header
    popup.innerHTML = `
      <div class="mv-header">
        <div class="mv-header-top">
          <div class="mv-word-row">
            <span class="mv-word">${escapeHtml(text)}</span>
            <span class="mv-phonetic" id="mv-phonetic"></span>
            <button class="mv-audio-btn" id="mv-audio" style="display:none" title="Listen">🔊</button>
          </div>
          <div class="mv-header-actions">
            <button class="mv-icon-btn" id="mv-save" title="Save to wordlist">💾</button>
            <button class="mv-icon-btn" id="mv-close" title="Close">✕</button>
          </div>
        </div>
      </div>
      <div class="mv-tabs">
        <button class="mv-tab active" data-src="cambridge">Cambridge</button>
        <button class="mv-tab" data-src="oxford">Oxford</button>
        <button class="mv-tab" data-src="wikipedia">Wikipedia</button>
      </div>
      <div class="mv-body" id="mv-body">
        <div class="mv-loading">
          <div class="mv-spinner"></div>
          <div class="mv-loading-text">Looking up "${escapeHtml(text)}"…</div>
        </div>
      </div>
      <div class="mv-footer">
        <span class="mv-source" id="mv-source"></span>
        <div class="mv-footer-links" id="mv-links"></div>
      </div>
    `;

    shadowRoot.appendChild(popup);

    // ── Wire close
    popup.querySelector("#mv-close").addEventListener("click", () => cleanup());

    // ── Wire save
    popup.querySelector("#mv-save").addEventListener("click", () => {
      const firstDef = popup.querySelector(".mv-def-text")?.textContent || "";
      chrome.runtime.sendMessage(
        { type: "SAVE_WORD", word: text, definition: firstDef },
        (res) => {
          const saveBtn = popup.querySelector("#mv-save");
          if (res?.success) {
            saveBtn.classList.add("saved");
            saveBtn.textContent = "✓";
            showToast(popup, "Saved to wordlist!", "success");
          } else if (res?.reason === "exists") {
            showToast(popup, "Already in wordlist", "error");
          }
        }
      );
    });

    // ── Wire tabs
    const tabs = popup.querySelectorAll(".mv-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        fetchDefinition(popup, text, tab.dataset.src);
      });
    });

    // ── Load preferred source
    chrome.storage.local.get("preferredSource", (data) => {
      const src = data.preferredSource || "cambridge";
      tabs.forEach((t) => {
        t.classList.toggle("active", t.dataset.src === src);
      });
      fetchDefinition(popup, text, src);
    });
  }

  // ─── Fetch and render definition ───
  function fetchDefinition(popup, word, source) {
    const body = popup.querySelector("#mv-body");
    body.innerHTML = `
      <div class="mv-loading">
        <div class="mv-spinner"></div>
        <div class="mv-loading-text">Searching ${source}…</div>
      </div>`;

    // Save preference
    chrome.storage.local.set({ preferredSource: source });

    chrome.runtime.sendMessage(
      { type: "LOOKUP_WORD", word, source },
      (result) => {
        if (!result || result.error) {
          renderNoResults(popup, word, result);
          return;
        }
        renderResult(popup, word, result);
      }
    );
  }

  // ─── Render definitions ───
  function renderResult(popup, word, result) {
    const body = popup.querySelector("#mv-body");
    const sourceEl = popup.querySelector("#mv-source");
    const linksEl = popup.querySelector("#mv-links");
    const phoneticEl = popup.querySelector("#mv-phonetic");
    const audioBtn = popup.querySelector("#mv-audio");

    // Phonetic
    if (result.phonetic) {
      phoneticEl.textContent = result.phonetic;
    }

    // Audio
    if (result.audio) {
      audioBtn.style.display = "flex";
      audioBtn.addEventListener("click", () => {
        if (currentAudio) currentAudio.pause();
        currentAudio = new Audio(result.audio);
        currentAudio.play().catch(() => {});
      });
    }

    // Source
    sourceEl.textContent = result.source || "";

    // Links
    linksEl.innerHTML = "";
    if (result.cambridgeUrl) addFooterLink(linksEl, "Cambridge", result.cambridgeUrl);
    if (result.oxfordUrl) addFooterLink(linksEl, "Oxford", result.oxfordUrl);
    if (result.wikiUrl) addFooterLink(linksEl, "Wiki", result.wikiUrl);

    // Definitions
    if (!result.definitions || result.definitions.length === 0) {
      renderNoResults(popup, word, result);
      return;
    }

    // Group by part of speech
    const groups = {};
    result.definitions.forEach((d) => {
      const key = d.partOfSpeech || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    let html = "";
    for (const [pos, defs] of Object.entries(groups)) {
      html += `<div class="mv-def-group">`;
      if (pos && pos !== "other") {
        html += `<span class="mv-pos">${escapeHtml(pos)}</span>`;
      }
      defs.forEach((def, i) => {
        html += `
          <div class="mv-def-item">
            <span class="mv-def-num">${i + 1}.</span>
            <div class="mv-def-content">
              <div class="mv-def-text">${escapeHtml(def.definition)}</div>
              ${def.example ? `<div class="mv-def-example">"${escapeHtml(def.example)}"</div>` : ""}
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    body.innerHTML = html;
  }

  // ─── No results view ───
  function renderNoResults(popup, word, result) {
    const body = popup.querySelector("#mv-body");
    const r = result || {};
    body.innerHTML = `
      <div class="mv-no-results">
        <div class="mv-no-results-icon">🔍</div>
        <div class="mv-no-results-text">No definitions found for "${escapeHtml(word)}"</div>
        <div class="mv-link-grid">
          <a class="mv-link-btn" href="${r.googleUrl || `https://www.google.com/search?q=define+${encodeURIComponent(word)}`}" target="_blank" rel="noopener">🔎 Google</a>
          <a class="mv-link-btn" href="${r.wikiUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(word)}`}" target="_blank" rel="noopener">📚 Wikipedia</a>
          <a class="mv-link-btn" href="${r.cambridgeUrl || `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`}" target="_blank" rel="noopener">📘 Cambridge</a>
          <a class="mv-link-btn" href="${r.oxfordUrl || `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}`}" target="_blank" rel="noopener">📗 Oxford</a>
        </div>
      </div>`;
  }

  function addFooterLink(container, label, url) {
    const a = document.createElement("a");
    a.className = "mv-footer-link";
    a.textContent = label;
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    container.appendChild(a);
  }

  function showToast(popup, msg, type) {
    const old = popup.querySelector(".mv-toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.className = "mv-toast " + type;
    t.textContent = msg;
    popup.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ─── Cleanup helpers ───
  function clearShadowContent() {
    if (!shadowRoot) return;
    const style = shadowRoot.querySelector("style");
    while (shadowRoot.lastChild && shadowRoot.lastChild !== style) {
      shadowRoot.removeChild(shadowRoot.lastChild);
    }
  }

  function cleanup() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    clearShadowContent();
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Event listeners ───
  let isDblClick = false;
  let mouseupTimer = null;

  // Double-click → show popup directly (no trigger icon)
  document.addEventListener("dblclick", (e) => {
    if (hostEl && hostEl.contains(e.target)) return;
    isDblClick = true;
    if (mouseupTimer) { clearTimeout(mouseupTimer); mouseupTimer = null; }

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text && text.length >= 2 && text.length < 200) {
        cleanup();
        showPopup(e.clientX, e.clientY + 20, text);
      }
      isDblClick = false;
    }, 10);
  });

  // Drag-selection → show trigger icon (with delay to avoid dblclick conflict)
  document.addEventListener("mouseup", (e) => {
    if (hostEl && hostEl.contains(e.target)) return;
    if (isDblClick) return;

    if (mouseupTimer) clearTimeout(mouseupTimer);
    mouseupTimer = setTimeout(() => {
      if (isDblClick) return;
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text && text.length >= 2 && text.length < 200) {
        showTrigger(e.clientX, e.clientY, text);
      }
    }, 300);
  });

  document.addEventListener("mousedown", (e) => {
    if (hostEl && hostEl.contains(e.target)) return;
    cleanup();
  });

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cleanup();
  });
})();
