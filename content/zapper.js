(function () {
  let active = false;
  let lastHighlighted = null;

  function highlight(el) {
    if (lastHighlighted) {
      lastHighlighted.classList.remove("ez-highlight");
    }
    lastHighlighted = el;
    el.classList.add("ez-highlight");
  }

  function onMouseMove(e) {
    if (!active) return;
    highlight(e.target);
  }

  function onClick(e) {
    if (!active) return;

    // Prevent page interactions
    e.preventDefault();
    e.stopPropagation();

    EZLog.cs("Zapping element:", e.target);

    try {
      e.target.remove();
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

    // Prevent the browser context menu
    //e.preventDefault();
    //e.stopPropagation();

    EZLog.cs("Right‑click → stopping zap mode");
    window.elementZapper.stop();
  }

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

      EZLog.cs("Zapper stopped");
    }
  };
})();
