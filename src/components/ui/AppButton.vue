<script setup>
defineProps({ variant: { type: String, default: 'primary' }, type: { type: String, default: 'button' } });
const variants = {
  primary: 'bg-brand text-white',
  soft: 'bg-wash text-brand',
  plain: 'text-muted',
  icon: 'w-11 shrink-0 bg-wash text-brand !px-0',
  danger: 'bg-danger text-white',
  'danger-plain': 'text-danger'
};
</script>

<template>
  <button :type="type" :class="[variants[variant], 'min-h-11 rounded-xl px-[13px] text-[13px] font-bold aria-pressed:bg-brand aria-pressed:text-white']"><slot /></button>
</template>
