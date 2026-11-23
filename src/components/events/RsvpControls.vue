<script setup>
import AppButton from '../ui/AppButton.vue';
import Icon from '../../Icon.vue';
defineProps({ event: { type: Object, required: true }, busy: Boolean });
defineEmits(['respond']);
const responses = [['Going', 'check', 'Dabei'], ['Maybe', 'maybe', 'Vielleicht'], ['Declined', 'close', 'Abgesagt']];
</script>

<template>
  <div class="mt-3 flex flex-wrap items-center gap-1.5 [&_button]:flex-1 [&_button]:whitespace-nowrap [&_button]:px-2 [&_svg]:mr-0.5 [&_svg]:size-[15px] max-[360px]:[&_svg]:hidden" role="group" :aria-label="'Antwort auf ' + event.title">
    <AppButton v-for="[status, icon, label] in responses" :key="status"
      :variant="!event.status && status === 'Going' ? 'primary' : 'soft'"
      :aria-pressed="event.status === status" :disabled="busy" @click="$emit('respond', status)"><Icon :name="icon" /> {{ label }}</AppButton>
  </div>
</template>
