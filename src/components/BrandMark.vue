<script setup lang="ts">
withDefaults(defineProps<{ size?: "small" | "medium" }>(), { size: "medium" })
</script>

<template>
  <div
    class="brand"
    :class="size"
    role="img"
    aria-label="Bean Bazaar"
  >
    <span
      class="word"
      aria-hidden="true"
    >Bean Bazaar</span>
  </div>
</template>

<style scoped>
.brand { display: inline-flex; align-items: center; }

/* The same gold-on-ink lettering as the names printed on the cards. */
.word {
  font-family: "Fraunces", serif;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  color: var(--gold);
  -webkit-text-stroke: var(--stroke) var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 var(--lift) 0 var(--ink);
}

.medium { --stroke: 7px; --lift: 4px; }
.medium .word { font-size: 50px; }

.small { --stroke: 5px; --lift: 2px; }
.small .word { font-size: 22px; }
</style>
