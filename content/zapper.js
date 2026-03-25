(function () {
  let active = false;
  let lastHighlighted = null;
  let lastRemoved = null;
  let stopButton = null;
  let banner = null;
  let overlayBox = null;
  let appliedCount = 0;
  let totalRulesForSite = 0;
  
  let debugPanel = null;

  // -----------------------------
  // HELPERS
  // -----------------------------

  function updateBadge() {
    const msg = EZMessaging.makeMessage(
      "ZAP_SET_BADGE",
      { applied: appliedCount, total: totalRulesForSite },
      "content"
    );
    EZSend.sendToBackground(msg);
  }

  // -----------------------------
  // RULE APPLICATION
  // -----------------------------

  // Tracks selectors already applied so the MutationObserver doesn't
  // double-count nodes that were handled on the initial run.
  const appliedSelectors = new Set();
  let rulesObserver = null;

  function getHost() {
    try { return new URL(window.location.href).host; } catch { return ""; }
  }

  // Apply all persistent rules for this host.
  // Safe to call multiple times — skips selectors already fully applied.
  function applyStoredRules() {
    chrome.storage.local.get(["zapRulesByHost"], (res) => {
      appliedCount = 0;
      totalRulesForSite = 0;

      const all = res.zapRulesByHost || {};
      const host = getHost();
      const rules = all[host] || [];
      totalRulesForSite = rules.length;

      rules.forEach(rule => {
        const { selector, action, persistent } = rule;
        if (!selector || selector.includes("ez-highlight")) return;
        if (persistent === false) return;

        try {
          const nodes = document.querySelectorAll(selector);
          nodes.forEach(el => {
            if (action === "remove") {
              el.remove();
            } else if (action === "hide") {
              el.style.setProperty("display", "none", "important");
            }
          });
          appliedCount += nodes.length;
        } catch (err) {
          EZLog.error("Failed applying rule:", selector, err);
        }
      });

      updateBadge();
    });
  }

  // Start watching for DOM additions so rules apply on SPAs / lazy-loaded content.
  function startRulesObserver() {
    if (rulesObserver) return;

    rulesObserver = new MutationObserver((mutations) => {
      // Only re-apply if new nodes were actually added to the tree.
      const hasAdditions = mutations.some(m => m.addedNodes.length > 0);
      if (!hasAdditions) return;
      applyStoredRules();
    });

    rulesObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    EZLog.cs("MutationObserver started for stored rules");
  }

  function stopRulesObserver() {
    if (rulesObserver) {
      rulesObserver.disconnect();
      rulesObserver = null;
      EZLog.cs("MutationObserver stopped");
    }
  }

  // Kick off initial rule application, respecting document ready state.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyStoredRules();
      startRulesObserver();
    });
  } else {
    applyStoredRules();
    startRulesObserver();
  }

  function isZapperUI(el) {
    return !!(el && el.closest('[data-ez-ui="1"]'));
  }

  function ensureOverlayBox() {
    if (overlayBox) return;

    overlayBox = document.createElement("div");
    overlayBox.setAttribute("data-ez-ui", "1");

    Object.assign(overlayBox.style, {
      position: "fixed",
      zIndex: "999999998",
      border: "2px solid #4FC3F7",
      background: "rgba(79, 195, 247, 0.15)",
      pointerEvents: "none",
      boxSizing: "border-box"
    });

    document.body.appendChild(overlayBox);
  }

  function updateOverlayBoxForElement(el) {
    if (!overlayBox) return;
    if (!el || !el.getBoundingClientRect) return;

    const rect = el.getBoundingClientRect();

    overlayBox.style.left = rect.left + "px";
    overlayBox.style.top = rect.top + "px";
    overlayBox.style.width = rect.width + "px";
    overlayBox.style.height = rect.height + "px";
  }

  function removeOverlayBox() {
    if (overlayBox) {
      overlayBox.remove();
      overlayBox = null;
    }
  }

  function clearAllHighlights() {
    document.querySelectorAll(".ez-highlight").forEach(el => {
      el.classList.remove("ez-highlight");
    });
  }

  function highlightMatches(selector) {
    clearAllHighlights();
    try {
      const el = document.querySelector(selector);
      if (el) el.classList.add("ez-highlight");
    } catch {}
  }

  function unhighlightMatches(selector) {
    try {
      const el = document.querySelector(selector);
      if (el) el.classList.remove("ez-highlight");
    } catch {}
  }

  function hideElements(selector) {
    try {
      document.querySelectorAll(selector).forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    } catch {}
  }

  function showElements(selector) {
    try {
      document.querySelectorAll(selector).forEach(el => {
        el.style.removeProperty("display");
      });
    } catch {}
  }

  function showGhostForSelector(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      ensureOverlayBox();
      overlayBox.style.left = rect.left + "px";
      overlayBox.style.top = rect.top + "px";
      overlayBox.style.width = rect.width + "px";
      overlayBox.style.height = rect.height + "px";
    } catch {}
  }

  function hideGhost() {
    if (overlayBox) {
      overlayBox.style.width = "0";
      overlayBox.style.height = "0";
    }
  }

  function deleteRuleForHost(selectorToDelete) {
    chrome.storage.local.get(["zapRulesByHost"], (res) => {
      const all = res.zapRulesByHost || {};
      let host = "";

      try { host = new URL(window.location.href).host; } catch {}

      if (!all[host]) return;

      all[host] = all[host].filter(rule => {
        const { selector, action } = rule;
        return selector !== selectorToDelete;
      });

      chrome.storage.local.set({ zapRulesByHost: all }, () => {
        refreshRulesViewer();
      });
    });
  }

  function refreshRulesViewer() {
    const list = debugPanel?.querySelector("#ez-rules-list");
    if (!list) return;

    chrome.storage.local.get(["zapRulesByHost"], (res) => {
      const all = res.zapRulesByHost || {};
      let host = "";

      try { host = new URL(window.location.href).host; } catch {}

      const rules = all[host] || [];

      if (rules.length === 0) {
        list.innerHTML = `<div style="opacity:0.6;">No rules for this site</div>`;
        return;
      }

      list.innerHTML = rules
        .map((rule, i) => {
          const { selector, action } = rule;
          return `
            <div data-ez-ui="1" class="ez-rule-item" 
                 data-selector='${selector}'
                 data-action='${action}'
                 style="margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; transition:outline 0.15s;">
              
              <code style="color:#8cf; flex:1; word-break:break-all;">${selector}</code>

              <button data-ez-ui="1" class="ez-delete-rule"
                style="
                  margin-left:8px;
                  background:#ff4d4d;
                  color:white;
                  border:none;
                  border-radius:3px;
                  padding:2px 6px;
                  cursor:pointer;
                  font-size:10px;
                  transition:all 0.15s;
                  min-width:22px;
                ">
                ✕
              </button>
              <button class="ez-toggle-remove" data-ez-ui="1"
                style="margin-left:6px; background:${action === "remove" ? "#ff6b6b" : "#444"}; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-size:10px; transition:all 0.15s; min-width:46px;">
                Remove
              </button>
              <button class="ez-toggle-hide" data-ez-ui="1"
                style="margin-left:4px; background:${action === "hide" ? "#ffd93d" : action === "show" ? "#4ecdc4" : "#444"}; color:${action === "hide" ? "#222" : action === "show" ? "#222" : "white"}; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-size:10px; transition:all 0.15s; min-width:36px;">
                ${action === "hide" ? "Show" : "Hide"}
              </button>
              <button class="ez-toggle-persistent" data-ez-ui="1"
                style="margin-left:4px; background:${rule.persistent !== false ? "#4ecdc4" : "#444"}; color:${rule.persistent !== false ? "#222" : "white"}; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-size:10px; transition:all 0.15s; min-width:32px;">
                Save
              </button>
            </div>
          `;
        })
        .join("");

      // Add hover highlight + delete handlers
      list.querySelectorAll(".ez-rule-item").forEach(item => {
        const selector = item.getAttribute("data-selector");

        item.addEventListener("mouseenter", () => {
          item.style.outline = "1px solid #4FC3F7";
          highlightMatches(selector);
          // Read the action from the data attribute set at render time,
          // not from the closed-over `rule` variable which is out of scope here.
          const itemAction = item.getAttribute("data-action");
          if (itemAction === "hide") {
            showGhostForSelector(selector);
          }
        });
        item.addEventListener("mouseleave", () => {
          item.style.outline = "";
          unhighlightMatches(selector);
          hideGhost();
        });

        const delBtn = item.querySelector(".ez-delete-rule");
        const removeBtn = item.querySelector(".ez-toggle-remove");
        const hideBtn = item.querySelector(".ez-toggle-hide");
        const persistBtn = item.querySelector(".ez-toggle-persistent");

        [delBtn, removeBtn, hideBtn, persistBtn].forEach(btn => {
          btn.addEventListener("mouseenter", () => {
            btn.style.opacity = "1";
            btn.style.transform = "scale(1.05)";
          });
          btn.addEventListener("mouseleave", () => {
            btn.style.opacity = "";
            btn.style.transform = "";
          });
        });

        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          deleteRuleForHost(selector);
        });

        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          chrome.storage.local.get(["zapRulesByHost"], (res) => {
            const all = res.zapRulesByHost || {};
            const rules = all[host] || [];
            const rule = rules.find(r => r.selector === selector);
            if (!rule) return;
            rule.action = "remove";
            chrome.storage.local.set({ zapRulesByHost: all }, () => refreshRulesViewer());
          });
        });

        hideBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          chrome.storage.local.get(["zapRulesByHost"], (res) => {
            const all = res.zapRulesByHost || {};
            const rules = all[host] || [];
            const rule = rules.find(r => r.selector === selector);
            if (!rule) return;

            const currentlyHidden = rule.action === "hide";
            if (currentlyHidden) {
              rule.action = "show";
              showElements(selector);
            } else {
              rule.action = "hide";
              hideElements(selector);
            }

            chrome.storage.local.set({ zapRulesByHost: all }, () => refreshRulesViewer());
          });
        });

        persistBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          chrome.storage.local.get(["zapRulesByHost"], (res) => {
            const all = res.zapRulesByHost || {};
            const rules = all[host] || [];
            const rule = rules.find(r => r.selector === selector);
            if (!rule) return;
            rule.persistent = rule.persistent === false ? true : false;
            chrome.storage.local.set({ zapRulesByHost: all }, () => refreshRulesViewer());
          });
        });

      });
    });
  }

  // -----------------------------
  // UI ELEMENTS
  // -----------------------------

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function createDebugPanel() {
    if (debugPanel) return;

    debugPanel = document.createElement("div");
    debugPanel.setAttribute("data-ez-ui", "1");

    Object.assign(debugPanel.style, {
      position: "fixed",
      bottom: "20px",
      left: "20px",
      zIndex: "999999999",
      padding: "10px",
      background: "#222",
      color: "white",
      fontSize: "12px",
      fontFamily: "monospace",
      borderRadius: "6px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      userSelect: "none",
      minWidth: "160px",
      cursor: "move"
    });

    debugPanel.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      isDragging = true;
      dragOffsetX = e.clientX - debugPanel.offsetLeft;
      dragOffsetY = e.clientY - debugPanel.offsetTop;
      debugPanel.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      debugPanel.style.left = (e.clientX - dragOffsetX) + "px";
      debugPanel.style.top = (e.clientY - dragOffsetY) + "px";
      debugPanel.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      debugPanel.style.cursor = "move";
    });

    debugPanel.innerHTML = `
      <div style="margin-bottom:6px; font-weight:bold;">Zapper Debug</div>

      <button data-ez-ui="1" id="ez-clear-storage-btn"
        style="
          width:100%;
          padding:6px;
          background:#ff4d4d;
          color:white;
          border:none;
          border-radius:4px;
          cursor:pointer;
          font-size:12px;
          margin-bottom:10px;
        ">
        Clear Storage
      </button>

      <button data-ez-ui="1" id="ez-delete-site-rules-btn"
        style="
          width:100%;
          padding:6px;
          background:#d9534f;
          color:white;
          border:none;
          border-radius:4px;
          cursor:pointer;
          font-size:12px;
          margin-bottom:10px;
        ">
        Delete Rules (This Site)
      </button>

      <button data-ez-ui="1" id="ez-refresh-rules-btn"
        style="
          width:100%;
          padding:6px;
          background:#5bc0de;
          color:white;
          border:none;
          border-radius:4px;
          cursor:pointer;
          font-size:12px;
          margin-bottom:10px;
        ">
        Refresh List
      </button>

      <button data-ez-ui="1" id="ez-log-rules-btn"
        style="
          width:100%;
          padding:6px;
          background:#5cb85c;
          color:white;
          border:none;
          border-radius:4px;
          cursor:pointer;
          font-size:12px;
          margin-bottom:10px;
        ">
        Log Rules (Console)
      </button>

      <div style="margin-bottom:4px; font-weight:bold;">Rules for this site:</div>
      <div id="ez-rules-list" data-ez-ui="1"
        style="
          max-height:150px;
          overflow-y:auto;
          background:#111;
          padding:6px;
          border-radius:4px;
          font-size:11px;
          line-height:1.4;
          border:1px solid #444;
        ">
        <div style="opacity:0.6;">Loading…</div>
      </div>
    `;

    debugPanel.querySelector("#ez-clear-storage-btn").addEventListener("click", () => {
      EZLog.cs("Debug: clearing storage");

      const msg = EZMessaging.makeMessage("ZAP_CLEAR_STORAGE", {}, "content");
      EZSend.sendToBackground(msg);

      // Also clear local rules cache on this page
      chrome.storage.local.get(["zapRulesByHost"], () => {
        appliedCount = 0;
        totalRulesForSite = 0;
        updateBadge();
        refreshRulesViewer();
      });
    });

    document.body.appendChild(debugPanel);

    // Add hover effects to debug panel buttons
    debugPanel.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("mouseenter", () => {
        btn.style.opacity = "1";
        btn.style.transform = "scale(1.02)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.opacity = "";
        btn.style.transform = "";
      });
    });
    
    // DELETE RULES FOR THIS SITE
    debugPanel.querySelector("#ez-delete-site-rules-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      chrome.storage.local.get(["zapRulesByHost"], (res) => {
        const all = res.zapRulesByHost || {};
        let host = "";

        try { host = new URL(window.location.href).host; } catch {}

        if (all[host]) {
          delete all[host];
          chrome.storage.local.set({ zapRulesByHost: all }, () => {
            appliedCount = 0;
            totalRulesForSite = 0;
            updateBadge();
            refreshRulesViewer();
          });
        }
      });
    });

    // REFRESH LIST
    debugPanel.querySelector("#ez-refresh-rules-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      refreshRulesViewer();
    });

    // LOG RULES
    debugPanel.querySelector("#ez-log-rules-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      chrome.storage.local.get(["zapRulesByHost"], (res) => {
        const all = res.zapRulesByHost || {};
        let host = "";

        try { host = new URL(window.location.href).host; } catch {}

        console.log("Rules for", host, all[host] || []);
      });
    });

    refreshRulesViewer();
  }

  function removeDebugPanel() {
    if (debugPanel) {
      debugPanel.remove();
      debugPanel = null;
    }
  }

  function createStopButton() {
    stopButton = document.createElement("div");
    stopButton.textContent = "STOP ZAPPING";
    stopButton.setAttribute("data-ez-ui", "1");

    Object.assign(stopButton.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "999999999",
      padding: "8px 12px",
      background: "#ff4d4d",
      color: "white",
      fontSize: "14px",
      fontFamily: "sans-serif",
      borderRadius: "4px",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      userSelect: "none"
    });

    stopButton.addEventListener("click", () => {
      EZLog.cs("Stop button clicked");
      window.elementZapper.stop();
    });

    document.body.appendChild(stopButton);
  }

  function removeStopButton() {
    if (stopButton) {
      stopButton.remove();
      stopButton = null;
    }
  }

  function createBanner() {
    banner = document.createElement("div");
    banner.textContent = "ZAP MODE ACTIVE";
    banner.setAttribute("data-ez-ui", "1");

    Object.assign(banner.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "999999999",
      padding: "6px 12px",
      background: "rgba(255, 0, 0, 0.85)",
      color: "white",
      fontSize: "13px",
      fontFamily: "sans-serif",
      borderRadius: "4px",
      userSelect: "none",
      pointerEvents: "none"
    });

    document.body.appendChild(banner);
  }

  function removeBanner() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }

  function createUndoToast() {
    const toast = document.createElement("div");
    toast.textContent = "Element hidden — Undo?";
    toast.setAttribute("data-ez-ui", "1");

    Object.assign(toast.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "999999999",
      padding: "8px 12px",
      background: "#333",
      color: "white",
      fontSize: "13px",
      fontFamily: "sans-serif",
      borderRadius: "4px",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      userSelect: "none"
    });

    toast.addEventListener("click", () => {
      if (lastRemoved?.node) {
        // Element was hidden in place — just restore its display.
        lastRemoved.node.style.removeProperty("display");
        EZLog.cs("Undo performed");

        appliedCount = Math.max(0, appliedCount - 1);
        updateBadge();
      }

      lastRemoved = null;
      toast.remove();
    });

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
  }

  // -----------------------------
  // ZAPPER LOGIC
  // -----------------------------

  function highlight(el) {
    if (isZapperUI(el)) return;

    // If already highlighted, do nothing
    if (lastHighlighted === el) {
      return;
    }

    // Remove highlight from previous
    if (lastHighlighted) {
      lastHighlighted.classList.remove("ez-highlight");
    }

    lastHighlighted = el;
    el.classList.add("ez-highlight");

    ensureOverlayBox();
    updateOverlayBoxForElement(el);
  }

  function onMouseMove(e) {
    if (!active) return;
    if (isZapperUI(e.target)) return;
    highlight(e.target);
  }

  function onClick(e) {
    if (!active) return;

    // Ignore zapper UI (stop button, banner, undo toast, overlay)
    if (isZapperUI(e.target)) {
      EZLog.cs("Click on zapper UI → ignoring");
      return;
    }

    // Prevent page interactions
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    EZLog.cs("Zapping element:", target);

    // Generate selector BEFORE hiding so the element is still in the DOM
    // and the selector can be validated against it.
    const selector = generateSelector(target);
    EZLog.cs("Generated selector:", selector);

    // Hide the element visually (keep it in the DOM so undo is trivial
    // and the saved rule action:"hide" matches what we actually did).
    target.style.setProperty("display", "none", "important");

    // Save enough context to undo (just re-show the element).
    lastRemoved = { node: target };

    // Show undo toast
    createUndoToast();

    // Persist the rule
    const msgRule = EZMessaging.makeMessage(
      "ZAP_ADD_RULE",
      { selector, action: "hide", persistent: true },
      "content"
    );
    EZSend.sendToBackground(msgRule).then((res) => {
      appliedCount += 1;
      totalRulesForSite = res?.payload?.total ?? totalRulesForSite;
      updateBadge();
      refreshRulesViewer();
    });
  }

  function onKeyDown(e) {
    if (!active) return;

    if (e.key === "Escape") {
      EZLog.cs("ESC pressed → stopping zap mode");
      window.elementZapper.stop();
    }
  }

  function onRightClick(e) {
    if (!active) return;
    if (isZapperUI(e.target)) return;

    EZLog.cs("Right‑click → stopping zap mode");
    window.elementZapper.stop();
  }

  function cleanSelector(selector) {
    if (!selector) return selector;

    return selector
      .replace(/\.ez-highlight\b/g, "") // remove our class
      .replace(/\s+/g, " ")             // collapse whitespace
      .trim();
  }

  function isUniqueSelector(selector, root = document) {
    try {
      const nodes = root.querySelectorAll(selector);
      return nodes.length === 1;
    } catch {
      return false;
    }
  }

  function fallbackSelector(el) {
    const parts = [];

    while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
      let part = el.tagName.toLowerCase();

      const classes = Array.from(el.classList || []).filter(
        c => c !== "ez-highlight"
      );

      if (el.id) {
        part = `#${jq(el.id)}`;
        parts.unshift(part);
        break;
      } else if (classes.length > 0) {
        part += "." + classes.map(jq).join(".");
      } else {
        const parent = el.parentElement;
        if (!parent) {
          parts.unshift(part);
          break;
        }
        const index = Array.from(parent.children).indexOf(el) + 1;
        part += `:nth-child(${index})`;
      }

      parts.unshift(part);
      el = el.parentElement;
    }

    return parts.join(" > ");
  }

  function generateSelector(el) {
    if (!el) return null;

    // 1. Remove our own classes before generating selector
    const originalClasses = [...el.classList];
    el.classList.remove("ez-highlight");

    // 2. Try elemToSelector() first (your implementation)
    let selector = null;
    try {
      selector = elemToSelector(el, { compact: true, fullPath: false });
    } catch (err) {
      EZLog.error("elemToSelector failed:", err);
    }

    // Restore classes
    el.classList.value = originalClasses.join(" ");

    // 3. Clean selector (strip ez-highlight if it slipped in)
    selector = cleanSelector(selector);

    // 4. If selector is valid AND unique → use it
    if (selector && isUniqueSelector(selector)) {
      EZLog.cs("Selector from elemToSelector is unique:", selector);
      return selector;
    }

    EZLog.cs("elemToSelector selector not unique, falling back:", selector);

    // 5. Fallback: deterministic path-based selector
    selector = fallbackSelector(el);
    selector = cleanSelector(selector);

    // 6. If fallback is unique → done
    if (isUniqueSelector(selector)) {
      EZLog.cs("Fallback selector is unique:", selector);
      return selector;
    }

    // 7. Last resort: walk up ancestors and tighten
    let current = el.parentElement;
    while (current && current !== document.body) {
      let parentSel = null;

      try {
        parentSel = elemToSelector(current, { compact: true, fullPath: false });
        parentSel = cleanSelector(parentSel);
      } catch {}

      if (parentSel && isUniqueSelector(parentSel)) {
        const combined = `${parentSel} ${el.tagName.toLowerCase()}`;
        if (isUniqueSelector(combined)) {
          EZLog.cs("Ancestor-based selector:", combined);
          return combined;
        }
      }

      current = current.parentElement;
    }

    // 8. If all else fails, return the fallback (even if not unique)
    EZLog.cs("Returning non-unique fallback selector:", selector);
    return selector;
  }

  // -----------------------------
  // PUBLIC API
  // -----------------------------

  window.elementZapper = {
    start() {
      if (active) {
        EZLog.cs("Zapper already active");
        return;
      }

      active = true;

      document.addEventListener("mousemove", onMouseMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("contextmenu", onRightClick, true);

      createStopButton();
      createBanner();
      ensureOverlayBox();
      createDebugPanel();

      EZLog.cs("Zapper started");
    },

    stop() {
      if (!active) {
        EZLog.cs("Zapper already stopped");
        return;
      }

      active = false;

      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onRightClick, true);

      if (lastHighlighted) {
        lastHighlighted.classList.remove("ez-highlight");
        lastHighlighted = null;
      }

      removeStopButton();
      removeBanner();
      removeOverlayBox();
      removeDebugPanel();

      EZLog.cs("Zapper stopped");
    }
  };
})();
