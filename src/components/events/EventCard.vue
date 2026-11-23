<script setup>
import Icon from '../../Icon.vue';
import AppAvatar from '../ui/AppAvatar.vue';
import RsvpControls from './RsvpControls.vue';
defineProps({ event: { type: Object, required: true }, busy: Boolean, labelDate: { type: Function, required: true } });
defineEmits(['open', 'respond']);
</script>

<template>
          <article class="mb-[18px] overflow-hidden rounded-2xl bg-panel shadow-[0_4px_16px_#0003]">
            <div class="flex items-center gap-[9px] px-3 py-2.5 [&_strong]:block [&_strong]:text-[13px] [&_small]:mt-0.5 [&_small]:block [&_small]:text-[11px] [&_small]:text-muted">
              <AppAvatar :name="event.host" :photo="event.host_photo" />
              <span><strong>{{ event.host }}</strong><small>{{ event.mine ? 'Von dir organisiert' : 'Hat dich eingeladen' }}</small></span>
              <span v-if="event.cancelled" class="ml-auto inline-block rounded-lg bg-danger-wash px-2 py-[5px] text-xs font-bold text-danger">Abgesagt</span>
              <span v-else-if="!event.mine && !event.status" class="ml-auto rounded-lg bg-wash px-2 py-[5px] text-xs font-bold text-on-wash">Antwort ausstehend</span>
            </div>
            <img v-if="event.photo" class="block h-[clamp(190px,52vw,305px)] w-full bg-wash object-cover" :src="event.photo" alt="" loading="lazy">
            <div class="px-3.5 pt-[13px] pb-[15px]">
              <h2><button class="block min-h-[35px] p-0 text-left text-[22px] font-[760] tracking-[-.035em] wrap-anywhere" @click="$emit('open', event)">{{ event.title }}</button></h2>
              <div class="flex flex-wrap items-center gap-1.5 text-[13px] leading-[1.4] text-muted [&_svg]:size-[15px]"><Icon name="calendar" /> {{ labelDate(event.date) }} · {{ event.time }}</div>
              <div v-if="event.place" class="flex flex-wrap items-center gap-1.5 text-[13px] leading-[1.4] text-muted [&_svg]:size-[15px]"><Icon name="pin" /> {{ event.place }}</div>
              <RsvpControls v-if="!event.mine && !event.cancelled" :event="event" :busy="busy" @respond="$emit('respond', event, $event)" />
            </div>
          </article>
</template>
