importScripts("../shared/log.js");
importScripts("../shared/messaging.js");
importScripts("../shared/send.js");

let zapCount = 0;

// Load rules on startup
let rulesByHost = {};

chrome.storage.local.get(["zapRulesByHost"], (res) => {
  rulesByHost = res.zapRulesByHost || {};
  EZLog.bg("Loaded rulesByHost:", rulesByHost);
});

function saveRules() {
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

    case "ZAP_INCREMENT":
      zapCount += msg.payload?.delta || 1;
      chrome.action.setBadgeText({ text: String(zapCount) });
      return EZMessaging.makeResponse(true, { count: zapCount }, msg.requestId);

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

      if (!rulesByHost[host]) rulesByHost[host] = [];
      if (!rulesByHost[host].includes(selector)) {
        rulesByHost[host].push(selector);
        saveRules();
        EZLog.bg("Rule added:", host, selector);
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
