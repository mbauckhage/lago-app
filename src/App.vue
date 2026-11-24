<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { DateTime } from 'luxon';
import { readPhoto } from './photos.js';
import openingGif from './assets/lago-opening.gif';
import headerGif from './assets/lago-header.gif';
import Icon from './Icon.vue';
import MemberProfile from './components/MemberProfile.vue';
import ImageSelector from './components/ImageSelector.vue';
import ProfilePhoto from './components/ProfilePhoto.vue';
import InstallApp from './components/InstallApp.vue';
import PushSettings from './components/PushSettings.vue';
import AppButton from './components/ui/AppButton.vue';
import AppSheet from './components/ui/AppSheet.vue';
import AppTab from './components/ui/AppTab.vue';
import AppAvatar from './components/ui/AppAvatar.vue';
import FormField from './components/ui/FormField.vue';
import EventCard from './components/events/EventCard.vue';
import RsvpControls from './components/events/RsvpControls.vue';

const installApp = ref(null);
const pushOccupied = ref(true);
const groups = ['Lago Nostre', 'Lago Plus'];
const inviteGroups = ref([]);
const responseLabels = { Going: 'Dabei', Maybe: 'Vielleicht', Declined: 'Abgesagt' };
const responseLabel = status => responseLabels[status] ?? 'Antwort ausstehend';
const locale = 'de-CH';
const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const tabs = { Feed: 'Übersicht', Calendar: 'Kalender', Profile: 'Profil' };
const zone = 'Europe/Zurich';
const today = () => DateTime.now().setZone(zone);
const me = ref(null);
const profilePhoto = ref(null);
const ready = ref(false);
const requestedEvent = Number(new URLSearchParams(location.search).get('event'));
let firstOpening = true;
try {
  firstOpening = !sessionStorage.getItem('lago.opened');
  sessionStorage.setItem('lago.opened', '1');
} catch { /* Storage can be unavailable in private browsing. */ }

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const playingIntro = ref(firstOpening && !requestedEvent && !reducedMotion.matches);
const slowStartup = ref(false);
const showOpening = computed(() => playingIntro.value || (!ready.value && slowStartup.value));
let playbackTimer;
let loadingTimer;

function finishIntro() {
  clearTimeout(playbackTimer);
  playingIntro.value = false;
}

function startPlaybackTimer() {
  if (playingIntro.value) playbackTimer = setTimeout(finishIntro, 16500);
}

function motionChanged() {
  if (reducedMotion.matches) finishIntro();
}
onUnmounted(() => {
  clearTimeout(playbackTimer);
  clearTimeout(loadingTimer);
  reducedMotion.removeEventListener('change', motionChanged);
});
const signingUp = ref(false);
const tab = ref('Feed');
const events = ref([]);
const memberProfile = ref(null);
const profileTab = ref('own');
const settingsOpen = ref(false);
const displayedProfile = computed(() => memberProfile.value ?? (tab.value === 'Profile' && !settingsOpen.value ? me.value : null));
const profileOrigins = [];

async function showMember(person) {
  profileOrigins.push({ profile: memberProfile.value, tab: profileTab.value, scroll: content.value?.scrollTop ?? 0, eventId: eventId.value, details: dialog.value?.open && sheet.value === 'details' });
  dialog.value?.close();
  memberProfile.value = person;
  profileTab.value = 'own';
  await nextTick();
  content.value.scrollTop = 0;
  content.value.querySelector('h1')?.focus();
}

function showHost(event) {
  return showMember({ id: event.host_id, name: event.host, photo: event.host_photo });
}

async function closeMember() {
  const origin = profileOrigins.pop();
  memberProfile.value = origin?.profile ?? null;
  profileTab.value = origin?.tab ?? 'own';
  eventId.value = origin?.eventId ?? null;
  await nextTick();
  content.value.scrollTop = origin?.scroll ?? 0;
  if (origin?.details && current.value) await openSheet('details');
}

const members = ref([]);
const adminMembers = ref([]);
const busy = ref(false);
const error = ref('');
const sheetError = ref('');
const notice = ref('');
const dialog = ref(null);
const content = ref(null);
const sheet = ref('');
const eventId = ref(null);
const draft = ref(null);
const month = ref(today().startOf('month'));
const day = ref('');
const calendarUrl = computed(() => me.value?.calendar_token
  ? new URL('/calendar/' + me.value.calendar_token + '.ics', location.origin).href : '');
const calendarAppUrl = computed(() => calendarUrl.value.replace(/^https?:/, 'webcal:'));
const current = computed(() => events.value.find(event => event.id === eventId.value));
const monthEvents = computed(() => events.value.filter(event => event.date.startsWith(month.value.toFormat('yyyy-MM')))
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
const visibleDays = computed(() => Array.from({ length: month.value.daysInMonth }, (_, i) => {
  const date = month.value.set({ day: i + 1 }).toISODate();
  return { date, number: i + 1, count: monthEvents.value.filter(event => event.date === date).length };
}));
const calendarEvents = computed(() => day.value ? monthEvents.value.filter(event => event.date === day.value) : monthEvents.value);
const labelDate = (date, options = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  DateTime.fromISO(date, { zone }).setLocale(locale).toLocaleString(options);

let noticeTimer;
function announce(message) {
  notice.value = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ''; }, 3500);
}

async function api(path, method = 'GET', body) {
  const response = await fetch('/api' + path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  }).catch(() => { throw new Error('Lago Nostre ist gerade nicht erreichbar. Versuch es erneut.'); });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.message || 'Lago Nostre ist gerade nicht erreichbar. Versuch es erneut.'), { status: response.status });
  }
  return response.status === 204 ? undefined : response.json();
}

let requestedFeed = 0;
let appliedFeed = 0;
let loadedAccount;
async function updateFeed() {
  const account = me.value?.id;
  const request = ++requestedFeed;
  const rows = await api('/events');
  if (account !== me.value?.id || request < appliedFeed) return;
  appliedFeed = request;
  if (loadedAccount === account) {
    const known = new Set(events.value.map(event => event.id));
    const invitations = rows.filter(event => !event.mine && !known.has(event.id));
    if (invitations.length) announce(invitations.length === 1 ? 'Neue Einladung: ' + invitations[0].title : invitations.length + ' neue Einladungen');
  }
  loadedAccount = account;
  events.value = rows;
  if (sheet.value === 'details' && dialog.value?.open && !current.value) dialog.value.close();
}

watch(() => me.value?.approved && me.value.id, (account, previous, cleanup) => {
  if (!account) { loadedAccount = undefined; return; }
  const source = new EventSource('/api/events/live');
  let retry;
  async function refresh() {
    clearTimeout(retry);
    try {
      await updateFeed();
      if (sheet.value === 'editor' && dialog.value?.open) await updateInviteGroups();
    } catch (err) {
      if (me.value?.id !== account) return;
      if (err.status === 401 || err.status === 403) {
        me.value = null;
        events.value = [];
        dialog.value?.close();
      } else retry = setTimeout(refresh, 3000);
    }
  }
  const resume = () => { if (!document.hidden) refresh(); };
  source.onmessage = refresh;
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  cleanup(() => {
    source.close();
    clearTimeout(retry);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
  });
});

async function updateInviteGroups() {
  const account = me.value?.id;
  const allowed = await api('/me/groups');
  if (account !== me.value?.id) return;
  inviteGroups.value = allowed;
  if (draft.value) draft.value.groups = draft.value.groups.filter(group => allowed.includes(group));
}

async function run(action, feedback = error) {
  if (busy.value) return;
  busy.value = true;
  feedback.value = '';
  try {
    await action();
  } catch (problem) {
    feedback.value = problem.message;
  } finally {
    busy.value = false;
  }
}

async function loadAccount() {
  try {
    me.value = await api('/me');
  } catch (problem) {
    if (problem.status !== 401) throw problem;
    me.value = null;
  }
  if (me.value?.approved) {
    await updateFeed();

  }
}

onMounted(async () => {
  reducedMotion.addEventListener('change', motionChanged);
  loadingTimer = setTimeout(() => { slowStartup.value = true; }, 400);
  await run(loadAccount);
  clearTimeout(loadingTimer);
  ready.value = true;
  if (error.value) finishIntro();
  if (events.value.some(event => event.id === requestedEvent)) {
    eventId.value = requestedEvent;
    await openSheet('details');
  }
});

function authenticate(form) {
  const fields = Object.fromEntries(new FormData(form));
  return run(async () => {
    me.value = await api(signingUp.value ? '/register' : '/login', 'POST', fields);
    if (me.value.approved) {
      await updateFeed();
      const requested = Number(new URLSearchParams(location.search).get('event'));
      if (events.value.some(event => event.id === requested)) { eventId.value = requested; await openSheet('details'); }
    }
  });
}

function signOut() {
  return run(async () => {
    let subscription;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      subscription = await registration?.pushManager?.getSubscription();
    }
    await api('/logout', 'POST', { endpoint: subscription?.endpoint });
    await subscription?.unsubscribe().catch(() => {});
    me.value = null;
    events.value = [];
    members.value = [];
    adminMembers.value = [];
    memberProfile.value = null;
    tab.value = 'Feed';
    signingUp.value = false;
  });
}

watch(tab, () => {
  memberProfile.value = null;
  settingsOpen.value = false;
  profileTab.value = 'own';
  profileOrigins.length = 0;
  error.value = '';
  if (content.value) content.value.scrollTop = 0;
  if (me.value?.approved) run(updateFeed);
});

async function openSheet(name) {
  sheetError.value = '';
  sheet.value = name;
  await nextTick();
  if (!dialog.value.open) dialog.value.showModal();
  else dialog.value.querySelector('input, button')?.focus();
}

function showEvent(event) {
  return run(async () => {
    await updateFeed();
    eventId.value = event.id;
    if (!current.value) throw new Error('Dieser Termin ist nicht mehr verfügbar.');
    await openSheet('details');
  });
}

function editEvent(event) {
  return run(async () => {
    await updateInviteGroups();
    members.value = (await api('/members')).filter(member => member.id !== me.value.id);
    draft.value = event ? { ...event, people: [...event.people], groups: event.groups.filter(group => inviteGroups.value.includes(group)) } : {
      title: '', date: today().toISODate(), time: '18:00', place: '', note: '', photo: '', people: [], groups: []
    };
    await openSheet('editor');
  }, dialog.value?.open ? sheetError : error);
}

function saveEvent(form) {
  const fields = new FormData(form);
  const { id, title, date, time, place, note, people, groups: selected } = draft.value;
  return run(async () => {
    const photo = await readPhoto(fields.get('photo')) ?? (fields.has('remove_photo') ? '' : undefined);
    await api(id ? '/events/' + id : '/events', id ? 'PATCH' : 'POST', {
      title, date, time, place, note, people, groups: selected, photo
    });
    dialog.value.close();
    tab.value = 'Feed';
    await updateFeed();
    if (!id && content.value) content.value.scrollTop = 0;
    announce(id ? 'Termin aktualisiert' : 'Termin veröffentlicht');
  }, sheetError);
}

function cancelEvent() {
  return run(async () => {
    await api('/events/' + eventId.value + '/cancel', 'POST');
    sheet.value = 'details';
    await updateFeed();
    dialog.value.close();
    announce('Termin abgesagt');
  }, sheetError);
}

function rsvp(event, status) {
  return run(async () => {
    await api('/events/' + event.id + '/rsvp', 'PUT', { status });
    await updateFeed();
    announce('Antwort gespeichert · ' + responseLabel(status));
  }, dialog.value.open ? sheetError : error);
}

function moveMonth(step) {
  month.value = month.value.plus({ months: step });
  day.value = '';
}

function saveProfile(form) {
  const fields = new FormData(form);
  return run(async () => {
    const photo = await profilePhoto.value.getPhoto();
    me.value = await api('/me', 'PATCH', {
      name: fields.get('name'), photo,
      email_updates: fields.has('email_updates'), push_updates: fields.has('push_updates')
    });
    profilePhoto.value.reset();
    announce('Profil gespeichert');
    await updateFeed();
  });
}

function openAdmin() {
  return run(async () => {
    adminMembers.value = await api('/admin/members');
    await openSheet('admin');
  });
}

function saveMember(person, form) {
  const selected = new FormData(form).getAll('groups');
  return run(async () => {
    await api('/admin/members/' + person.id, 'PATCH', { approved: true, groups: selected });
    adminMembers.value = await api('/admin/members');
    await updateFeed();
    announce(person.approved ? 'Gruppen aktualisiert' : 'Mitglied freigegeben');
  }, sheetError);
}

function resetCalendar() {
  return run(async () => {
    me.value = await api('/me/calendar', 'POST');
    dialog.value.close();
    announce('Neuer Kalenderlink erstellt');
  }, sheetError);
}
</script>

<template>
  <main v-if="showOpening" class="grid h-dvh place-content-center justify-items-center bg-surface px-4 text-ink">
    <div role="status" class="grid justify-items-center">
      <img :src="openingGif" alt="" width="880" height="328" class="w-[min(92vw,610px)] motion-reduce:hidden"
        @load="startPlaybackTimer" @error="finishIntro">
      <span class="mt-3 text-sm">Lago Nostre wird geöffnet…</span>
    </div>
    <button v-if="playingIntro && ready" type="button"
      class="mt-4 min-h-11 rounded-xl bg-panel px-4 text-[13px] font-medium text-muted hover:bg-control hover:text-ink"
      @click="finishIntro">Überspringen</button>
  </main>
  <div v-else class="grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto]">
    <header class="relative isolate overflow-hidden border-b border-line bg-surface">
      <img :src="headerGif" alt="" width="880" height="328"
        class="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-[center_65%] opacity-30 motion-reduce:hidden">
      <div class="app-header-content mx-auto w-full max-w-[580px] px-5 max-[360px]:px-3.5 flex items-center justify-between pb-2 [&_button]:flex [&_button]:items-center [&_button]:gap-[5px]">
        <span class="flex items-center gap-2 text-[25px] font-[780] tracking-[-.04em]">Lago Nostre</span>
        <AppButton variant="primary" v-if="me?.approved"  :disabled="busy" @click="editEvent()"><Icon name="plus" /> Neuer Termin</AppButton>
      </div>
    </header>

    <main ref="content" class="overflow-auto overscroll-y-contain pt-[19px] pb-7">
      <div class="mx-auto w-full px-5 max-[360px]:px-3.5" :class="displayedProfile ? 'max-w-[960px]' : 'max-w-[580px]'">
        <p v-if="error" class="mb-3.5 rounded-xl bg-danger-wash px-4 py-3.5 text-sm leading-[1.45] text-danger" role="alert">{{ error }}</p>
        <p v-if="!ready" class="text-[13px] leading-[1.4] text-muted" role="status">Lago Nostre wird geöffnet…</p>

        <section v-else-if="!me" class="mx-auto mt-[clamp(20px,7vh,80px)] max-w-[420px]">
          <h1>{{ signingUp ? 'Bei Lago Nostre registrieren' : 'Willkommen bei Lago Nostre' }}</h1>
          <p class="mt-0 mb-5 text-sm leading-[1.45] text-muted">{{ signingUp ? 'Die Administration prüft dein Konto vor der Freigabe.' : 'Melde dich an, um mit der Lago-Gruppe Pläne zu machen.' }}</p>
          <form @submit.prevent="authenticate($event.currentTarget)">
            <FormField v-if="signingUp">Anzeigename<input name="name" autocomplete="nickname" maxlength="35" required></FormField>
            <FormField>E-Mail-Adresse<input name="email" type="email" autocomplete="username" maxlength="254" required></FormField>
            <FormField>Passwort<input name="password" type="password" :autocomplete="signingUp ? 'new-password' : 'current-password'"
              :minlength="signingUp ? 12 : undefined" maxlength="128" required></FormField>
            <p v-if="signingUp" class="text-[13px] leading-[1.4] text-muted">Verwende mindestens 12 Zeichen.</p>
            <AppButton variant="primary" :disabled="busy" type="submit">{{ signingUp ? 'Konto erstellen' : 'Anmelden' }}</AppButton>
          </form>
          <AppButton variant="plain" class="mt-2.5 !px-0" @click="signingUp = !signingUp; error = ''">
            {{ signingUp ? 'Zurück zur Anmeldung' : 'Konto erstellen' }}
          </AppButton>
        </section>

        <section v-else-if="!me.approved" class="mx-auto mt-[clamp(20px,7vh,80px)] max-w-[420px]">
          <h1>Freigabe ausstehend</h1>
          <p class="mt-0 mb-5 text-sm leading-[1.45] text-muted">Dein Konto ist erstellt, {{ me.name }}. Sobald die Administration es freigibt, kannst du die Termine sehen.</p>
          <div class="flex flex-wrap items-center gap-2">
            <AppButton variant="primary" :disabled="busy" @click="run(loadAccount)">Freigabe prüfen</AppButton>
            <AppButton variant="plain" :disabled="busy" @click="signOut">Abmelden</AppButton>
          </div>
        </section>

        <MemberProfile v-else-if="displayedProfile" :person="displayedProfile" :events="events" v-model:selected-tab="profileTab"
          :own="!memberProfile" :label-date="labelDate" @back="closeMember" @settings="settingsOpen = true" @open="showEvent" />

        <template v-else-if="tab === 'Feed'">
          <h1 data-install-focus tabindex="-1">Deine Übersicht</h1>
          <p class="mt-0 mb-5 text-sm leading-[1.45] text-muted">Pläne mit der Lago-Gruppe</p>
          <p v-if="!events.length" class="rounded-xl bg-wash px-4 py-3.5 text-sm leading-[1.45] text-on-wash">Hier erscheinen deine Termine und Einladungen.</p>
          <EventCard v-for="event in events" :key="event.id" :event="event" :busy="busy" :label-date="labelDate" @open="showEvent" @respond="rsvp" @profile="showHost" />
        </template>

        <template v-else-if="tab === 'Calendar'">
          <h1>Kalender</h1>
          <p class="mt-0 mb-5 text-sm leading-[1.45] text-muted">Alle deine Termine und Einladungen</p>
          <div class="mt-4 mb-2 flex items-center justify-between gap-2 [&_h2]:flex-1 [&_h2]:text-lg [&_h2]:font-bold">
            <h2 aria-live="polite">{{ month.setLocale(locale).toFormat('MMMM yyyy') }}</h2>
            <AppButton variant="icon" aria-label="Vorheriger Monat" @click="moveMonth(-1)"><Icon name="prev" /></AppButton>
            <AppButton variant="icon" aria-label="Nächster Monat" @click="moveMonth(1)"><Icon name="next" /></AppButton>
          </div>
          <div class="grid grid-cols-7 gap-0.5 rounded-2xl bg-panel p-2 text-center [&_span]:py-[5px] [&_span]:text-[11px] [&_span]:text-muted [&_button]:relative [&_button]:min-h-10 [&_button]:rounded-[10px] [&_button]:text-sm [&_button]:tabular-nums [&_button[aria-pressed=true]]:bg-brand [&_button[aria-pressed=true]]:font-bold [&_button[aria-pressed=true]]:text-on-brand" aria-label="Tage des Monats">
            <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
            <span v-for="index in month.weekday - 1" :key="'blank' + index" aria-hidden="true"></span>
            <button v-for="entry in visibleDays" :key="entry.date" :class="entry.count ? 'after:absolute after:bottom-[5px] after:left-[calc(50%-2px)] after:size-1 after:rounded-full after:bg-current' : ''" :aria-pressed="day === entry.date"
              :aria-label="labelDate(entry.date) + (entry.count ? ', ' + entry.count + (entry.count === 1 ? ' Termin' : ' Termine') : '')"
              @click="day = day === entry.date ? '' : entry.date">{{ entry.number }}</button>
          </div>
          <h2 class="mt-6 mb-2 text-[17px] font-bold tracking-[-.02em]">{{ day ? labelDate(day) : 'Diesen Monat' }}</h2>
          <button v-for="event in calendarEvents" :key="event.id" class="flex min-h-[62px] w-full items-center gap-[11px] border-b border-line py-2 text-left [&_svg]:size-[15px]" @click="showEvent(event)">
            <img v-if="event.photo" class="size-12 rounded-[10px] bg-wash object-cover" :src="event.photo" alt="">
            <span class="min-w-0 flex-1 [&_strong]:block [&_strong]:wrap-anywhere [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-muted [&_small]:wrap-anywhere"><strong>{{ event.title }}</strong><small>{{ labelDate(event.date) }} · {{ event.time }} · {{ event.cancelled ? 'Abgesagt' : event.mine ? 'Von dir organisiert' : responseLabel(event.status) }}</small></span>
            <Icon name="next" />
          </button>
          <p v-if="!calendarEvents.length" class="text-[13px] leading-[1.4] text-muted">{{ day ? 'Keine Termine an diesem Tag.' : 'Keine Termine in diesem Monat.' }}</p>
        </template>

        <template v-else>
          <AppButton variant="plain" class="mb-4 !pl-0" @click="settingsOpen = false"><Icon name="prev" /> Zurück</AppButton>
          <h1>Einstellungen</h1>
          <div class="my-5 flex items-center gap-3.5">
            <button type="button" class="rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-3 disabled:cursor-default disabled:opacity-50" aria-label="Profilfoto ändern" title="Profilfoto ändern" :disabled="busy" @click="profilePhoto?.choosePhoto()">
              <AppAvatar :name="me.name" :photo="me.photo" large />
            </button>
            <strong>{{ me.name }}</strong>
          </div>
          <form @submit.prevent="saveProfile($event.currentTarget)">
            <FormField>Anzeigename<input name="name" :value="me.name" maxlength="35" required></FormField>
            <ProfilePhoto ref="profilePhoto" :photo="me.photo" :disabled="busy" />
            <h2 class="mt-6 mb-2 text-[17px] font-bold tracking-[-.02em]">Benachrichtigungen</h2>
            <p class="text-[13px] leading-[1.4] text-muted">Push informiert dich über neue Einladungen, Terminänderungen und Absagen. E-Mail-Benachrichtigungen sind noch nicht verfügbar.</p>
            <FormField checkbox><input name="email_updates" type="checkbox" :checked="me.email_updates"> E-Mail-Benachrichtigungen</FormField>
            <FormField checkbox><input name="push_updates" type="checkbox" :checked="me.push_updates"> Push-Benachrichtigungen</FormField>
            <AppButton variant="primary" class="mt-2.5" :disabled="busy" type="submit">Änderungen speichern</AppButton>
          </form>
          <section class="mt-[22px] border-t border-line pt-3.5">
            <h2 class="mb-2 text-[17px] font-bold">Lago als App</h2>
            <p class="text-[13px] leading-[1.4] text-muted">Öffne deine Pläne direkt über den Home-Bildschirm.</p>
            <AppButton variant="soft" @click="installApp.open()">Zum Startbildschirm hinzufügen</AppButton>
          </section>
          <section class="mt-[22px] border-t border-line pt-3.5 [&_h2]:mt-0">
            <h2 class="mt-6 mb-2 text-[17px] font-bold tracking-[-.02em]">Persönlicher Kalender</h2>
            <p class="text-[13px] leading-[1.4] text-muted">Öffne deine Kalender-App und bestätige das Abo. Es enthält Termine, die du organisierst, sowie Einladungen, auf die du mit «Dabei» oder «Vielleicht» antwortest.</p>
            <a :href="calendarAppUrl" class="inline-flex min-h-11 items-center rounded-xl bg-brand px-[13px] text-[13px] font-bold text-on-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-3">In Kalender-App öffnen</a>
            <p class="text-[13px] leading-[1.4] text-muted">Falls sich keine Kalender-App öffnet, kopiere den Link und füge ihn dort als Kalenderabo hinzu.</p>
            <FormField>Privater Kalenderlink<input :value="calendarUrl" readonly @focus="$event.target.select()"></FormField>
            <div class="flex flex-wrap items-center gap-2">
              <AppButton variant="soft" :disabled="busy" @click="run(async () => { await navigator.clipboard.writeText(calendarUrl); announce('Kalenderlink kopiert'); })">Link kopieren</AppButton>
              <AppButton variant="plain" :disabled="busy" @click="openSheet('reset-calendar')">Link zurücksetzen</AppButton>
            </div>
          </section>
          <div class="mt-[22px] border-t border-line pt-3.5 [&_h2]:mt-0 flex flex-wrap items-center gap-2">
            <AppButton variant="soft" v-if="me.admin"  :disabled="busy" @click="openAdmin">Mitglieder verwalten</AppButton>
            <AppButton variant="plain" :disabled="busy" @click="signOut">Abmelden</AppButton>
          </div>
        </template>
        <PushSettings v-if="ready && me?.approved" :key="me.id" @occupied="pushOccupied = $event" :account-id="me.id" :enabled="me.push_updates" :profile="tab === 'Profile' && settingsOpen && !memberProfile" />
      </div>
    </main>

    <nav v-if="me?.approved" class="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Hauptnavigation">
      <div class="mx-auto w-full max-w-[580px] px-5 max-[360px]:px-3.5 flex min-h-[68px] items-center justify-around">
        <AppTab v-for="(label, name) in tabs" :key="name" :active="tab === name" :icon="name.toLowerCase()" @click="tab = name; if (name === 'Profile') { settingsOpen = false; memberProfile = null; profileOrigins.length = 0; }">{{ label }}</AppTab>
      </div>
    </nav>

    <AppSheet ref="dialog">
      <template #title>{{ sheet === 'details' ? current?.title : sheet === 'editor' ? (draft?.id ? 'Termin bearbeiten' : 'Neuer Termin')
          : sheet === 'admin' ? 'Mitglieder verwalten' : sheet === 'reset-calendar' ? 'Kalenderlink zurücksetzen?' : 'Diesen Termin absagen?' }}</template>
      <p v-if="sheetError" class="mb-3.5 rounded-xl bg-danger-wash px-4 py-3.5 text-sm leading-[1.45] text-danger" role="alert">{{ sheetError }}</p>

      <template v-if="sheet === 'details' && current">
        <img v-if="current.photo" class="block h-[clamp(190px,52vw,305px)] w-full bg-wash object-cover" :src="current.photo" alt="">
        <p class="text-[13px] leading-[1.4] text-muted">Organisiert von <button type="button" class="min-h-11 underline underline-offset-2" @click="showHost(current)">{{ current.host }}</button><span v-if="current.cancelled" class="ml-auto inline-block rounded-lg bg-danger-wash px-2 py-[5px] text-xs font-bold text-danger">Abgesagt</span></p>
        <div class="flex flex-wrap items-center gap-1.5 text-[13px] leading-[1.4] text-muted [&_svg]:size-[15px]"><Icon name="calendar" /> {{ labelDate(current.date) }} · {{ current.time }} Schweizer Zeit</div>
        <div v-if="current.place" class="flex flex-wrap items-center gap-1.5 text-[13px] leading-[1.4] text-muted [&_svg]:size-[15px]"><Icon name="pin" /> {{ current.place }}</div>
        <p v-if="current.note" class="whitespace-pre-wrap wrap-anywhere">{{ current.note }}</p>
        <h3 class="mt-6 mb-2 text-[17px] font-bold tracking-[-.02em]">Gäste</h3>
        <p v-if="!current.guests.length" class="text-[13px] leading-[1.4] text-muted">Derzeit sind keine Mitglieder eingeladen.</p>
        <ul v-else class="mt-4 mb-[18px] list-none p-0 [&_li]:flex [&_li]:justify-between [&_li]:gap-2 [&_li]:border-b [&_li]:border-line [&_li]:py-2.5">
          <li v-for="guest in current.guests" :key="guest.id"><button type="button" class="min-h-11 text-left hover:underline" @click="showMember(guest)">{{ guest.name }}</button><span class="text-[13px] leading-[1.4] text-muted">{{ responseLabel(guest.status) }}</span></li>
        </ul>
        <div v-if="current.mine && !current.cancelled" class="flex flex-wrap items-center gap-2">
          <AppButton variant="primary" :disabled="busy" @click="editEvent(current)">Termin bearbeiten</AppButton>
          <AppButton variant="danger-plain"  :disabled="busy" @click="openSheet('cancel')">Termin absagen</AppButton>
        </div>
        <RsvpControls v-else-if="!current.cancelled" :event="current" :busy="busy" @respond="rsvp(current, $event)" />
      </template>

      <form v-else-if="sheet === 'editor' && draft" @submit.prevent="saveEvent($event.currentTarget)">
        <FormField>Titel des Termins<input v-model="draft.title" maxlength="75" required placeholder="Abendessen am Samstag"></FormField>
        <div class="grid grid-cols-2 gap-[9px]">
          <FormField>Datum<input v-model="draft.date" type="date" required></FormField>
          <FormField>Uhrzeit in der Schweiz<input v-model="draft.time" type="time" required></FormField>
        </div>
        <FormField>Ort <input v-model="draft.place" maxlength="80" placeholder="Ort hinzufügen"></FormField>
        <FormField>Notizen<textarea v-model="draft.note" maxlength="350" rows="2" placeholder="Was sollen die Gäste wissen?"></textarea></FormField>
        <ImageSelector :key="draft.id ?? 'new'" :photo="draft.photo" />
        <FormField v-if="draft.photo" checkbox><input name="remove_photo" type="checkbox"> Titelbild entfernen</FormField>
        <fieldset v-if="inviteGroups.length">
          <legend>Gruppen einladen</legend>
          <FormField v-for="group in inviteGroups" :key="group" checkbox><input v-model="draft.groups" type="checkbox" :value="group"> {{ group }}</FormField>
        </fieldset>
        <fieldset v-if="members.length">
          <legend>Personen einladen</legend>
          <FormField v-for="person in members" :key="person.id" checkbox><input v-model="draft.people" type="checkbox" :value="person.id"> {{ person.name }}</FormField>
        </fieldset>
        <AppButton variant="primary" class="mt-2 w-full" :disabled="busy" type="submit">{{ draft.id ? 'Termin speichern' : 'Termin veröffentlichen' }}</AppButton>
      </form>

      <template v-else-if="sheet === 'cancel'">
        <p>Die Gäste sehen, dass der Termin abgesagt wurde. In persönlichen Kalenderabos wird er entfernt.</p>
        <div class="flex flex-wrap items-center gap-2">
          <AppButton variant="soft" :disabled="busy" @click="openSheet('details')">Termin beibehalten</AppButton>
          <AppButton variant="danger"  :disabled="busy" @click="cancelEvent">Termin absagen</AppButton>
        </div>
      </template>

      <template v-else-if="sheet === 'admin'">
        <form v-for="person in adminMembers" :key="person.id" class="border-b border-line py-3.5 wrap-anywhere" @submit.prevent="saveMember(person, $event.currentTarget)">
          <strong>{{ person.name }}</strong>
          <div class="text-[13px] leading-[1.4] text-muted">{{ person.email }} · {{ person.approved ? 'Freigegeben' : 'Freigabe ausstehend' }}{{ person.admin ? ' · Admin' : '' }}</div>
          <FormField v-for="group in groups" :key="group" checkbox><input name="groups" type="checkbox" :value="group" :checked="person.groups.includes(group)"> {{ group }}</FormField>
          <AppButton variant="primary" class="mt-2.5" :disabled="busy" type="submit">{{ person.approved ? 'Gruppen speichern' : 'Mitglied freigeben' }}</AppButton>
        </form>
      </template>

      <template v-else-if="sheet === 'reset-calendar'">
        <p>Der bisherige Link wird ungültig. Füge den neuen Link in deiner Kalender-App hinzu, um weiterhin Änderungen zu erhalten.</p>
        <AppButton variant="primary" :disabled="busy" @click="resetCalendar">Kalenderlink zurücksetzen</AppButton>
      </template>
    </AppSheet>
    <div class="pointer-events-none fixed bottom-[calc(79px+env(safe-area-inset-bottom))] left-1/2 z-2 -translate-x-1/2 whitespace-nowrap rounded-[20px] bg-ink px-[15px] py-[9px] text-[13px] font-bold text-surface empty:p-0" role="status">{{ notice }}</div>
  </div>
  <InstallApp ref="installApp" :eligible="ready && !!me?.approved && !showOpening && !busy && !error && !pushOccupied && tab === 'Feed' && !memberProfile" />
</template>
