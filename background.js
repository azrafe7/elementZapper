"use strict";

let manifest = chrome.runtime.getManifest();
console.log(manifest.name + " v" + manifest.version);


// enable picker when clicking the browser action
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[ElementZapper:BG] enablePicker");
  chrome.tabs.sendMessage(
    tab.id,
    {
      event: "enablePicker",
      data: null,
    },
    (response) => {
      let lastError = chrome.runtime.lastError;
      if (lastError) {
        console.warn('Whoops...', lastError.message);
      }
    }
  );
});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  const { event, data } = msg;
  console.log(msg, sender, sendResponse);
  console.log(sender.tab.id);
  if (event === 'requestUnlock') {
    console.log('send unlock');
    chrome.tabs.sendMessage(
      sender.tab.id,
      {
        event: "unlock",
        data: null,
      },
      (response) => {
        let lastError = chrome.runtime.lastError;
        if (lastError) {
          console.warn('Whoops...', lastError.message);
        }
      }
    );
  }
});