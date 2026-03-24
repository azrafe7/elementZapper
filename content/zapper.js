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
    e.preventDefault();
    e.stopPropagation();
    e.target.remove();
  }

  window.elementZapper = {
    start() {
      if (active) return;
      active = true;
      document.addEventListener("mousemove", onMouseMove, true);
      document.addEventListener("click", onClick, true);
      console.log("[Zapper] started");
    },

    stop() {
      active = false;
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      if (lastHighlighted) {
        lastHighlighted.classList.remove("ez-highlight");
        lastHighlighted = null;
      }
      console.log("[Zapper] stopped");
    }
  };
})();
