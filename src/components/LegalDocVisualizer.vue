<template>
    <div>
        <div v-if="mode == VisualizationMode.TABLE">
            <Table :docs="docs" @row-click="handleRowClick" />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { LegalDocument } from 'legal-docs-client'
import Table from './Table.vue'
import { VisualizationMode } from './types'
export interface Props {
    docs?: LegalDocument[]
    mode?: VisualizationMode
}

defineProps<Props>();

const handleRowClick = (doc: any) => {
    console.log('Clicked document:', doc)
}

</script>

<style scoped></style>
