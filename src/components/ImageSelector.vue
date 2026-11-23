<script setup>
import { onBeforeUnmount, ref } from 'vue';
import Icon from '../Icon.vue';

defineProps({ photo: String });
const preview = ref('');
function select(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = URL.createObjectURL(file);
}
onBeforeUnmount(() => { if (preview.value) URL.revokeObjectURL(preview.value); });
</script>

<template>
  <label class="my-3 grid gap-1.5 text-[13px] font-bold">
    Titelbild
    <span class="group relative block overflow-hidden rounded-xl border-2 border-dotted border-line bg-panel hover:border-brand focus-within:border-brand focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-brand">
      <input class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Titelbild auswählen" @change="select">
      <span class="flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-muted">
        <img v-if="preview || photo" :src="preview || photo" alt="Vorschau des Titelbilds" class="max-h-48 w-full rounded-md object-contain">
        <Icon v-else name="image" class="size-8" />
        <span>{{ preview || photo ? 'Anderes Bild auswählen' : 'Bild auswählen' }}</span>
      </span>
    </span>
  </label>
</template>
