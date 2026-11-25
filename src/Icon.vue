<script setup>
defineProps({ name: String });
const icons = {
  chat:'M20 14a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3zM8 8h8m-8 4h5',
  send:'m4 11 16-7-6 16-3-7-7-2zm7 2 9-9',
  share:'M12 15V3m-4 4 4-4 4 4M8 10H5v11h14V10h-3',
  menu:'M12 5h.01M12 12h.01M12 19h.01',
  image:'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M16 8h.01',
  plus:'M12 5v14M5 12h14', feed:'M4 4h16v16H4zM4 9h16m-12 4h8m-8 3h5',
  calendar:'M4 6h16v14H4zM8 4v4m8-4v4M4 10h16m-12 4h1m3 0h1m3 0h1',
  crew:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  profile:'M4 20a8 8 0 0 1 16 0M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  check:'m5 12 4 4L19 6', close:'m6 6 12 12M18 6 6 18', maybe:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  next:'m9 5 7 7-7 7', prev:'m15 5-7 7 7 7', pin:'M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'
};
</script>

<template>
  <svg class="inline-block size-[21px] shrink-0 fill-none stroke-current stroke-[1.75] align-middle [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 24 24" aria-hidden="true"><path :d="icons[name]" /></svg>
</template>
