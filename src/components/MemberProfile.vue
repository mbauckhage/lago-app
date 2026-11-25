<script setup>
import { computed, useId } from 'vue';
import { memberEvents } from '../member-events.js';
import UnreadBadge from './UnreadBadge.vue';
import Icon from '../Icon.vue';
import AppAvatar from './ui/AppAvatar.vue';
import AppButton from './ui/AppButton.vue';

const props = defineProps({ person: Object, events: Array, selectedTab: String, own: Boolean, labelDate: Function });
const emit = defineEmits(['back', 'settings', 'open', 'update:selectedTab']);
const visibleEvents = computed(() => memberEvents(props.events, props.person.id, props.selectedTab));
const tabGroup = useId();
const tabs = [{ id: 'own', label: 'Eigene Termine' }, { id: 'all', label: 'Alle Termine' }];

let swipeStart = null;

function startSwipe(event) {
  swipeStart = event.touches.length === 1 ? event.touches[0] : null;
}

function finishSwipe(event) {
  const start = swipeStart;
  swipeStart = null;
  if (!start || event.touches.length) return;
  const end = event.changedTouches[0];
  if (start.identifier !== end.identifier) return;

  const dx = end.clientX - start.clientX;
  const dy = end.clientY - start.clientY;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

  // Suppress the tap a browser can generate on the tile under the finger.
  if (event.cancelable) event.preventDefault();
  const next = dx < 0 ? 'all' : 'own';
  if (next !== props.selectedTab) emit('update:selectedTab', next);
}

function navigateTabs(event, index) {
  const positions = { ArrowLeft: 1 - index, ArrowRight: 1 - index, Home: 0, End: tabs.length - 1 };
  if (!Object.hasOwn(positions, event.key)) return;
  event.preventDefault();
  const next = positions[event.key];
  event.currentTarget.parentElement.children[next].focus();
  emit('update:selectedTab', tabs[next].id);
}
</script>

<template>
  <section class="flex min-h-full flex-col" :aria-label="own ? 'Dein Profil' : 'Mitgliederprofil'">
    <AppButton v-if="!own" variant="plain" class="mb-4 self-start !pl-0" @click="$emit('back')"><Icon name="prev" /> Zurück</AppButton>
    <div class="mb-6 flex items-center gap-3.5">
      <AppAvatar :name="person.name" :photo="person.photo" large />
      <h1 tabindex="-1" class="my-0 min-w-0 flex-1 wrap-anywhere">{{ person.name }}</h1>
      <AppButton v-if="own" variant="plain" class="shrink-0" aria-label="Einstellungen" @click="$emit('settings')">
        <Icon name="settings" /><span class="hidden sm:inline">Einstellungen</span>
      </AppButton>
    </div>
    <div class="flex-1 touch-[pan-y_pinch-zoom]" @touchstart.passive="startSwipe" @touchend="finishSwipe" @touchcancel="swipeStart = null">
      <div role="tablist" aria-label="Terminauswahl" class="flex gap-0 border-b border-line sm:gap-6">
        <button v-for="(tab, index) in tabs" :id="`${tabGroup}-${tab.id}`" :key="tab.id" type="button"
          role="tab" :aria-selected="selectedTab === tab.id" :aria-controls="`${tabGroup}-events`"
          :tabindex="selectedTab === tab.id ? 0 : -1"
          class="-mb-px min-h-11 flex-1 border-b-[3px] border-transparent px-1 text-sm font-semibold text-muted hover:text-ink aria-selected:border-brand aria-selected:text-ink sm:flex-none"
          @click="emit('update:selectedTab', tab.id)" @keydown="navigateTabs($event, index)">{{ tab.label }}</button>
      </div>
      <div :id="`${tabGroup}-events`" role="tabpanel" :aria-labelledby="`${tabGroup}-${selectedTab}`" tabindex="0">
        <p class="text-[13px] text-muted">Termine, auf die du Zugriff hast.</p>
        <div class="grid grid-cols-3 gap-2 sm:gap-4">
          <button v-for="event in visibleEvents" :key="event.id" class="flex min-w-0 flex-col overflow-hidden rounded-xl bg-panel text-left hover:bg-control" @click="$emit('open', event)">
            <img v-if="event.photo" :src="event.photo" alt="" loading="lazy" class="aspect-square w-full object-cover">
            <div v-else class="grid aspect-square w-full shrink-0 place-content-center bg-wash text-center text-on-wash"><span class="text-2xl font-bold">{{ event.date.slice(8) }}</span><span class="text-xs">{{ labelDate(event.date, { month: 'short' }) }}</span></div>
            <div class="p-2 sm:p-3">
              <strong class="block text-sm leading-snug wrap-anywhere sm:text-lg">{{ event.title }}</strong>
              <span class="mt-1 block text-xs text-muted wrap-anywhere">{{ labelDate(event.date, { day: 'numeric', month: 'short' }) }} · {{ event.time }}</span>
              <UnreadBadge :count="event.unread" /><span v-if="event.cancelled" class="mt-1 block text-xs text-danger">Abgesagt</span>
            </div>
          </button>
        </div>
        <p v-if="!visibleEvents.length" class="rounded-xl bg-wash px-4 py-3.5 text-sm text-on-wash" role="status">{{ selectedTab === 'own' ? 'Keine eigenen Termine für dich sichtbar.' : 'Keine Termine für dich sichtbar.' }}</p>
      </div>
    </div>
  </section>
</template>
