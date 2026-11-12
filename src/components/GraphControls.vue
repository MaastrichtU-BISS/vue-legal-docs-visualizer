<template>
  <div class="graph-controls">
    <Button icon="pi pi-minus" severity="secondary" size="small" rounded title="Zoom Out" aria-label="Zoom Out" @click="emit('zoomOut')" />
    <Button icon="pi pi-plus" severity="secondary" size="small" rounded title="Zoom In" aria-label="Zoom In" @click="emit('zoomIn')" />
    <Button icon="pi pi-arrows-alt" severity="secondary" size="small" rounded title="Fit to View" aria-label="Fit to View" @click="emit('fit')" />
    <!-- Buttons only some graphs have (such as expanding clusters). -->
    <slot />
  </div>
</template>

<script lang="ts" setup>
import Button from 'primevue/button'

// The zoom / fit buttons floating over a graph's top-right corner. They only
// announce what was asked; graph/viewport.ts does it.
const emit = defineEmits<{ zoomIn: []; zoomOut: []; fit: [] }>()
</script>

<style scoped>
.graph-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  background-color: rgba(255, 255, 255, 0.95);
  padding: 6px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
  z-index: 10;
}

.graph-controls :deep(.p-button) {
  padding: 0.15rem 0.15rem;
}

.graph-controls :deep(.p-button-icon) {
  font-size: 10px;
}
</style>
