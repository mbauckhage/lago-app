<script setup>
import Icon from '../../Icon.vue';
defineProps({ active: Boolean, icon: String });
</script>

<template>
  <button type="button" :aria-current="active ? 'page' : undefined"
    class="relative isolate grid min-h-12 min-w-19 justify-items-center gap-[3px] px-2.5 py-1.5 text-[11px] font-semibold text-muted aria-[current=page]:font-bold aria-[current=page]:text-brand before:absolute before:top-px before:-z-10 before:h-7 before:w-13 before:rounded-3xl aria-[current=page]:before:bg-wash">
    <Icon :name="icon" /><slot />
  </button>
</template>
