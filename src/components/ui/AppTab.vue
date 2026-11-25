<script setup>
import Icon from '../../Icon.vue';
defineProps({ active: Boolean, icon: String });
</script>

<template>
  <button type="button" :aria-current="active ? 'page' : undefined"
    class="relative isolate grid min-h-12 min-w-0 flex-1 justify-items-center gap-[3px] whitespace-nowrap px-1.5 py-1.5 text-[11px] font-semibold text-muted aria-[current=page]:font-bold aria-[current=page]:text-on-wash before:absolute before:top-px before:-z-10 before:h-7 before:w-13 before:rounded-3xl aria-[current=page]:before:bg-wash max-[360px]:text-[10px] sm:flex-none sm:min-w-19 sm:px-2.5">
    <Icon :name="icon" /><slot />
  </button>
</template>
