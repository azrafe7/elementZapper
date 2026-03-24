self.EZSend = {
  sendToBackground(msg) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(msg, res => resolve(res));
    });
  },

  sendToTab(tabId, msg) {
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, msg, res => resolve(res));
    });
  }
};
