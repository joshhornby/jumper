<script setup lang="ts">
import { useData, withBase } from "vitepress";
import { computed, ref } from "vue";

const COPY = "Copy as Markdown";
const { page } = useData();
const href = computed(() => withBase(`/${page.value.relativePath}`));
const label = ref(COPY);

async function copy(): Promise<void> {
  try {
    const response = await fetch(href.value);
    await navigator.clipboard.writeText(await response.text());
    label.value = "Copied";
  } catch {
    label.value = "Copy failed";
  }
  setTimeout(() => {
    label.value = COPY;
  }, 1500);
}
</script>

<template>
  <div class="page-actions">
    <button type="button" @click="copy">{{ label }}</button>
    <a :href="href" target="_blank" rel="noopener">View as Markdown</a>
  </div>
</template>
