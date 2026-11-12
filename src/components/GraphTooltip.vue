<template>
  <div ref="root" class="graph-tooltip">
    <div class="graph-tooltip-arrow"></div>
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

// The box of a node's hover tooltip: the frame and arrow, with what it says in
// the default slot. Placed over the node by createNodeTooltip (graph/nodeTooltip),
// which needs the element: `root`.
const root = ref<HTMLElement | null>(null)
defineExpose({ root })
</script>

<style scoped>
.graph-tooltip {
  display: none;
  background-color: white;
  color: #2c3e50;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 11px;
  max-width: 300px;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
  opacity: 0;
  transition: opacity 0.15s ease;
  position: relative;
  overflow: visible;
}

.graph-tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}

.graph-tooltip[data-popper-placement^='bottom'] .graph-tooltip-arrow {
  top: -8px;
  bottom: auto;
  border-top-color: transparent;
  border-bottom: 8px solid white;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
}
</style>
