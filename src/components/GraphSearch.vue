<template>
  <div class="graph-search">
    <IconField>
      <InputIcon>
        <i class="pi pi-search" />
      </InputIcon>
      <InputText
        :model-value="modelValue"
        placeholder="Search..."
        @update:model-value="onInput"
      />
    </IconField>
  </div>
</template>

<script lang="ts" setup>
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

// The search box floating over a graph's top-left corner. It only holds the
// text; what matching nodes do (hide the others, say) is up to the graph.
defineProps<{ modelValue: string }>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** The text changed (after `update:modelValue`, so the parent already has it). */
  search: []
}>()

const onInput = (value: string | undefined) => {
  emit('update:modelValue', value ?? '')
  emit('search')
}
</script>

<style scoped>
.graph-search {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.95);
  padding: 6px 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
}

.graph-search :deep(.p-iconfield) {
  width: 220px;
}

/* An input is wider than its parent unless told otherwise, which let it stick
   out of the white card. */
.graph-search :deep(.p-inputtext) {
  width: 100%;
  box-sizing: border-box;
}
</style>
