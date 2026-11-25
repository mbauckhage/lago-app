<script setup>
import { ref } from 'vue';
import AppButton from './ui/AppButton.vue';
import FormField from './ui/FormField.vue';

const props = defineProps({ url: { type: String, required: true } });
const feedback = ref('');

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url);
    feedback.value = 'Kalenderlink kopiert';
  } catch {
    feedback.value = 'Markiere den Kalenderlink und kopiere ihn manuell.';
  }
}
</script>

<template>
  <p class="text-[13px] leading-[1.4] text-muted">Öffne deine Kalender-App und bestätige das Abo. Es enthält Termine, die du organisierst, sowie Einladungen, auf die du mit «Dabei» oder «Vielleicht» antwortest.</p>
  <a :href="url.replace(/^https?:/, 'webcal:')" class="inline-flex min-h-11 items-center rounded-xl bg-brand px-[13px] text-[13px] font-bold text-on-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-3">In Kalender-App öffnen</a>
  <p class="text-[13px] leading-[1.4] text-muted">Falls sich keine Kalender-App öffnet, kopiere den Link und füge ihn dort als Kalenderabo hinzu.</p>
  <FormField>Privater Kalenderlink<input :value="url" readonly @focus="$event.target.select()"></FormField>
  <div class="flex flex-wrap items-center gap-2">
    <AppButton variant="soft" @click="copyLink">Link kopieren</AppButton>
    <slot />
  </div>
  <p role="status" class="text-sm text-muted">{{ feedback }}</p>
</template>
