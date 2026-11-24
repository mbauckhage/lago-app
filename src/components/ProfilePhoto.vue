<script setup>
import { computed, ref } from 'vue';
import AppButton from './ui/AppButton.vue';
import { readPhoto } from '../photos.js';

const props = defineProps({ photo: String, disabled: Boolean });
const source = ref('');
const image = ref(null);
const zoom = ref(1);
const horizontal = ref(50);
const vertical = ref(50);
const error = ref('');
const removed = ref(false);
const loading = ref(false);
let selection = 0;
const crop = computed(() => {
  if (!image.value) return null;
  const size = Math.min(image.value.naturalWidth, image.value.naturalHeight) / zoom.value;
  return { size, x: (image.value.naturalWidth - size) * horizontal.value / 100,
    y: (image.value.naturalHeight - size) * vertical.value / 100 };
});
const previewStyle = computed(() => {
  if (!crop.value) return {};
  const { size, x, y } = crop.value;
  return { width: `${image.value.naturalWidth / size * 100}%`, maxWidth: 'none',
    left: `${-x / size * 100}%`, top: `${-y / size * 100}%` };
});
function reset() {
  selection++; loading.value = false;
  source.value = ''; image.value = null; error.value = ''; removed.value = false;
}
async function edit(src) {
  const current = ++selection;
  loading.value = true;
  error.value = ''; image.value = null;
  try {
    const loaded = new Image();
    await new Promise((resolve, reject) => { loaded.onload = resolve; loaded.onerror = reject; loaded.src = src; });
    if (current !== selection) return;
    image.value = loaded; source.value = src; removed.value = false;
    zoom.value = 1; horizontal.value = vertical.value = 50;
  } catch {
    if (current === selection) error.value = 'Das Foto konnte nicht gelesen werden. Wähle ein anderes Bild oder brich die Änderung ab.';
  } finally { if (current === selection) loading.value = false; }
}
async function select(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const current = ++selection;
  loading.value = true;
  error.value = ''; image.value = null;
  try {
    const src = await readPhoto(file);
    if (current === selection) await edit(src);
  } catch (cause) { if (current === selection) error.value = cause.message; }
  finally { if (current === selection) loading.value = false; }
}
async function getPhoto() {
  if (loading.value) throw new Error('Das Foto wird geladen. Warte kurz und speichere erneut.');
  if (error.value) throw new Error(error.value);
  if (removed.value) return '';
  if (!crop.value) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(512, Math.max(1, Math.round(crop.value.size)));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Bildverarbeitung nicht verfügbar.');
  const { x, y, size } = crop.value;
  context.drawImage(image.value, x, y, size, size, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Das Foto konnte nicht gespeichert werden.');
  return readPhoto(blob);
}
defineExpose({ getPhoto, reset });
</script>

<template>
  <fieldset class="my-4 min-w-0 border-0 p-0" :disabled="disabled">
    <legend class="mb-2 text-[13px] font-bold">Profilfoto</legend>
    <label class="grid gap-2 text-[13px]">{{ photo ? 'Anderes Bild auswählen' : 'Bild auswählen' }}
      <input type="file" accept="image/jpeg,image/png,image/webp" @change="select">
    </label>
    <div v-if="image" class="mt-4 grid max-w-sm gap-3">
      <div class="relative mx-auto size-48 overflow-hidden rounded-full bg-wash" role="img" aria-label="Vorschau des Profilfoto-Ausschnitts">
        <img :src="source" alt="" class="absolute" :style="previewStyle">
      </div>
      <p class="text-[13px] text-muted">Wähle den Bildausschnitt mit den Reglern. Er wird mit dem Profil gespeichert.</p>
      <label class="grid gap-1 text-[13px]">Vergrösserung<input v-model.number="zoom" type="range" min="1" max="4" step="0.01"></label>
      <label class="grid gap-1 text-[13px]">Horizontaler Ausschnitt<input v-model.number="horizontal" type="range" min="0" max="100"></label>
      <label class="grid gap-1 text-[13px]">Vertikaler Ausschnitt<input v-model.number="vertical" type="range" min="0" max="100"></label>
    </div>
    <p v-if="error" role="alert" class="text-[13px] text-danger">{{ error }}</p>
    <p v-if="removed" class="text-[13px] text-muted">Das Foto wird beim Speichern entfernt.</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <AppButton v-if="photo && !image && !removed" variant="soft" @click="edit(photo)">Ausschnitt bearbeiten</AppButton>
      <AppButton v-if="(photo || image) && !removed" variant="plain" @click="reset(); removed = true">Foto entfernen</AppButton>
      <AppButton v-if="image || error || removed" variant="plain" @click="reset">Änderung abbrechen</AppButton>
    </div>
  </fieldset>
</template>
