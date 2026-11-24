<script setup>
import { computed, onMounted, ref } from 'vue';
import AppButton from './ui/AppButton.vue';
const props = defineProps({ accountId: Number, enabled: Boolean, profile: Boolean });
const onboarding = ref(false);
const promptKey = `lago-push-prompt:${props.accountId}`;
function dismiss() {
  onboarding.value = false;
  try { localStorage.setItem(promptKey, 'seen'); } catch {}
}
const loading = ref(true);
const busy = ref(false);
const active = ref(false);
const problem = ref('');
const permission = ref(typeof Notification === 'undefined' ? 'default' : Notification.permission);
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const supported = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let registration;
let publicKey;
const message = computed(() => {
  if (ios && !installed) return 'Auf dem iPhone oder iPad: In Safari «Teilen» → «Zum Home-Bildschirm» wählen und Lago von dort öffnen (iOS 16.4 oder neuer).';
  if (!supported) return 'Dieser Browser unterstützt Push hier nicht. Öffne Lago über HTTPS in einem unterstützten Browser.';
  if (permission.value === 'denied') return 'Benachrichtigungen sind blockiert. Erlaube sie in den Geräte- oder Browsereinstellungen und öffne Lago erneut.';
  if (active.value) return 'Dieses Gerät erhält neue Einladungen, Terminänderungen und Absagen, wenn deine gespeicherte Push-Einstellung eingeschaltet ist.';
  return 'Aktiviere Benachrichtigungen für dieses Gerät. Danach fragt dich dein Gerät um Erlaubnis.';
});
async function request(method, body) {
  const response = await fetch('/api/push', { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
}
onMounted(async () => {
  if (!supported || (ios && !installed)) { loading.value = false; return; }
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    registration = await navigator.serviceWorker.ready;
    const config = await request('GET');
    publicKey = config.publicKey;
    const subscription = await registration.pushManager.getSubscription();
    active.value = Boolean(subscription && config.endpoints.includes(subscription.endpoint));
    let seen = false;
    try { seen = localStorage.getItem(promptKey) === 'seen'; } catch {}
    if (props.enabled && !active.value && !seen && permission.value !== 'denied') {
      onboarding.value = true;
      // Safari requires a direct user gesture; show the activation control on iOS.
      if (!ios || permission.value === 'granted') await enable();
    }
  } catch { problem.value = 'Push konnte nicht vorbereitet werden. Lade die Seite erneut.'; }
  finally { loading.value = false; }
});
async function enable() {
  // Keep the system prompt directly inside the user's click gesture on iOS.
  busy.value = true;
  problem.value = '';
  try {
    // Invoke before any await to preserve the activation button's user gesture.
    permission.value = await Notification.requestPermission();
    if (permission.value !== 'granted') {
      if (permission.value === 'denied') dismiss();
      return;
    }
    const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    await request('POST', subscription.toJSON());
    active.value = true;
    dismiss();
  } catch { problem.value = 'Push konnte nicht aktiviert werden. Versuch es erneut.'; }
  finally { busy.value = false; }
}
async function disable() {
  busy.value = true;
  problem.value = '';
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await request('DELETE', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    active.value = false;
  } catch { problem.value = 'Push konnte nicht deaktiviert werden. Versuch es erneut.'; }
  finally { busy.value = false; }
}
</script>
<template>
  <section v-if="profile || onboarding" class="mt-4 mb-4" aria-label="Push auf diesem Gerät">
    <h2 v-if="onboarding && !profile" class="mb-2 text-[17px] font-bold">Benachrichtigungen aktivieren</h2>
    <p class="text-[13px] leading-[1.4] text-muted" role="status">{{ message }}</p>
    <p v-if="problem" class="text-sm text-danger" role="alert">{{ problem }}</p>
    <AppButton v-if="supported && (!ios || installed) && permission !== 'denied'" variant="soft" type="button"
      :disabled="loading || busy || !publicKey" @click="active ? disable() : enable()">
      {{ loading ? 'Push wird vorbereitet…' : active ? 'Push auf diesem Gerät deaktivieren' : 'Push auf diesem Gerät aktivieren' }}
    </AppButton>
    <AppButton v-if="onboarding" variant="plain" type="button" @click="dismiss">Später</AppButton>
  </section>
</template>
