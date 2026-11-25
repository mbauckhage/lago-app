<script setup>
import { memberColor } from '../member-color.js';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import Icon from '../Icon.vue';

const props = defineProps({ event: Object, me: Object, api: Function, detailsOpen: Boolean });
defineEmits(['back', 'details']);
const path = '/events/' + props.event.id + '/chat';
const messages = ref([]);
const history = ref(null);
const draft = ref('');
const error = ref('');
const ready = ref(false);
const more = ref(false);
const sending = ref(false);
const paging = ref(false);
let mounted = true;
let revision = 0;
let readThrough = 0;
let pendingRead = 0;
let attempt;
const time = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
const date = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
const day = msg => date.format(new Date(msg.sent_at));
const atBottom = () => history.value && history.value.scrollHeight - history.value.scrollTop - history.value.clientHeight < 40;
async function markRead() {
  const id = messages.value.at(-1)?.id;
  if (!mounted || !id || document.hidden || props.detailsOpen || !atBottom() || !props.event.unread || id <= Math.max(readThrough, pendingRead)) return;
  pendingRead = id;
  try {
    await props.api(path + '/read', 'PUT', { id });
    readThrough = Math.max(readThrough, id);
  } catch (err) { error.value = err.message; }
  finally { if (pendingRead === id) pendingRead = 0; }
}

async function refresh(forceBottom = false) {
  const request = ++revision;
  try {
    const result = await props.api(path);
    if (!mounted || request !== revision) return;
    const scroll = forceBottom || !ready.value || atBottom();
    const first = result.messages[0]?.id;
    const overlap = messages.value.some(m => m.id === first);
    messages.value = [...(overlap ? messages.value.filter(m => m.id < first) : []), ...result.messages];
    if (!overlap) more.value = result.more;
    ready.value = true;
    await nextTick();
    if (scroll && history.value) history.value.scrollTop = history.value.scrollHeight;
    await markRead();
  } catch (err) { if (mounted && request === revision) error.value = err.message; }
}

async function earlier() {
  if (paging.value || !messages.value.length) return;
  paging.value = true;
  const before = messages.value[0].id;
  try {
    const result = await props.api(path + '?before=' + before);
    if (!mounted || messages.value[0]?.id !== before) return;
    const height = history.value.scrollHeight;
    messages.value = [...result.messages, ...messages.value];
    more.value = result.more;
    await nextTick();
    if (history.value) history.value.scrollTop += history.value.scrollHeight - height;
  } catch (err) { error.value = err.message; }
  finally { paging.value = false; }
}

async function send() {
  const body = draft.value.trim();
  if (sending.value || !body) return;
  sending.value = true;
  error.value = '';
  try {
    if (attempt?.body !== body) attempt = { body, client_id: crypto.randomUUID() };
    await props.api(path, 'POST', attempt);
    attempt = null;
    draft.value = '';
    await refresh(true);
  } catch (err) { error.value = err.message; }
  finally { sending.value = false; }
}
function enter(event) {
  if (event.shiftKey || event.isComposing) return;
  event.preventDefault();
  send();
}
function resume() { if (!document.hidden) refresh(); }
watch(() => props.event.latest_message?.id, () => refresh(), { immediate: true });
watch(() => [props.event.unread, props.detailsOpen], markRead);
onMounted(() => document.addEventListener('visibilitychange', resume));
onUnmounted(() => { mounted = false; document.removeEventListener('visibilitychange', resume); });
</script>

<template>
  <section class="flex h-full min-h-0 flex-col" aria-label="Unterhaltung">
    <header class="flex items-center gap-3 border-b border-line pb-3">
      <button type="button" class="grid size-11 shrink-0 place-items-center rounded-full bg-panel" aria-label="Alle Chats" @click="$emit('back')"><Icon name="prev" /></button>
      <div class="min-w-0 flex-1"><h1 class="m-0 truncate text-xl">{{ event.title }}</h1><small class="text-muted">{{ event.guests.length + 1 }} im Chat<span v-if="event.cancelled"> · Abgesagt</span></small></div>
      <button type="button" class="min-h-11 text-sm font-semibold text-on-wash" @click="$emit('details')">Termindetails</button>
    </header>
    <div ref="history" class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 [overflow-anchor:none]" aria-label="Nachrichten" @scroll="markRead">
      <button v-if="more" class="mx-auto mb-4 block min-h-10 text-sm text-on-wash" :disabled="paging" @click="earlier">Frühere Nachrichten laden</button>
      <p v-if="!ready && !error" role="status" class="text-center text-sm text-muted">Nachrichten werden geladen…</p>
      <div v-if="ready && !messages.length" class="grid h-full place-content-center justify-items-center gap-2 text-center text-muted"><Icon name="chat" /><strong>Noch keine Nachrichten</strong><span class="text-sm">Schreib die erste Nachricht zu diesem Termin.</span></div>
      <template v-for="(message, i) in messages" :key="message.id">
        <div v-if="!i || day(messages[i-1]) !== day(message)" class="my-4 text-center text-xs font-semibold text-muted">{{ day(message) }}</div>
        <article class="mb-2 w-fit max-w-[85%] rounded-2xl px-3.5 py-2" :class="message.sender_id === me.id ? 'ml-auto rounded-br-sm bg-[#324f60]' : 'rounded-bl-sm bg-panel'">
          <strong :style="{ color: memberColor(message.sender_id) }" class="block text-xs wrap-anywhere">{{ message.name }}</strong>
          <p class="m-0 whitespace-pre-wrap wrap-anywhere">{{ message.body }}</p>
          <time class="block text-right text-[11px] text-muted" :datetime="message.sent_at">{{ time.format(new Date(message.sent_at)) }}</time>
        </article>
      </template>
    </div>
    <div v-if="error" role="alert" class="text-sm text-danger">{{ error }} <button @click="error = ''; refresh()">Erneut laden</button></div>
    <form class="flex items-end gap-2 border-t border-line pt-3" @submit.prevent="send">
      <textarea v-model="draft" rows="1" maxlength="4000" :readonly="sending" aria-label="Nachricht" placeholder="Nachricht schreiben…" class="min-h-11 min-w-0 flex-1 resize-none rounded-2xl bg-panel px-4 py-2.5 text-base" @keydown.enter="enter" />
      <button type="submit" aria-label="Nachricht senden" :disabled="!draft.trim() || sending" class="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-45"><Icon name="send" /></button>
    </form>
  </section>
</template>
