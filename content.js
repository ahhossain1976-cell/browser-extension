// Draco Cord V8 content script
(() => {
  const scriptId = 'draco-cord-script';
  if (document.getElementById(scriptId)) return;

  const script = document.createElement('script');
  script.id = scriptId;
  script.src = chrome.runtime.getURL('injector.js');
  script.async = false;
  (document.head || document.documentElement).appendChild(script);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;

    if (message.type === 'updateDSP') {
      window.postMessage({ type: 'draco-cord-state', state: message.state }, '*');
      return true;
    }

    if (message.type === 'getAnalyzerData') {
      sendResponse({ ok: true, message: 'Analyzer ready' });
      return true;
    }
  });
})();
