<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { DateTime } from 'luxon';
import Icon from './Icon.vue';

const groups = ['Lago Nostre', 'Lago Plus'];
const statuses = [['Going', 'check'], ['Maybe', 'maybe'], ['Declined', 'close']];
const tabs = ['Feed', 'Calendar', 'Profile'];
const zone = 'Europe/Zurich';
const today = () => DateTime.now().setZone(zone);
const me = ref(null);
const ready = ref(false);
const signingUp = ref(false);
const tab = ref('Feed');
const events = ref([]);
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
const current = computed(() => events.value.find(event => event.id === eventId.value));
const monthEvents = computed(() => events.value.filter(event => event.date.startsWith(month.value.toFormat('yyyy-MM')))
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
const visibleDays = computed(() => Array.from({ length: month.value.daysInMonth }, (_, i) => {
  const date = month.value.set({ day: i + 1 }).toISODate();
  return { date, number: i + 1, count: monthEvents.value.filter(event => event.date === date).length };
}));
const calendarEvents = computed(() => day.value ? monthEvents.value.filter(event => event.date === day.value) : monthEvents.value);
const labelDate = (date, options = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  DateTime.fromISO(date, { zone }).setLocale('en-GB').toLocaleString(options);
const initials = name => name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();

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
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.message || 'Lago is unavailable. Try again.'), { status: response.status });
  }
  return response.status === 204 ? undefined : response.json();
}

const updateFeed = async () => { events.value = await api('/events'); };

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
  if (me.value?.approved) await updateFeed();
}

onMounted(async () => {
  await run(loadAccount);
  ready.value = true;
});

function authenticate(form) {
  const fields = Object.fromEntries(new FormData(form));
  return run(async () => {
    me.value = await api(signingUp.value ? '/register' : '/login', 'POST', fields);
    if (me.value.approved) await updateFeed();
  });
}

function signOut() {
  return run(async () => {
    await api('/logout', 'POST');
    me.value = null;
    events.value = [];
    members.value = [];
    adminMembers.value = [];
    tab.value = 'Feed';
    signingUp.value = false;
  });
}

watch(tab, () => {
  error.value = '';
  if (content.value) content.value.scrollTop = 0;
  if (me.value?.approved && tab.value !== 'Profile') run(updateFeed);
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
    if (!current.value) throw new Error('This event is no longer available.');
    await openSheet('details');
  });
}

function editEvent(event) {
  return run(async () => {
    members.value = (await api('/members')).filter(member => member.id !== me.value.id);
    draft.value = event ? { ...event, people: [...event.people], groups: [...event.groups] } : {
      title: '', date: today().toISODate(), time: '18:00', place: '', note: '', photo: '', people: [], groups: []
    };
    await openSheet('editor');
  }, dialog.value?.open ? sheetError : error);
}

function readPhoto(file) {
  if (!file?.size) return Promise.resolve(undefined);
  if (file.size > 1_048_576 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP image under 1 MB.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the photo. Choose it again.'));
    reader.readAsDataURL(file);
  });
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
    announce(id ? 'Event updated' : 'Event posted');
  }, sheetError);
}

function cancelEvent() {
  return run(async () => {
    await api('/events/' + eventId.value + '/cancel', 'POST');
    sheet.value = 'details';
    await updateFeed();
    dialog.value.close();
    announce('Event cancelled');
  }, sheetError);
}

function rsvp(event, status) {
  return run(async () => {
    await api('/events/' + event.id + '/rsvp', 'PUT', { status });
    await updateFeed();
    announce('RSVP saved · ' + status);
  }, dialog.value.open ? sheetError : error);
}

function moveMonth(step) {
  month.value = month.value.plus({ months: step });
  day.value = '';
}

function saveProfile(form) {
  const fields = new FormData(form);
  return run(async () => {
    const photo = await readPhoto(fields.get('photo')) ?? (fields.has('remove_photo') ? '' : undefined);
    me.value = await api('/me', 'PATCH', {
      name: fields.get('name'), photo,
      email_updates: fields.has('email_updates'), push_updates: fields.has('push_updates')
    });
    form.elements.photo.value = '';
    if (form.elements.remove_photo) form.elements.remove_photo.checked = false;
    announce('Profile saved');
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
    announce(person.approved ? 'Groups updated' : 'Member approved');
  }, sheetError);
}

function resetCalendar() {
  return run(async () => {
    me.value = await api('/me/calendar', 'POST');
    dialog.value.close();
    announce('New calendar link created');
  }, sheetError);
}
</script>

<template>
  <div class="lago">
    <header class="header">
      <div class="frame header-inner">
        <span class="wordmark"><Icon name="waves" /> Lago</span>
        <button v-if="me?.approved" class="primary" :disabled="busy" @click="editEvent()"><Icon name="plus" /> New event</button>
      </div>
    </header>

    <main ref="content" class="screen">
      <div class="frame">
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="!ready" class="muted" role="status">Opening Lago…</p>

        <section v-else-if="!me" class="account-panel">
          <h1>{{ signingUp ? 'Join Lago' : 'Welcome to Lago' }}</h1>
          <p class="subtitle">{{ signingUp ? 'An administrator will review your account before you can join.' : 'Sign in to make plans with the Lago crew.' }}</p>
          <form @submit.prevent="authenticate($event.currentTarget)">
            <label v-if="signingUp">Display name<input name="name" autocomplete="nickname" maxlength="35" required></label>
            <label>Email<input name="email" type="email" autocomplete="username" maxlength="254" required></label>
            <label>Password<input name="password" type="password" :autocomplete="signingUp ? 'new-password' : 'current-password'"
              :minlength="signingUp ? 12 : undefined" maxlength="128" required></label>
            <p v-if="signingUp" class="muted">Use at least 12 characters.</p>
            <button class="primary" :disabled="busy">{{ signingUp ? 'Create account' : 'Sign in' }}</button>
          </form>
          <button class="plain switch-account" @click="signingUp = !signingUp; error = ''">
            {{ signingUp ? 'Back to sign in' : 'Create an account' }}
          </button>
        </section>

        <section v-else-if="!me.approved" class="account-panel">
          <h1>Awaiting approval</h1>
          <p class="subtitle">Your account is ready, {{ me.name }}. An administrator needs to approve it before you can see Lago plans.</p>
          <div class="controls">
            <button class="primary" :disabled="busy" @click="run(loadAccount)">Check approval</button>
            <button class="plain" :disabled="busy" @click="signOut">Sign out</button>
          </div>
        </section>

        <template v-else-if="tab === 'Feed'">
          <h1>Your feed</h1>
          <p class="subtitle">Plans with the Lago crew</p>
          <p v-if="!events.length" class="empty">Your events and invitations will appear here.</p>
          <article v-for="event in events" :key="event.id" class="post">
            <div class="author">
              <img v-if="event.host_photo" :src="event.host_photo" class="avatar" alt="">
              <span v-else class="avatar" aria-hidden="true">{{ initials(event.host) }}</span>
              <span><strong>{{ event.host }}</strong><small>{{ event.mine ? 'Hosted by you' : 'Invited you' }}</small></span>
              <span v-if="event.cancelled" class="cancelled">Cancelled</span>
            </div>
            <img v-if="event.photo" class="photo" :src="event.photo" alt="" loading="lazy">
            <div class="eventbody">
              <h2><button class="title" @click="showEvent(event)">{{ event.title }}</button></h2>
              <div class="meta"><Icon name="calendar" /> {{ labelDate(event.date) }} · {{ event.time }}</div>
              <div v-if="event.place" class="meta"><Icon name="pin" /> {{ event.place }}</div>
              <div v-if="!event.mine && !event.cancelled" class="actions" role="group" :aria-label="'RSVP for ' + event.title">
                <button v-for="[status, icon] in statuses" :key="status" :class="!event.status && status === 'Going' ? 'primary' : 'soft'"
                  :aria-pressed="event.status === status" :disabled="busy" @click="rsvp(event, status)"><Icon :name="icon" /> {{ status }}</button>
              </div>
            </div>
          </article>
        </template>

        <template v-else-if="tab === 'Calendar'">
          <h1>Calendar</h1>
          <p class="subtitle">All your Lago plans and invitations</p>
          <div class="calhead">
            <h2 aria-live="polite">{{ month.setLocale('en-GB').toFormat('MMMM yyyy') }}</h2>
            <button class="icon" aria-label="Previous month" @click="moveMonth(-1)"><Icon name="prev" /></button>
            <button class="icon" aria-label="Next month" @click="moveMonth(1)"><Icon name="next" /></button>
          </div>
          <div class="calendar" aria-label="Days of the month">
            <span v-for="weekday in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']" :key="weekday">{{ weekday }}</span>
            <span v-for="index in month.weekday - 1" :key="'blank' + index" aria-hidden="true"></span>
            <button v-for="entry in visibleDays" :key="entry.date" :class="{ 'has-event': entry.count }" :aria-pressed="day === entry.date"
              :aria-label="labelDate(entry.date) + (entry.count ? ', ' + entry.count + (entry.count === 1 ? ' event' : ' events') : '')"
              @click="day = day === entry.date ? '' : entry.date">{{ entry.number }}</button>
          </div>
          <h2 class="heading">{{ day ? labelDate(day) : 'This month' }}</h2>
          <button v-for="event in calendarEvents" :key="event.id" class="row" @click="showEvent(event)">
            <img v-if="event.photo" class="thumb" :src="event.photo" alt="">
            <span class="rowtxt"><strong>{{ event.title }}</strong><small>{{ labelDate(event.date) }} · {{ event.time }} · {{ event.cancelled ? 'Cancelled' : event.mine ? 'Hosting' : event.status || 'Awaiting reply' }}</small></span>
            <Icon name="next" />
          </button>
          <p v-if="!calendarEvents.length" class="muted">No events {{ day ? 'on this date.' : 'this month.' }}</p>
        </template>

        <template v-else>
          <h1>Profile</h1>
          <div class="profilehead">
            <img v-if="me.photo" :src="me.photo" class="avatar" alt="">
            <span v-else class="avatar" aria-hidden="true">{{ initials(me.name) }}</span>
            <strong>{{ me.name }}</strong>
          </div>
          <form @submit.prevent="saveProfile($event.currentTarget)">
            <label>Display name<input name="name" :value="me.name" maxlength="35" required></label>
            <label>Profile photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
            <label v-if="me.photo" class="check"><input name="remove_photo" type="checkbox"> Remove profile photo</label>
            <h2 class="heading">Notifications</h2>
            <p class="muted">These preferences will apply when email and push delivery are available.</p>
            <label class="check"><input name="email_updates" type="checkbox" :checked="me.email_updates"> Email notifications</label>
            <label class="check"><input name="push_updates" type="checkbox" :checked="me.push_updates"> Push notifications</label>
            <button class="primary" :disabled="busy">Save changes</button>
          </form>
          <section class="settings-section">
            <h2 class="heading">Personal calendar</h2>
            <p class="muted">Add this private subscription URL to your calendar app. It includes events you host and invitations you mark Going or Maybe.</p>
            <label>Private calendar URL<input :value="calendarUrl" readonly @focus="$event.target.select()"></label>
            <div class="controls">
              <button class="soft" :disabled="busy" @click="run(async () => { await navigator.clipboard.writeText(calendarUrl); announce('Calendar URL copied'); })">Copy URL</button>
              <button class="plain" :disabled="busy" @click="openSheet('reset-calendar')">Reset URL</button>
            </div>
          </section>
          <div class="settings-section controls">
            <button v-if="me.admin" class="soft" :disabled="busy" @click="openAdmin">Manage members</button>
            <button class="plain" :disabled="busy" @click="signOut">Sign out</button>
          </div>
        </template>
      </div>
    </main>

    <nav v-if="me?.approved" class="nav" aria-label="Lago tabs">
      <div class="frame nav-inner">
        <button v-for="name in tabs" :key="name" class="tab" :aria-current="tab === name ? 'page' : undefined" @click="tab = name">
          <Icon :name="name.toLowerCase()" /> {{ name }}
        </button>
      </div>
    </nav>

    <dialog ref="dialog" class="sheet" aria-labelledby="sheet-title">
      <div class="sheethead">
        <h2 id="sheet-title">{{ sheet === 'details' ? current?.title : sheet === 'editor' ? (draft?.id ? 'Edit event' : 'New event')
          : sheet === 'admin' ? 'Manage members' : sheet === 'reset-calendar' ? 'Reset calendar URL?' : 'Cancel this event?' }}</h2>
        <button type="button" class="icon" aria-label="Close" @click="dialog.close()"><Icon name="close" /></button>
      </div>
      <p v-if="sheetError" class="error" role="alert">{{ sheetError }}</p>

      <template v-if="sheet === 'details' && current">
        <img v-if="current.photo" class="photo" :src="current.photo" alt="">
        <p class="muted">Hosted by {{ current.host }}<span v-if="current.cancelled" class="cancelled">Cancelled</span></p>
        <div class="meta"><Icon name="calendar" /> {{ labelDate(current.date) }} · {{ current.time }} Swiss time</div>
        <div v-if="current.place" class="meta"><Icon name="pin" /> {{ current.place }}</div>
        <p v-if="current.note" class="event-note">{{ current.note }}</p>
        <h3 class="heading">Guests</h3>
        <p v-if="!current.guests.length" class="muted">No members are currently invited.</p>
        <ul v-else class="guests">
          <li v-for="guest in current.guests" :key="guest.id"><span>{{ guest.name }}</span><span class="muted">{{ guest.status || 'Awaiting reply' }}</span></li>
        </ul>
        <div v-if="current.mine && !current.cancelled" class="controls">
          <button class="primary" :disabled="busy" @click="editEvent(current)">Edit event</button>
          <button class="plain danger" :disabled="busy" @click="openSheet('cancel')">Cancel event</button>
        </div>
        <div v-else-if="!current.cancelled" class="actions" role="group" :aria-label="'RSVP for ' + current.title">
          <button v-for="[status, icon] in statuses" :key="status" :class="!current.status && status === 'Going' ? 'primary' : 'soft'"
            :aria-pressed="current.status === status" :disabled="busy" @click="rsvp(current, status)"><Icon :name="icon" /> {{ status }}</button>
        </div>
      </template>

      <form v-else-if="sheet === 'editor' && draft" @submit.prevent="saveEvent($event.currentTarget)">
        <label>Event name<input v-model="draft.title" maxlength="75" required placeholder="Dinner on Saturday"></label>
        <div class="two">
          <label>Date<input v-model="draft.date" type="date" required></label>
          <label>Time in Switzerland<input v-model="draft.time" type="time" required></label>
        </div>
        <label>Location <input v-model="draft.place" maxlength="80" placeholder="Add a place"></label>
        <label>Notes<textarea v-model="draft.note" maxlength="350" rows="2" placeholder="Anything friends should know?"></textarea></label>
        <label>Cover photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label v-if="draft.photo" class="check"><input name="remove_photo" type="checkbox"> Remove cover photo</label>
        <fieldset>
          <legend>Invite groups</legend>
          <label v-for="group in groups" :key="group" class="check"><input v-model="draft.groups" type="checkbox" :value="group"> {{ group }}</label>
        </fieldset>
        <fieldset v-if="members.length">
          <legend>Invite people</legend>
          <label v-for="person in members" :key="person.id" class="check"><input v-model="draft.people" type="checkbox" :value="person.id"> {{ person.name }}</label>
        </fieldset>
        <button class="primary wide" :disabled="busy">{{ draft.id ? 'Save event' : 'Post event' }}</button>
      </form>

      <template v-else-if="sheet === 'cancel'">
        <p>Guests will see that the event is cancelled. It will be removed from personal calendar subscriptions.</p>
        <div class="controls">
          <button class="soft" :disabled="busy" @click="openSheet('details')">Keep event</button>
          <button class="primary danger-button" :disabled="busy" @click="cancelEvent">Cancel event</button>
        </div>
      </template>

      <template v-else-if="sheet === 'admin'">
        <form v-for="person in adminMembers" :key="person.id" class="member" @submit.prevent="saveMember(person, $event.currentTarget)">
          <strong>{{ person.name }}</strong>
          <div class="muted">{{ person.email }} · {{ person.approved ? 'Approved' : 'Pending approval' }}{{ person.admin ? ' · Admin' : '' }}</div>
          <label v-for="group in groups" :key="group" class="check"><input name="groups" type="checkbox" :value="group" :checked="person.groups.includes(group)"> {{ group }}</label>
          <button class="primary" :disabled="busy">{{ person.approved ? 'Save groups' : 'Approve member' }}</button>
        </form>
      </template>

      <template v-else-if="sheet === 'reset-calendar'">
        <p>The current URL will stop working. Add the new URL to your calendar app to keep receiving updates.</p>
        <button class="primary" :disabled="busy" @click="resetCalendar">Reset calendar URL</button>
      </template>
    </dialog>
    <div class="notice" role="status">{{ notice }}</div>
  </div>
</template>
