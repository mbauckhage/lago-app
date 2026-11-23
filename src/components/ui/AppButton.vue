<script setup>
defineProps({ variant: { type: String, default: 'primary' }, type: { type: String, default: 'button' } });
const variants = {
  primary: 'bg-brand text-on-brand',
  soft: 'bg-control text-ink',
  plain: 'text-muted',
  icon: 'w-11 shrink-0 bg-wash text-on-wash !px-0',
  danger: 'bg-danger text-on-brand',
  'danger-plain': 'text-danger'
};
</script>

<template>
  <button :type="type" :class="[variants[variant], 'min-h-11 rounded-xl px-[13px] text-[13px] font-bold aria-pressed:bg-brand aria-pressed:text-on-brand']"><slot /></button>
</template>
