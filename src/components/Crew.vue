<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import AppAvatar from './ui/AppAvatar.vue';

const props = defineProps({
  members: { type: Array, default: () => [] },
  scrollRoot: { type: Object, default: null }
});
const emit = defineEmits(['open']);
const players = computed(() => [...props.members].sort((a, b) => a.name.localeCompare(b.name, 'de-CH')));
const visibleCount = ref(12);
const visibleMembers = computed(() => players.value.slice(0, visibleCount.value));
const sentinel = ref(null);
let observer;

function showMore() {
  visibleCount.value = Math.min(visibleCount.value + 12, players.value.length);
}

function watchSentinel(node, previous) {
  if (!observer) return;
  if (previous) observer.unobserve(previous);
  if (node) observer.observe(node);
}

onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    visibleCount.value = players.value.length;
    return;
  }
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) showMore();
  }, { root: props.scrollRoot, rootMargin: '240px 0px' });
  watchSentinel(sentinel.value, null);
});

onUnmounted(() => observer?.disconnect());
watch(sentinel, watchSentinel, { flush: 'post' });
watch(() => props.members.length, () => { visibleCount.value = 12; });
</script>

<template>
  <section aria-label="Crew">
    <div class="mb-4 flex items-end justify-between gap-3">
      <h1 class="m-0">Crew</h1>
      <span class="pb-1 text-sm text-muted">{{ players.length }} {{ players.length === 1 ? 'Mitglied' : 'Mitglieder' }}</span>
    </div>

    <div v-if="players.length" class="grid grid-cols-2 gap-3 sm:gap-4">
      <button v-for="person in visibleMembers" :key="person.id" type="button"
        class="group min-w-0 overflow-hidden rounded-2xl border border-line bg-panel text-left transition-colors hover:bg-control"
        :aria-label="'Profil von ' + person.name" @click="emit('open', person)">
        <div class="relative aspect-[4/3] overflow-hidden bg-wash">
          <img v-if="person.photo" :src="person.photo" alt="" loading="lazy" class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]">
          <div v-else class="grid size-full place-items-center bg-gradient-to-br from-wash to-panel" aria-hidden="true">
            <AppAvatar :name="person.name" class="!size-16 text-xl sm:!size-20 sm:text-2xl" />
          </div>
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent"></div>
        </div>
        <div class="flex min-h-[58px] items-center gap-2.5 px-3 py-2.5 sm:min-h-[66px] sm:px-4">
          <AppAvatar :name="person.name" :photo="person.photo" />
          <strong class="min-w-0 break-words text-sm leading-snug sm:text-base">{{ person.name }}</strong>
        </div>
      </button>
    </div>

    <div v-if="visibleCount < players.length" ref="sentinel" class="h-8" aria-hidden="true"></div>

    <p v-if="!players.length" class="rounded-xl bg-wash px-4 py-3.5 text-sm leading-[1.45] text-on-wash" role="status">
      Sobald Mitglieder freigegeben sind, erscheinen sie hier.
    </p>
  </section>
</template>
