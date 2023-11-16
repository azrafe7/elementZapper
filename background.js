"use strict";

let manifest = chrome.runtime.getManifest();
console.log(manifest.name + " v" + manifest.version);

const storage = chrome.storage.local;

// add contextMenu entry to action button
function createContextMenu() {
  chrome.contextMenus.removeAll(function() {
    chrome.contextMenus.create({
      id: "ElementZapper_clearStorage",
      title: "Reset storage...",
      contexts: ["action"],
    });
    chrome.contextMenus.create({
      id: "ElementZapper_logStorage",
      title: "Log storage...",
      contexts: ["action"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log("[ElementZapper:BG] onContextMenuClicked:", [info, tab]);

  if (info.menuItemId === "ElementZapper_clearStorage") {
    await storage.clear();
    console.log("[ElementZapper:BG] reset storage...");
  } else if (info.menuItemId === "ElementZapper_logStorage") {
    const items = await storage.get(null);
    console.log("[ElementZapper:BG] log storage...", items);
  }
});

// enable picker when clicking the browser action
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[ElementZapper:BG] enablePicker");
  chrome.tabs.sendMessage(
    tab.id,
    {
      event: "enablePicker",
      data: null,
    }
  );
});

chrome.action.setBadgeBackgroundColor({
  color: [50,40,40,200]
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
      }
    );
  } else if (event === 'setBadge') {
    const text = data;
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: text
    });
  }
});