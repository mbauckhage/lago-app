import { ref, shallowRef } from 'vue';

export const installPrompt = shallowRef(null);
let confirmed = false;
try { confirmed = localStorage.getItem('lago.installed') === '1'; } catch {}
export const installed = ref(isStandalone() || confirmed);
export function isStandalone() {
  return Boolean(window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone);
}
export function platformInfo(nav = navigator) {
  const ua = nav.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const embedded = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|TikTok|Snapchat|LinkedInApp|; wv\)|\bwv\b/i.test(ua)
    || (ios && /AppleWebKit/.test(ua) && !/Safari|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua));
  return { ios, android, embedded, mobile: ios || android };
}
export const dismissalKey = 'lago.install-dismissals';
export function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(dismissalKey));
    if (Number.isFinite(value?.count) && Number.isFinite(value?.at)) return value;
  } catch { /* Storage is optional. */ }
  return { count: 0, at: 0 };
}
export function invitationDue(history, now = Date.now()) {
  return history.count < 2 && (!history.count || now - history.at >= 30 * 86400000);
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt.value = event;
});
window.addEventListener('appinstalled', () => {
  installed.value = true;
  try { localStorage.setItem('lago.installed', '1'); } catch {}
  installPrompt.value = null;
});
window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
  if (isStandalone()) installed.value = true;
});
