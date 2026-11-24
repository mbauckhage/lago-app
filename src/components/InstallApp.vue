<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { dismissalKey, installed, installPrompt, invitationDue, platformInfo, readHistory } from '../install.js';
import AppButton from './ui/AppButton.vue';
import Icon from '../Icon.vue';
const props = defineProps({ eligible: Boolean });
const dialog = ref(null);
const guide = ref(false);
const pending = ref(false);
const problem = ref('');
const platform = platformInfo();
const nativeAvailable = computed(() => !!installPrompt.value && !platform.embedded && !installed.value);
const title = computed(() => installed.value ? 'Lago ist bereits installiert' : guide.value ? 'So geht’s' : 'Jetzt als App');
let history = readHistory();
let automatic = false;
let offered = false;
let trigger;
let timer;
let lastInteraction = Date.now();
const icon = document.querySelector('link[rel="apple-touch-icon"]')?.href || '/lago-192.png';
function saveDismissal() {
  if (!automatic) return;
  automatic = false;
  history = { count: history.count + 1, at: Date.now() };
  try { localStorage.setItem(dismissalKey, JSON.stringify(history)); } catch { /* Keep session history. */ }
}
function close(count = true) {
  if (!dialog.value?.open) return;
  if (count) saveDismissal();
  else automatic = false;
  dialog.value.close();
}
function restoreFocus() {
  if (trigger?.isConnected) trigger.focus();
  else document.querySelector('[data-install-focus]')?.focus();
}
async function open(fromAutomatic = false) {
  if (dialog.value?.open) return;
  trigger = fromAutomatic ? document.querySelector('[data-install-focus]') : document.activeElement;
  automatic = fromAutomatic;
  guide.value = false;
  problem.value = '';
  await nextTick();
  dialog.value.showModal();
}
defineExpose({ open: () => open(false) });
async function install() {
  const prompt = installPrompt.value;
  if (!nativeAvailable.value) { guide.value = true; return; }
  pending.value = true;
  try {
    // Invoke synchronously from the click to preserve browser user activation.
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (installPrompt.value === prompt) installPrompt.value = null;
    if (choice.outcome === 'dismissed') close();
    else close(false);
  } catch {
    installPrompt.value = null;
    guide.value = true;
    problem.value = 'Die Installation konnte nicht geöffnet werden. Folge dieser Anleitung.';
  } finally { pending.value = false; }
}
function interaction() { lastInteraction = Date.now(); }
function checkIdle() {
  if (!props.eligible) { lastInteraction = Date.now(); return; }
  if (offered || installed.value || platform.embedded || !platform.mobile || !invitationDue(history)) return;
  if (document.visibilityState !== 'visible' || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
    lastInteraction = Date.now(); return;
  }
  if (Date.now() - lastInteraction < 8000) return;
  offered = true;
  open(true);
}
watch(() => props.eligible, () => { lastInteraction = Date.now(); });
watch(installed, value => { if (value) close(false); });
onMounted(() => {
  for (const event of ['pointerdown', 'keydown', 'scroll', 'touchstart']) document.addEventListener(event, interaction, { capture: true, passive: true });
  timer = setInterval(checkIdle, 1000);
});
onUnmounted(() => {
  clearInterval(timer);
  for (const event of ['pointerdown', 'keydown', 'scroll', 'touchstart']) document.removeEventListener(event, interaction, true);
});
</script>

<template>
  <dialog ref="dialog" aria-labelledby="install-title" aria-describedby="install-description"
    class="install-dialog m-auto max-h-[90dvh] w-[min(calc(100%-32px),440px)] max-w-none overflow-y-auto overscroll-contain rounded-[23px] border-0 bg-surface px-6 pt-6 pb-6 text-ink shadow-[0_12px_36px_#0006] backdrop:bg-[#0009] max-[600px]:inset-x-0 max-[600px]:top-auto max-[600px]:bottom-0 max-[600px]:m-0 max-[600px]:w-full max-[600px]:rounded-b-none max-[600px]:pb-[max(24px,env(safe-area-inset-bottom))]"
    @cancel.prevent="close()" @close="restoreFocus" @click="event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }">
    <div aria-hidden="true" class="mx-auto -mt-3 mb-5 h-1 w-9 rounded-full bg-muted/40 min-[601px]:hidden"></div>
    <AppButton variant="icon" aria-label="Schliessen" class="absolute top-3 right-3" @click="close()"><Icon name="close" /></AppButton>
    <img :src="icon" alt="" width="72" height="72" class="mx-auto mt-3 mb-5 size-[72px] rounded-2xl">
    <h2 id="install-title" class="mb-2 text-center text-[25px] font-bold tracking-[-.03em]">{{ title }}</h2>
    <p v-if="installed" id="install-description" class="mb-6 text-center text-sm text-muted">Öffne Lago jederzeit über dein Home-Screen-Symbol.</p>
    <template v-else-if="!guide">
      <p id="install-description" class="mt-0 mb-6 text-center text-sm text-muted">Deine Lago-Pläne mit einem Tippen öffnen.</p>
      <div class="grid gap-2">
        <AppButton :disabled="pending" @click="install">{{ nativeAvailable ? 'Zum Startbildschirm hinzufügen' : 'So geht’s' }}</AppButton>
        <AppButton variant="plain" @click="close()">Später</AppButton>
      </div>
    </template>
    <template v-else>
      <p v-if="problem" role="alert" class="text-sm text-danger">{{ problem }}</p>
      <p v-if="platform.embedded" class="mb-5 text-sm leading-relaxed text-muted">Öffne zuerst das Menü dieses eingebetteten Browsers und wähle <strong class="text-ink">{{ platform.ios ? 'In Safari öffnen' : 'In Chrome öffnen' }}</strong>. Falls diese Option fehlt, kopiere den Link und öffne ihn in {{ platform.ios ? 'Safari' : 'Chrome' }}.</p>
      <p id="install-description" class="mt-0 mb-5 text-sm text-muted">{{ platform.mobile ? (platform.ios ? 'Auf deinem iPhone oder iPad:' : 'Auf deinem Android-Gerät:') : 'Öffne Lago auf deinem iPhone oder iPad in Safari oder auf Android in Chrome. Dort kannst du die App zum Home-Bildschirm hinzufügen.' }}</p>
      <ol v-if="platform.mobile" class="my-5 grid list-none gap-5 p-0">
        <li class="flex items-start gap-3"><Icon :name="platform.ios ? 'share' : 'menu'" class="mt-0.5 text-brand" /><span class="text-sm leading-relaxed">Öffne <strong>{{ platform.ios ? 'Teilen' : 'Browsermenü' }}</strong>.<small class="block text-muted">{{ platform.ios ? 'Das Quadrat mit dem Pfeil nach oben.' : 'Die drei Punkte im Browser.' }}</small></span></li>
        <li class="flex items-start gap-3"><Icon name="plus" class="mt-0.5 text-brand" /><span class="text-sm leading-relaxed">Wähle <strong>{{ platform.ios ? 'Zum Home-Bildschirm' : 'App installieren' }}</strong><template v-if="!platform.ios"> oder <strong>Zum Startbildschirm hinzufügen</strong></template>.<small v-if="platform.ios" class="block text-muted">Scrolle bei Bedarf in der Liste nach unten.</small></span></li>
        <li class="flex items-start gap-3"><Icon name="check" class="mt-0.5 text-brand" /><span class="text-sm leading-relaxed"><template v-if="platform.ios">Tippe auf <strong>Hinzufügen</strong>.</template><template v-else>Bestätige die Installation.</template></span></li>
      </ol>
      <p v-if="platform.mobile" class="mb-6 text-sm leading-relaxed text-muted">Öffne Lago anschliessend über das neue Symbol auf deinem Home-Bildschirm.</p>
    </template>
    <AppButton v-if="guide || installed" class="w-full" @click="close()">Verstanden</AppButton>
  </dialog>
</template>
