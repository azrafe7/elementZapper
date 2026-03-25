self.EZSend = {
  sendToBackground(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, res => {
        const err = chrome.runtime.lastError;
        if (err) {
          EZLog.error("sendToBackground failed:", err.message);
          reject(new Error(err.message));
        } else {
          resolve(res);
        }
      });
    });
  },

  sendToTab(tabId, msg) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, msg, res => {
        const err = chrome.runtime.lastError;
        if (err) {
          EZLog.error("sendToTab failed (tab", tabId, "):", err.message);
          reject(new Error(err.message));
        } else {
          resolve(res);
        }
      });
    });
  }
};