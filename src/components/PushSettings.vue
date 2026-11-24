<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppButton from './ui/AppButton.vue';
const props = defineProps({ accountId: Number, enabled: Boolean, profile: Boolean });
const emit = defineEmits(['occupied']);
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
watch([loading, busy, onboarding], () => emit('occupied', loading.value || busy.value || onboarding.value), { immediate: true });
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
let mounted = true;
onBeforeUnmount(() => { mounted = false; });
let preparation;
async function prepare() {
  loading.value = true;
  try {
    await navigator.serviceWorker.register('/sw.js');
    registration = await navigator.serviceWorker.ready;
    const config = await request('GET');
    const subscription = await registration.pushManager.getSubscription();
    publicKey = config.publicKey;
    active.value = Boolean(subscription && config.endpoints.includes(subscription.endpoint));
    if (mounted && active.value) {
      onboarding.value = false;
      try { localStorage.setItem(promptKey, 'active'); } catch {}
    }
    return true;
  } catch {
    problem.value = 'Push konnte nicht vorbereitet werden. Versuch es erneut.';
    return false;
  } finally { loading.value = false; }
}
onMounted(() => {
  if (!supported || (ios && !installed)) { loading.value = false; return; }
  let previous;
  try { previous = localStorage.getItem(promptKey); } catch {}
  preparation = prepare();
  if (!props.enabled || permission.value === 'denied') return;
  if (!previous || (previous === 'active' && permission.value === 'granted')) {
    onboarding.value = !previous && permission.value !== 'granted';
    if (!ios || permission.value === 'granted') enable(true);
  }
});
async function enable(automatic = false) {
  if (busy.value) return;
  busy.value = true;
  problem.value = '';
  try {
    // Invoke before any await to preserve the activation button's user gesture.
    if (Notification.permission !== 'granted') await Notification.requestPermission();
    permission.value = Notification.permission;
    if (permission.value !== 'granted') {
      if (permission.value === 'denied') dismiss();
      return;
    }
    if (!mounted) return;
    if (!automatic && !loading.value && !publicKey) preparation = prepare();
    if (!(await preparation) || !mounted || active.value) return;
    const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    if (!mounted) return;
    await request('POST', subscription.toJSON());
    active.value = true;
    onboarding.value = false;
    try { localStorage.setItem(promptKey, 'active'); } catch {}
  } catch {
    if (!automatic || Notification.permission === 'granted') problem.value = 'Push konnte nicht aktiviert werden. Versuch es erneut.';
  }
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
    dismiss();
  } catch { problem.value = 'Push konnte nicht deaktiviert werden. Versuch es erneut.'; }
  finally { busy.value = false; }
}
</script>
<template>
  <Teleport defer :to="profile ? '#device-push-settings' : 'body'">
    <section v-if="profile || onboarding" :class="profile ? 'my-4' : 'fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-[540px] rounded-xl border border-line bg-panel p-4 text-ink shadow-lg'" aria-label="Push auf diesem Gerät">
      <h2 v-if="onboarding && !profile" class="mb-2 text-[17px] font-bold">Benachrichtigungen aktivieren</h2>
      <p class="text-[13px] leading-[1.4] text-muted" role="status">{{ message }}</p>
      <p v-if="problem" class="text-sm text-danger" role="alert">{{ problem }}</p>
      <AppButton v-if="supported && (!ios || installed) && permission !== 'denied'" variant="soft" type="button"
        :disabled="busy || (profile && loading && !onboarding)" @click="active ? disable() : enable()">
        {{ busy ? 'Bitte warten…' : active ? 'Push auf diesem Gerät deaktivieren' : 'Push auf diesem Gerät aktivieren' }}
      </AppButton>
      <AppButton v-if="onboarding" variant="plain" type="button" :disabled="busy" @click="dismiss">Später</AppButton>
    </section>
  </Teleport>
</template>
