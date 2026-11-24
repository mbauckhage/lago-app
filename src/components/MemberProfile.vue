<script setup>
import { computed } from 'vue';
import { memberEvents } from '../member-events.js';
import Icon from '../Icon.vue';
import AppAvatar from './ui/AppAvatar.vue';
import AppButton from './ui/AppButton.vue';

const props = defineProps({ person: Object, events: Array, selectedTab: String, own: Boolean, labelDate: Function });
defineEmits(['back', 'settings', 'open', 'update:selectedTab']);
const visibleEvents = computed(() => memberEvents(props.events, props.person.id, props.selectedTab));
</script>

<template>
  <section :aria-label="own ? 'Dein Profil' : 'Mitgliederprofil'">
    <div class="mb-4 flex items-center" :class="own ? 'justify-end' : 'justify-start'">
      <AppButton v-if="own" variant="plain" @click="$emit('settings')"><Icon name="settings" /> Einstellungen</AppButton>
      <AppButton v-else variant="plain" class="!pl-0" @click="$emit('back')"><Icon name="prev" /> Zurück</AppButton>
    </div>
          <div class="mb-6 flex items-center gap-3.5">
            <AppAvatar :name="person.name" :photo="person.photo" large />
            <h1 tabindex="-1" class="wrap-anywhere">{{ person.name }}</h1>
          </div>
          <div class="mb-5 flex gap-2" aria-label="Terminauswahl">
            <AppButton v-for="choice in [{ id: 'own', label: 'Eigene Termine' }, { id: 'all', label: 'Alle Termine' }]" :key="choice.id"
              :variant="selectedTab === choice.id ? 'primary' : 'soft'" :aria-pressed="selectedTab === choice.id" @click="$emit('update:selectedTab', choice.id)">{{ choice.label }}</AppButton>
          </div>
          <p class="text-[13px] text-muted">Termine, auf die du Zugriff hast.</p>
          <div class="grid grid-cols-3 gap-2 sm:gap-4">
            <button v-for="event in visibleEvents" :key="event.id" class="flex min-w-0 flex-col overflow-hidden rounded-xl bg-panel text-left hover:bg-control" @click="$emit('open', event)">
              <img v-if="event.photo" :src="event.photo" alt="" loading="lazy" class="aspect-square w-full object-cover">
              <div v-else class="grid aspect-square w-full shrink-0 place-content-center bg-wash text-center text-on-wash"><span class="text-2xl font-bold">{{ event.date.slice(8) }}</span><span class="text-xs">{{ labelDate(event.date, { month: 'short' }) }}</span></div>
              <div class="p-2 sm:p-3">
                <strong class="block text-sm leading-snug wrap-anywhere sm:text-lg">{{ event.title }}</strong>
                <span class="mt-1 block text-xs text-muted wrap-anywhere">{{ labelDate(event.date, { day: 'numeric', month: 'short' }) }} · {{ event.time }}</span>
                <span v-if="event.cancelled" class="mt-1 block text-xs text-danger">Abgesagt</span>
              </div>
            </button>
          </div>
          <p v-if="!visibleEvents.length" class="rounded-xl bg-wash px-4 py-3.5 text-sm text-on-wash" role="status">{{ selectedTab === 'own' ? 'Keine eigenen Termine für dich sichtbar.' : 'Keine Termine für dich sichtbar.' }}</p>
  </section>
</template>
