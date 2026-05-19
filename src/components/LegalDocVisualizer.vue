<template>
    <div>{{ docs?.length }}</div>
</template>

<script setup lang="ts">
import type { LegalDocument } from 'legal-docs-client'
export interface Props {
  docs?: LegalDocument[]
}

defineProps<Props>();

</script>

<style scoped>

</style>
