<script setup>
defineProps({ name: { type: String, required: true }, photo: String, large: Boolean });
const initials = name => name.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
</script>

<template>
  <component :is="photo ? 'img' : 'span'" :src="photo || undefined" :alt="photo ? '' : undefined" :aria-hidden="photo ? undefined : true"
    class="inline-grid shrink-0 place-items-center rounded-full bg-wash object-cover font-bold text-brand"
    :class="large ? 'size-[66px] text-[22px]' : 'size-[33px] text-xs'">{{ photo ? undefined : initials(name) }}</component>
</template>
