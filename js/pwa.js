const installButton = document.getElementById("pwa-install-button");
const installDialog = document.getElementById("pwa-help-dialog");
const installSteps = document.getElementById("pwa-install-steps");
let deferredInstallPrompt = null;

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function syncInstallButton() {
  if (!installButton) return;
  installButton.hidden = isInstalled();
}

function instructionsForDevice() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return [
      "Open this page in Safari.",
      "Tap the Share button in the browser toolbar.",
      "Choose “Add to Home Screen”, then tap “Add”."
    ];
  }
  if (/Android/i.test(ua)) {
    return [
      "Open the browser menu (⋮) in Chrome.",
      "Tap “Install app” or “Add to Home screen”.",
      "Confirm to add StudyTrack to your phone."
    ];
  }
  if (/Macintosh|Mac OS X/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) {
    return [
      "In Safari, open the File menu.",
      "Choose “Add to Dock”.",
      "Open StudyTrack any time from your Dock."
    ];
  }
  return [
    "In Chrome or Edge, select the install icon in the address bar, or open the browser menu (⋮).",
    "Choose “Install StudyTrack” or “Install this site as an app”.",
    "Confirm the prompt; StudyTrack will appear in your apps."
  ];
}

function showInstallHelp() {
  if (!installDialog || !installSteps) return;
  installSteps.replaceChildren(...instructionsForDevice().map(text => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  if (!installDialog.open) installDialog.showModal();
}

installButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showInstallHelp();
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (choice.outcome === "accepted") syncInstallButton();
});

installDialog?.addEventListener("click", event => {
  if (event.target === installDialog || event.target.closest("[data-pwa-close]")) installDialog.close();
});

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  syncInstallButton();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  syncInstallButton();
});

window.matchMedia("(display-mode: standalone)").addEventListener?.("change", syncInstallButton);
syncInstallButton();

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation stays available through the browser menu if offline caching is unavailable.
    });
  }, { once: true });
}
