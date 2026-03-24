importScripts("../shared/log.js");
importScripts("../shared/messaging.js");
importScripts("../shared/send.js");

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
