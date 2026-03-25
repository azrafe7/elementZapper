importScripts("../shared/log.js");
importScripts("../shared/messaging.js");
importScripts("../shared/send.js");

let zapCount = 0;

// Load rules on startup
let rules = [];
chrome.storage.local.get(["zapRules"], (res) => {
  rules = res.zapRules || [];
  EZLog.bg("Loaded rules:", rules);
});

function saveRules() {
  chrome.storage.local.set({ zapRules: rules });
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

    case "ZAP_ADD_RULE":
      const selector = msg.payload?.selector;
      if (selector && !rules.includes(selector)) {
        rules.push(selector);
        saveRules();
        EZLog.bg("Rule added:", selector);
      }
      return EZMessaging.makeResponse(true, { rules }, msg.requestId);

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
