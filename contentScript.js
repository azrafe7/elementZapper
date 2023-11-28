"use strict";

(async () => {

  const DEBUG = true;
  let debug = {
    log: DEBUG ? console.log.bind(console) : () => {} // log or NO_OP
  }

  let manifest = chrome.runtime.getManifest();
  console.log(manifest.name + " v" + manifest.version);

  const storage = chrome.storage.local;

  const HIGHLIGHT_RED = "rgba(250, 70, 60, 0.5)";
  const HIGHLIGHT_GREEN = "rgba(17, 193, 12, 0.5)";
  const HIGHLIGHT_BG_COLOR = HIGHLIGHT_RED;

  const OUTLINE_RED = "rgba(250, 70, 60, 0.75)";
  const OUTLINE_GREEN = "rgba(17, 193, 12, 0.90)";
  const OUTLINE_COLOR = OUTLINE_RED;

  const CURSORS = ["crosshair", "copy"];

  /* if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // dark mode
    HIGHLIGHT_BG_COLOR = HIGHLIGHT_DARK;
    OUTLINE_COLOR = OUTLINE_DARK;
  } */

  let options = {
    container: null,
    iFrameId: 'Element Zapper Picker Frame',
    enabled: false,
    selectors: "*",
    background: HIGHLIGHT_BG_COLOR,
    borderWidth: 0,
    outlineWidth: 1,
    outlineColor: OUTLINE_COLOR,
    transition: "",
    ignoreElements: [],
    action: {},
    hoverBoxInfoId: 'zapper_picker_info',
  }

  // create "disabled" elementPicker on page load
  let elementPicker = new ElementPicker(options);
  let [pickerPanelContainer, pickerPanelElement] = await addPickerPanelTo(elementPicker.container);
  // let [pickerPanelContainer, pickerPanelElement] = await addPickerPanelTo(document.body);
  console.log(pickerPanelContainer);
  
  let undoZapElementStack = [];
  let redoZapElementStack = [];
  
  let doZap = (element, remember=true) => {
    const compactSelector = elemToSelector(element, {compact:true, fullPath:false}); // compute selector before adding placeholder
    debug.log('do', element, remember);
    unlockScreenIfLocked(element);
    let placeholder = _insertPlaceholderForElement(element);
    element.style.setProperty('display', 'none', 'important');
    // element?.remove();

    if (remember) {
      const currentUrl = window.location.href;
      let urlTable = {};
      storage.get({urlTable: {}}, (item) => {
        urlTable = item.urlTable;
        let selectors = urlTable[currentUrl] ?? [];
        if (!(selectors.includes(compactSelector))) {
          selectors.push(compactSelector);   // add and...
          undoZapElementStack.push(element); // store in undo stack
        }
        urlTable[currentUrl] = selectors;
        storage.set({urlTable:urlTable});
        console.log(urlTable);
      });
    }
  }
  
  let undoZap = (element, remember=false) => {
    debug.log('undo', element, remember);
    element.style.display = '';
    let maybePlaceholder = element.parentElement;
    if (maybePlaceholder.matches('.element-zapper-placeholder')) {
      const placeholderParentElement = maybePlaceholder.parentElement;
      placeholderParentElement.insertBefore(element, maybePlaceholder);
      maybePlaceholder.remove();
    }

    if (remember) {
      const currentUrl = window.location.href;
      const compactSelector = elemToSelector(element, {compact:true, fullPath:false});
      let urlTable = {};
      storage.get({urlTable: {}}, (item) => {
        urlTable = item.urlTable;
        let selectors = urlTable[currentUrl] ?? [];
        if ((selectors.includes(compactSelector))) {
          selectors.remove(compactSelector); // remove and...
          redoZapElementStack.push(element); // store in redo stack
        }
        urlTable[currentUrl] = selectors;
        storage.set({urlTable:urlTable});
        console.log(urlTable);
      });
    }
  }
  
  elementPicker.action = {
    trigger: "mouseup",

    callback: ((event, target) => {
      debug.log("[ElementZapper:CTX] event:", event);
      let continuePicking = event.shiftKey;
      let alertSelector = event.ctrlKey;
      event.triggered = event.triggered ?? event.button == 0; // only proceed if left mouse button was pressed or "event.triggered" was set
      const mustIgnore = findAncestor(target, '.element-zapper-placeholder');
      continuePicking = continuePicking || mustIgnore;
      if (event.triggered) {
        debug.log("[ElementZapper:CTX] target:", target);
        debug.log("[ElementZapper:CTX] info:", elementPicker.hoverInfo);
        // window.focus();
        /* chrome.runtime.sendMessage({
          event: "requestUnlock",
          data: null,
        }); */
        if (mustIgnore) {
          debug.log("mustIgnore", target);
        } else {
          if (!alertSelector) {
            doZap(target);
          } else {
            const compactSelector = elemToSelector(target, {compact:true, fullPath:false});
            updatePickerPanel(target, compactSelector);
          }
        }
        debug.log("[ElementZapper:CTX] style:", target?.style, "ignored", mustIgnore);
      }
      
      elementPicker.enabled = continuePicking && event.triggered;
    })
  }

  function findAncestor(el, sel) {
    while (el && !((el.matches || el.matchesSelector).call(el, sel))) {
      el = el.parentElement;
    }
    return el;
  }

  function updatePickerPanel(target, compactSelector) {
    let selectorElement = pickerPanelElement.querySelector("#selector");
    let compactSelectorElement = pickerPanelElement.querySelector("#compactSelector");
    selectorElement.innerHTML = elemToSelector(target, {compact:false, fullPath:true});
    compactSelectorElement.innerHTML = compactSelector ?? elemToSelector(target, {compact:true, fullPath:false});
  }

  async function addPickerPanelTo(container) {
    let response = await fetch(chrome.runtime.getURL('/pickerPanel.html'));

    if (!response.ok) {
      console.error("[ElementZapper:CTX] ERROR", err);
    }

    let text = await response.text();
    
    container.insertAdjacentHTML('beforeend', text);
    let pickerPanelContainer = container.lastElementChild;
    let pickerPanelElement = container.querySelector("#panel");
    const rootNode = container.getRootNode();

    /* dragmove.js
    const dragmoveJsPath = chrome.runtime.getURL('/dragmove.js');
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = dragmoveJsPath;
    rootNode.head.appendChild(script);*/

    // css
    const cssPath = chrome.runtime.getURL('/pickerPanel.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = cssPath;
    rootNode.head.appendChild(link);
    
    dragmove(pickerPanelElement, pickerPanelElement.querySelector(".drag-handle"), 
      (startEvent) => console.log("start", startEvent), 
      (endEvent) => console.log("end", endEvent)
    );
    console.log(pickerPanelContainer, pickerPanelElement.querySelector(".drag-handle"));
    
    return [pickerPanelContainer, pickerPanelElement];
  }

  function getStyleValue(elem, prop) {
    const style = elem ? window.getComputedStyle(elem) : null;
    return style ? style[prop] : '';
  }
  
  function unlockScreen(elem) {
    debug.log('unlock', elem);
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
  
  // credits to https://github.com/gorhill/uBlock/blob/master/src/js/scriptlets/epicker.js
  // zapElementAtPoint() function
  function unlockScreenIfLocked(elemToRemove) {
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
      debug.log('locked', document);
      /* chrome.runtime.sendMessage({
        event: "requestUnlock",
        data: null
      }); */
      unlockScreen(elemToRemove);
    }
  };

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    debug.log("[ElementZapper:CTX]", msg);
    const { event, data } = msg;

    if (event === "enablePicker") {
      const enabled = !elementPicker.enabled;
      elementPicker.enabled = enabled;
      elementPicker.hoverBox.style.cursor = CURSORS[0];
    } else if (event === "unlock") {
      debug.log('unlock');
      unlockScreen();
    } else if (event === "log") {
      debug.log(data);
    }
  });

  const keyEventContainer = window; // elementPicker.iframe ? elementPicker.iframe : window;
  
  // close picker when pressing ESC
  keyEventContainer.addEventListener('keyup', function(e) {
    if (e.code === 'Escape' && elementPicker.enabled) {
      elementPicker.enabled = false;
      debug.log("[ElementZapper:CTX] user aborted");
    }
  }, true);
  
  keyEventContainer.addEventListener('keydown', function(e) {
    let target = null;
    let newTarget = null;
    if (e.code === 'Space' && elementPicker.enabled) {
      target = elementPicker.hoverInfo.element;
      debug.log("[ElementZapper:CTX] space-clicked target:", target);
      e.preventDefault();
      e.triggered = true; // checked inside action callback
      elementPicker.trigger(e);
    } else if (elementPicker.enabled && (e.code === 'KeyQ' || e.code === 'KeyA')) {
      target = elementPicker.hoverInfo.element;

      let innermostTargetAtPoint = null; // first non-picker-iframe element
      for (let el of document.elementsFromPoint(elementPicker._lastClientX, elementPicker._lastClientY)) {
        if (el != elementPicker.iframe) {
          innermostTargetAtPoint = el;
          break;
        }
      }
      // build ancestors array
      let ancestorsAndSelf = [];
      for (let el=innermostTargetAtPoint; el != null; el = el.parentElement) {
        ancestorsAndSelf.push(el);
      }
      
      const ancestorsAndSelfLength = ancestorsAndSelf.length;
      const targetIdx = ancestorsAndSelf.indexOf(target);
      const targetHasNext = targetIdx <= (ancestorsAndSelfLength - 2);
      const targetHasPrev = targetIdx > 0;
      if (e.code === 'KeyQ' && targetHasNext) { // drill up
        newTarget = ancestorsAndSelf[targetIdx + 1];
        if (newTarget.contains(elementPicker.iframe)) {
          newTarget = target;
        }
        debug.log("[ElementZapper:CTX] Q-pressed new ↑ target:", newTarget);
      } else if (e.code === 'KeyA' && targetHasPrev) { // drill down
        newTarget = ancestorsAndSelf[targetIdx - 1];
        if (newTarget.contains(elementPicker.iframe)) {
          newTarget = target;
        }
        debug.log("[ElementZapper:CTX] A-pressed new ↓ target:", newTarget);
      }
      debug.log(`${targetIdx}/${ancestorsAndSelfLength}`, 'newTarget', targetHasPrev, targetHasNext, newTarget);
      if (newTarget && newTarget != target) {
        elementPicker.highlight(newTarget);
        let alertSelector = e.ctrlKey;
        if (alertSelector) updatePickerPanel(newTarget);
      }
      e.preventDefault();
    }
  }, true);

  // change picker cursor when holding SHIFT
  function updateCursor(eventInfo) {
    let {keyUp, event} = eventInfo;
    if (elementPicker.enabled) {
      let cursorIdx = +event.shiftKey;
      if (elementPicker.hoverBox.style.cursor != CURSORS[cursorIdx]) {
        debug.log('[ElementZapper:CTX] change cursor to ' + CURSORS[cursorIdx]);
        elementPicker.hoverBox.style.cursor = CURSORS[cursorIdx];
      }
    }
  }
  keyEventContainer.addEventListener('keyup', (e) => updateCursor({keyUp: true, event: e}), true);
  keyEventContainer.addEventListener('keydown', (e) => updateCursor({keyUp: false, event: e}), true);


  /**
   * elementsReady() reworked from jwilson8767 elementReady() code
   *
   * MIT Licensed
   * Authors: jwilson8767, azrafe7
   *
   */
  function elementsReady(selectors, callback, options={}) {
    const defaults = {once:false, root:document.documentElement, filterFn:(elements) => {return true}};
    options = {...defaults, ...options};
    const root = options.root;
    const filterFn = options.filterFn;
    if (!Array.isArray(selectors)) selectors = [selectors];

    let matchedSelectors = selectors.map(() => false);

    const query = (msg) => {
      console.log(msg);
      for (const [index, selector] of selectors.entries()) {
        const alreadyMatched = matchedSelectors[index];
        if (options.once && alreadyMatched) continue;
        let elements = Array.from(root.querySelectorAll(selector));
        if (elements.length > 0) {
          matchedSelectors[index] = true;
        }
        if (filterFn) {
          elements = elements.filter(filterFn);
        }
        if (elements.length > 0) {
          console.log('index', index);
          callback(elements, selector, index, matchedSelectors);
        }
      }
    }

    query("query from function");
    if (options.once && matchedSelectors.every((matched) => matched)) {
      console.log("ALL");
      return true;
    }
    
    let mutObserver = new MutationObserver((mutationRecords, observer) => {
      query("query from observer");
      if (options.once && matchedSelectors.every((matched) => matched)) {
        console.log("ALL");
        observer.disconnect();
        return true;
      }
    });
    mutObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function setBadge(text) {
    chrome.runtime.sendMessage({
      event: "setBadge",
      data: text,
    });
  }

  // also sets additional styles and adds event listener
  function _insertPlaceholderForElement(element) {
    const elementInfo = elementPicker.getElementInfo(element);
    const isElementSmall = elementInfo.width <= 32 && elementInfo.height <= 32;
    const innerHTML = isElementSmall ? ZAPPED_ELEMENT_HTML_MINI : ZAPPED_ELEMENT_HTML;
    let placeholder = insertPlaceholderForElement(element, innerHTML);
    if (isElementSmall) {
      if (parseInt(placeholder.style.padding) == 0) placeholder.style.setProperty('padding', '2px 2px');
      placeholder.style.setProperty('width', elementInfo.width + 'px');
      placeholder.style.setProperty('text-align', 'center');
    }
    placeholder.appendChild(element);
    placeholder.onclick = (e) => { 
      undoZap(element);
      e.preventDefault();
    };
    
    return placeholder;
  }

  const ZAP_STYLE = `
    color: ${OUTLINE_COLOR};
    display: inline-block;
    -webkit-text-stroke: .5px #fa463c;
  `;
  const ZAPPED_ELEMENT_HTML = 'zapped<span style="' + ZAP_STYLE + '">🗲</span>element';
  const ZAPPED_ELEMENT_HTML_MINI = '<span style="' + ZAP_STYLE + '">🗲</span>';
  
  function insertPlaceholderForElement(element, innerHTML=ZAPPED_ELEMENT_HTML, alt="(click to show zapped element)") {
    const styleKeys = ['display', 'margin', 'padding', 'transform', 'writing-mode'];
    let style = {};
    for (const k of styleKeys) style[k] = getStyleValue(element, k);
    
    let placeholder = document.createElement('div');
    placeholder.classList.add('element-zapper-placeholder');
    for (const k of styleKeys) placeholder.style.setProperty(k, style[k]);
    if (placeholder.style.display === 'inline' || placeholder.style.display === 'block') placeholder.style.setProperty('display', 'inline-block');
    placeholder.style.setProperty('text-align', 'center');
    placeholder.style.setProperty('justify-content', 'center');
    placeholder.style.setProperty('align-items', 'center');
    placeholder.style.setProperty('font-size', '1em');
    placeholder.style.setProperty('font-family', 'monospace', 'important');
    for (const k of ['background']) placeholder.style.setProperty(k, elementPicker.hoverBox.style[k], 'important');
    placeholder.style.setProperty('cursor', 'not-allowed', 'important');
    
    // EXPERIMENTAL CURSORS:
    // const svgEyeCursorURL = chrome.runtime.getURL("/assets/cursors/eye.svg");
    // console.log(svgEyeCursorURL, `url("${svgEyeCursorURL}"), pointer`);
    // placeholder.style.setProperty('cursor', `url("${svgEyeCursorURL}"), pointer`, 'important');
    
    placeholder.innerHTML = innerHTML;
    placeholder.setAttribute('title', alt);
    
    const parentElement = element.parentElement;
    parentElement.insertBefore(placeholder, element.nextSibling);
    
    return placeholder;
  }

  const currentUrl = window.location.href;
  let appliedSelectors = 0;
  let urlTable = {};
  storage.get({urlTable: {}}, (item) => {
    urlTable = item.urlTable;
    let selectors = urlTable[currentUrl] ?? [];
    const numSelectors = selectors.length;
    const numSelectorsStr = numSelectors > 99 ? '99+' : '' + numSelectors;
    // setBadge('0/' + numSelectorsStr);
    // setBadge(numSelectors > 0 ? '.' : '');
    setBadge(numSelectors > 0 ? '0/' + numSelectorsStr : '');
    
    if (numSelectors > 0) {
      
      const callback = async (elements, selector, index, matchedSelectors) => {
        console.log('callback called');
        appliedSelectors = matchedSelectors.filter((matched) => matched).length;
        const appliedSelectorsStr = appliedSelectors > 99 ? '99+' : '' + appliedSelectors;
        //setBadge(appliedSelectorsStr + '/' + numSelectorsStr);
        await chrome.runtime.sendMessage({
          event: "setBadge",
          data: appliedSelectorsStr + '/' + numSelectorsStr,
        });
        
        for (const element of elements) {
          if (element.classList.contains('element-zapper')) continue;
          element.classList.add('element-zapper');
          console.log("Removing " + selector + "...", element);

          unlockScreenIfLocked(element);
          let placeholder = _insertPlaceholderForElement(element);
          element.style.setProperty('display', 'none', 'important');
          // element?.remove();
          
          // element.style.setProperty('outline', '2px solid green', 'important');
          // element.style.setProperty('outline-offset', '-1px', 'important');
          placeholder.style.setProperty('background-color', '#ffaf00', 'important');
          
          /*element.scrollIntoViewIfNeeded();
          elementPicker.highlight(element, true);
          elementPicker.visible = true;*/
          setTimeout(() => {
            // element.style.setProperty('display', 'none', 'important');
            // unlockScreen(element);
            // element.remove();
          }, 0);
        }
        // console.log('selectors ' + numSelectors, selectors);
      }
      
      elementsReady(selectors, callback, {once:true, filterFn: (elem) => !elem.classList.contains('element-zapper')});
    }
  });

})();
