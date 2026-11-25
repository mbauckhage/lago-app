<script setup>
defineProps({ count: Number });
</script>

<template>
  <span v-if="count" class="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand" :aria-label="count + ' ungelesen'">{{ count }}</span>
</template>
