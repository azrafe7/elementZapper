chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleContentMessage(msg).then(sendResponse);
  return true;
});

async function handleContentMessage(msg) {
  switch (msg.type) {
    case "ZAP_START":
      window.elementZapper.start();
      return EZMessaging.makeResponse(true, {}, msg.requestId);

    case "ZAP_STOP":
      window.elementZapper.stop();
      return EZMessaging.makeResponse(true, {}, msg.requestId);

    default:
      return EZMessaging.makeResponse(false, {}, msg.requestId, "Unknown content message");
  }
}
