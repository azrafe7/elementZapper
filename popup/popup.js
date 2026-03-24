document.getElementById("start").addEventListener("click", async () => {
  const msg = EZMessaging.makeMessage("ZAP_START", {}, "popup");
  await EZSend.sendToBackground(msg);
});

document.getElementById("stop").addEventListener("click", async () => {
  const msg = EZMessaging.makeMessage("ZAP_STOP", {}, "popup");
  await EZSend.sendToBackground(msg);
});
