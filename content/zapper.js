chrome.storage.local.get(["zapRules"], (res) => {
  const rules = res.zapRules || [];
  EZLog.cs("Applying persistent rules:", rules);

  rules.forEach((selector) => {
    try {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    } catch (err) {
      EZLog.error("Failed applying rule:", selector, err);
    }
  });
});

(function () {
  let active = false;
  let lastHighlighted = null;
  let lastRemoved = null;
  let stopButton = null;
  let banner = null;
  let overlayBox = null;

  // -----------------------------
  // HELPERS
  // -----------------------------

  function isZapperUI(el) {
    return el && el.closest('[data-ez-ui="1"]');
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

  // -----------------------------
  // UI ELEMENTS
  // -----------------------------

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

        // decrement badge count
        const msg = EZMessaging.makeMessage("ZAP_INCREMENT", { delta: -1 }, "content");
        EZSend.sendToBackground(msg);
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

      // Increment badge count
      const msgInc = EZMessaging.makeMessage(
        "ZAP_INCREMENT",
        { delta: 1 },
        "content"
      );
      EZSend.sendToBackground(msgInc);

      // Add persistent rule
      const msgRule = EZMessaging.makeMessage(
        "ZAP_ADD_RULE",
        { selector },
        "content"
      );
      EZSend.sendToBackground(msgRule);

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

  function generateSelector(el) {
    if (!el) return null;

    // Prefer ID
    if (el.id) {
      return `#${el.id}`;
    }

    // Use classes if available
    if (el.classList.length > 0) {
      return (
        el.tagName.toLowerCase() +
        "." +
        Array.from(el.classList).join(".")
      );
    }

    // Fallback: nth-child
    const parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();

    const index = Array.from(parent.children).indexOf(el) + 1;
    return `${el.tagName.toLowerCase()}:nth-child(${index})`;
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

      EZLog.cs("Zapper stopped");
    }
  };
})();
