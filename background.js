console.log('Draco Cord V8 background service started');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'updateDSP') {
    chrome.storage.local.set({ dracoCordSettings: message.state }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message && message.type === 'getSettings') {
    chrome.storage.local.get(['dracoCordSettings'], (result) => {
      sendResponse(result.dracoCordSettings || null);
    });
    return true;
  }

  return false;
});
