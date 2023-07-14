"use strict";

(async () => {
  let manifest = chrome.runtime.getManifest();
  console.log(manifest.name + " v" + manifest.version);

  const HIGHLIGHT_RED = "rgba(250, 70, 60, 0.5)";
  const HIGHLIGHT_GREEN = "rgba(17, 193, 12, 0.5)";
  const HIGHLIGHT_BG_COLOR = HIGHLIGHT_RED;

  const OUTLINE_RED = "rgba(250, 70, 60, 0.75)";
  const OUTLINE_GREEN = "rgba(17, 193, 12, 0.90)";
  const OUTLINE_COLOR = OUTLINE_RED;

  /* if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // dark mode
    HIGHLIGHT_BG_COLOR = HIGHLIGHT_DARK;
    OUTLINE_COLOR = OUTLINE_DARK;
  } */

  let options = {
    // container: document.body,
    enabled: false,
    selectors: "*",
    background: HIGHLIGHT_BG_COLOR,
    borderWidth: 0,
    outlineWidth: 1,
    outlineColor: OUTLINE_COLOR,
    transition: "",
    ignoreElements: [document.body],
    action: {}
  }

  // create "disabled" elementPicker on page load
  let elementPicker = new ElementPicker(options);
  elementPicker.action = {
    trigger: "mouseup",
    callback: ((event, target) => {
      console.log("[ElementZapper:CTX] target:", target);
      console.log("[ElementZapper:CTX] info:", elementPicker.hoverInfo);
      unlockScreenIfLocked(target);
      target.remove();
      if (!event.shiftKey) {
        elementPicker.enabled = false;
      }
    })
  }

  // credits to https://github.com/gorhill/uBlock/blob/master/src/js/scriptlets/epicker.js
  // zapElementAtPoint() function
  function unlockScreenIfLocked(elemToRemove) {
    const getStyleValue = (elem, prop) => {
      const style = window.getComputedStyle(elem);
      return style ? style[prop] : '';
    };

    // Heuristic to detect scroll-locking: remove such lock when detected.
    let maybeScrollLocked = elemToRemove.shadowRoot instanceof DocumentFragment;
    if (maybeScrollLocked === false) {
      let elem = elemToRemove;
      do {
        maybeScrollLocked =
          parseInt(getStyleValue(elem, 'zIndex'), 10) >= 1000 ||
          getStyleValue(elem, 'position') === 'fixed';
        elem = elem.parentElement;
      } while (elem !== null && maybeScrollLocked === false);
    }
    if (maybeScrollLocked) {
      const doc = document;
      if (getStyleValue(doc.body, 'overflowY') === 'hidden') {
        doc.body.style.setProperty('overflow', 'auto', 'important');
      }
      if (getStyleValue(doc.body, 'position') === 'fixed') {
        doc.body.style.setProperty('position', 'initial', 'important');
      }
      if (getStyleValue(doc.documentElement, 'position') === 'fixed') {
        doc.documentElement.style.setProperty('position', 'initial', 'important');
      }
      if (getStyleValue(doc.documentElement, 'overflowY') === 'hidden') {
        doc.documentElement.style.setProperty('overflow', 'auto', 'important');
      }
    }
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[ElementZapper:CTX]", msg);
    const { event, data } = msg;

    if (event === "enablePicker") {
      elementPicker.enabled = true;
    }
  });

  // close picker when pressing ESC
  window.addEventListener('keyup', function(e) {
    if (e.keyCode == 27) {
      elementPicker.enabled = false;
      console.log("[ElementZapper:CTX] user aborted");
    }
  });

})();
