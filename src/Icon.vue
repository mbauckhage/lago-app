<script setup>
defineProps({ name: String });
const icons = {
  plus:'M12 5v14M5 12h14', feed:'M4 4h16v16H4zM4 9h16m-12 4h8m-8 3h5',
  calendar:'M4 6h16v14H4zM8 4v4m8-4v4M4 10h16m-12 4h1m3 0h1m3 0h1',
  profile:'M4 20a8 8 0 0 1 16 0M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  check:'m5 12 4 4L19 6', close:'m6 6 12 12M18 6 6 18', maybe:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  next:'m9 5 7 7-7 7', prev:'m15 5-7 7 7 7', pin:'M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'
};
</script>

<template>
  <svg class="inline-block size-[21px] shrink-0 fill-none stroke-current stroke-[1.75] align-middle [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24" aria-hidden="true"><path :d="icons[name]" /></svg>
</template>
