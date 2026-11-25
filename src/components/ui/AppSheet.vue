<script setup>
import { ref } from 'vue';
import AppButton from './AppButton.vue';
import Icon from '../../Icon.vue';
const props = defineProps({ verticalScrollOnly: Boolean });
function preventZoom(event) {
  if (props.verticalScrollOnly && event.cancelable && (event.type === 'gesturestart' || event.touches.length > 1)) {
    event.preventDefault();
  }
}
const element = ref(null);
defineExpose({
  get open() { return element.value?.open ?? false; },
  showModal: () => element.value.showModal(),
  close: () => element.value.close(),
  querySelector: selector => element.value.querySelector(selector)
});
</script>

<template>
  <dialog ref="element" :class="{ 'vertical-scroll-only': verticalScrollOnly }"
    @gesturestart="preventZoom" @touchstart="preventZoom" class="open:animate-sheet-enter motion-reduce:animate-none m-auto max-h-[90dvh] w-[min(calc(100%-32px),530px)] max-w-none overscroll-contain rounded-[23px] border-0 bg-surface px-[22px] pt-[19px] pb-6 text-ink shadow-[0_12px_36px_#0006] backdrop:bg-[#0009] max-[600px]:inset-x-0 max-[600px]:top-auto max-[600px]:bottom-0 max-[600px]:m-0 max-[600px]:w-full max-[600px]:rounded-b-none max-[600px]:pb-[max(24px,env(safe-area-inset-bottom))] [&>img]:h-[200px] [&>img]:rounded-[14px] [&_p_.bg-danger-wash]:ml-2" aria-labelledby="sheet-title">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h2 id="sheet-title" class="text-[23px] font-bold tracking-[-.03em] wrap-anywhere"><slot name="title" /></h2>
      <AppButton variant="icon" aria-label="Schliessen" @click="element.close()"><Icon name="close" /></AppButton>
    </div>
    <slot />
  </dialog>
</template>

<style>
dialog.vertical-scroll-only {
  overflow-x: hidden;
  overflow-y: auto;
}
dialog.vertical-scroll-only,
dialog.vertical-scroll-only::backdrop,
dialog.vertical-scroll-only * {
  touch-action: pan-y;
}
</style>
