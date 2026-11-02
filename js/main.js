(function (AA) {
const { $, on } = AA.util;
const { Store, WebGLEngine, ClockController, UIManager } = AA;
function initPWA() {
  const metaCap = document.createElement('meta'); metaCap.name = 'apple-mobile-web-app-capable'; metaCap.content = 'yes';
  const metaStatus = document.createElement('meta'); metaStatus.name = 'apple-mobile-web-app-status-bar-style'; metaStatus.content = 'black-translucent';
  document.head.append(metaCap, metaStatus);
  const cvs = document.createElement('canvas'); cvs.width = 512; cvs.height = 512;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.roundRect(0, 0, 512, 512, 112); ctx.fill();
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#371e78'); grad.addColorStop(1, '#0a82a8');
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(256, 256, 160, 0, Math.PI * 2); ctx.fill();
  const iconUrl = cvs.toDataURL('image/png');
  const appleIcon = document.createElement('link'); appleIcon.rel = 'apple-touch-icon'; appleIcon.href = iconUrl;
  document.head.appendChild(appleIcon);
  const manifest = { name: "Ambient Aurora", short_name: "Aurora", start_url: location.href, display: "standalone", background_color: "#000000", theme_color: "#000000", icons: [{ src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" }] };
  const manifestLink = document.createElement('link'); manifestLink.rel = 'manifest';
  manifestLink.href = 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifest));
  document.head.appendChild(manifestLink);
  const swCode = `self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());self.addEventListener('fetch',e=>{});`;
  const swBlob = new Blob([swCode], {type: 'application/javascript'});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(()=>{});
}
initPWA();
const defaultState = { lang: 'en', mode: 1, colorTarget: [0.21, 0.11, 0.47], size: 15, weight: 200, speed: 1, bgBrightness: 1, vignette: 1, dimOnIdle: true, is24Hour: true, leadingZero: true, showSeconds: false, showDate: true, showY: false, showM: true, showD: true, showW: true, clockAnimMode: 0, clockLayout: 0, fontStyle: 0, lowPower: false, idleTimeout: 0, pixelShift: true, nightMode: false, textColor: '#ffffff', ampmColor: '#b3b3b3', dateColor: '#b3b3b3', customTextColor: '#b3b3b3', material: 0, showCustomText: false, customText: "Ambient Aurora", anchor: 4, offsetX: 0, offsetY: 0, clockOpacity: 1, datePosition: 0, renderScale: 0, showFps: false, showScale: false, showSliderVal: false, isIdle: false, isHolding: false, isPanelOpen: false };
const store = new Store(defaultState);
const glEngine = new WebGLEngine($('gl-canvas'), store);
const clockController = new ClockController($('clock-layer'), store,$('settings-panel'));
const uiManager = new UIManager(store);
uiManager.init();
glEngine.start();
clockController.start();
on(document, 'visibilitychange', () => {
  if (document.hidden) {
    uiManager.releaseWakeLock();
    uiManager.stopGlassLoop();
    glEngine.pause();
    clockController.pause();
    store.flush();
  } else {
    uiManager.requestWakeLock();
    uiManager.startGlassLoop();
    glEngine.resume();
    clockController.resume();
  }
});
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.body.classList.remove('no-transitions');
  clockController.updateEvasion();
}));
})(window.AA);
