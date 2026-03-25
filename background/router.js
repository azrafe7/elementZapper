importScripts("../shared/log.js");
importScripts("../shared/messaging.js");
importScripts("../shared/send.js");

function loadRules() {
  return new Promise(resolve => {
    chrome.storage.local.get(["zapRulesByHost"], res => {
      resolve(res.zapRulesByHost || {});
    });
  });
}

function saveRules(rulesByHost) {
  chrome.storage.local.set({ zapRulesByHost: rulesByHost });
}

function clearAllStorage() {
  chrome.storage.local.clear(() => {
    EZLog.bg("All extension storage cleared");
  });
}

chrome.action.setBadgeBackgroundColor({ color: "#ff4d4d" });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  EZLog.bg("Received message:", msg);
  handleMessage(msg, sender).then(res => {
    EZLog.bg("Sending response:", res);
    sendResponse(res);
  });
  return true;
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case "ZAP_START":
    case "ZAP_STOP":
      return forwardToActiveTab(msg);

    case "ZAP_ADD_RULE": {
      const selector = msg.payload?.selector;
      const url = sender?.tab?.url || "";
      let host = "";

      try {
        host = new URL(url).host;
      } catch {}

      if (!selector || !host) {
        return EZMessaging.makeResponse(false, {}, msg.requestId, "Missing selector or host");
      }

      // Always reload fresh rules from storage
      const rulesByHost = await loadRules();

      if (!rulesByHost[host]) rulesByHost[host] = [];
      if (!rulesByHost[host].find(r => r.selector === selector)) {
        rulesByHost[host].push({
          selector,
          action: msg.payload?.action || "hide",
          persistent: msg.payload?.persistent !== false
        });
        saveRules(rulesByHost);
        EZLog.bg("Rule added:", host, selector, "action:", msg.payload?.action, "persistent:", msg.payload?.persistent);
      }

      const total = rulesByHost[host].length;
      return EZMessaging.makeResponse(true, { host, total }, msg.requestId);
    }

    case "ZAP_SET_BADGE": {
      const applied = msg.payload?.applied ?? 0;
      const total = msg.payload?.total ?? 0;
      const text = total > 0 ? `${applied}/${total}` : "";
      chrome.action.setBadgeBackgroundColor({ color: "#ff4d4d" });
      chrome.action.setBadgeText({ text });
      return EZMessaging.makeResponse(true, { applied, total }, msg.requestId);
    }

    case "ZAP_CLEAR_STORAGE": {
      chrome.storage.local.clear(() => {
        EZLog.bg("Storage cleared via ZAP_CLEAR_STORAGE");
        chrome.action.setBadgeText({ text: "" });
      });
      return EZMessaging.makeResponse(true, {}, msg.requestId);
    }

    case "PING":
      return EZMessaging.makeResponse(true, { pong: true }, msg.requestId);

    default:
      return EZMessaging.makeResponse(false, {}, msg.requestId, "Unknown message type");
  }
}

async function forwardToActiveTab(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return EZMessaging.makeResponse(false, {}, msg.requestId, "No active tab");
  }

  const res = await EZSend.sendToTab(tab.id, msg);
  return EZMessaging.makeResponse(true, res?.payload, msg.requestId);
}
