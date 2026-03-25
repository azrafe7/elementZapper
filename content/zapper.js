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

  chrome.storage.local.get(["zapRulesByHost"], (res) => {
    appliedCount = 0;
    totalRulesForSite = 0;

    const all = res.zapRulesByHost || {};
    let host = "";

    try { host = new URL(window.location.href).host; } catch {}

    const rules = all[host] || [];
    totalRulesForSite = rules.length;

    rules.forEach(rule => {
      const { selector, action } = rule;
      if (!selector || selector.includes("ez-highlight")) return;

      try {
        const nodes = document.querySelectorAll(selector);
        if (action === "remove") {
          nodes.forEach(el => el.remove());
        } else if (action === "hide") {
          nodes.forEach(el => el.style.setProperty("display", "none", "important"));
        }
        appliedCount += nodes.length;
      } catch (err) {
        EZLog.error("Failed applying rule:", selector, err);
      }
    });

    updateBadge();
  });

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

  function highlightMatches(selector) {
    try {
      document.querySelectorAll(selector).forEach(el => {
        el.classList.add("ez-highlight");
      });
    } catch {}
  }

  function unhighlightMatches(selector) {
    try {
      document.querySelectorAll(selector).forEach(el => {
        el.classList.remove("ez-highlight");
      });
    } catch {}
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
                 style="margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
              
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
                ">
                ✕
              </button>
              <button class="ez-toggle-action" data-ez-ui="1"
                style="margin-left:6px; background:#444; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-size:10px;">
                ${action === "remove" ? "Remove" : "Hide"}
              </button>
            </div>
          `;
        })
        .join("");

      // Add hover highlight + delete handlers
      list.querySelectorAll(".ez-rule-item").forEach(item => {
        const selector = item.getAttribute("data-selector");

        item.addEventListener("mouseenter", () => highlightMatches(selector));
        item.addEventListener("mouseleave", () => unhighlightMatches(selector));

        const delBtn = item.querySelector(".ez-delete-rule");
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          deleteRuleForHost(selector);
        });
        
        const toggleBtn = item.querySelector(".ez-toggle-action");
        toggleBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();

          chrome.storage.local.get(["zapRulesByHost"], (res) => {
            const all = res.zapRulesByHost || {};
            const rules = all[host] || [];

            const rule = rules.find(r => r.selector === selector);
            if (!rule) return;

            rule.action = rule.action === "remove" ? "hide" : "remove";

            chrome.storage.local.set({ zapRulesByHost: all }, () => {
              refreshRulesViewer();
            });
          });
        });

      });
    });
  }

  // -----------------------------
  // UI ELEMENTS
  // -----------------------------

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
      minWidth: "160px"
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
    toast.textContent = "Element removed — Undo?";
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
      if (lastRemoved && lastRemoved.node && lastRemoved.parent) {
        if (lastRemoved.nextSibling) {
          lastRemoved.parent.insertBefore(lastRemoved.node, lastRemoved.nextSibling);
        } else {
          lastRemoved.parent.appendChild(lastRemoved.node);
        }
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

    EZLog.cs("Zapping element:", e.target);

    // Save for undo
    lastRemoved = {
      node: e.target,
      parent: e.target.parentNode,
      nextSibling: e.target.nextSibling
    };

    // Generate persistent selector
    const selector = generateSelector(e.target);
    EZLog.cs("Generated selector:", selector);

    try {
      // Remove element
      e.target.remove();

      // Show undo toast
      createUndoToast();

      // Add persistent rule
      const msgRule = EZMessaging.makeMessage(
        "ZAP_ADD_RULE",
        { selector },
        "content"
      );
      EZSend.sendToBackground(msgRule).then((res) => {
        appliedCount += 1;
        totalRulesForSite = res?.payload?.total ?? totalRulesForSite;
        updateBadge();
        refreshRulesViewer();
      });

    } catch (err) {
      EZLog.error("Failed to remove element:", err);
    }
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
