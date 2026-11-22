<script setup>
defineProps({ checkbox: Boolean });
</script>

<template>
  <label :class="checkbox ? 'm-0 flex min-h-11 items-center gap-[9px] text-[13px] font-semibold [&_input]:size-[19px] [&_input]:accent-brand' : 'my-3 grid gap-1.5 text-[13px] font-bold [&_input]:min-h-11 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-[11px] [&_input]:border [&_input]:border-line [&_input]:bg-panel [&_input]:px-[11px] [&_input]:py-2.5 [&_input]:text-base [&_input[type=file]]:bg-surface [&_textarea]:min-h-11 [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:resize-y [&_textarea]:rounded-[11px] [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-panel [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-base'">
    <slot />
  </label>
</template>
