EZLog.popup("Popup loaded");

document.getElementById("start").addEventListener("click", async () => {
  EZLog.popup("Start zap requested");
  const msg = EZMessaging.makeMessage("ZAP_START", {}, "popup");
  await EZSend.sendToBackground(msg);
});

document.getElementById("stop").addEventListener("click", async () => {
  EZLog.popup("Stop zap requested");
  const msg = EZMessaging.makeMessage("ZAP_STOP", {}, "popup");
  await EZSend.sendToBackground(msg);
});
