<template>
    <div class="legal-doc-visualizer">
        <div v-if="mode == VisualizationMode.TABLE">
            <Table :docs="docs" @row-click="handleDocClick" />
        </div>
        <div v-else-if="mode == VisualizationMode.GRAPH">
            <Graph :docs="docs" @node-click="handleDocClick" />
        </div>

        <DocumentInfo :document="selectedDocument" :docs="docs" v-model:visible="drawerVisible"
            @citation-click="handleCitationClick" />
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { LegalDocument } from 'legal-docs-client'
import Table from './Table.vue'
import DocumentInfo from './DocumentInfo.vue'
import { VisualizationMode } from './types'
import Graph from './Graph.vue'

export interface Props {
    docs?: LegalDocument[]
    mode?: VisualizationMode
}

const props = defineProps<Props>();

const selectedDocument = ref<any>(null)
const drawerVisible = ref(false)

const handleDocClick = async (doc: any) => {
    // If drawer is already open, close it briefly to ensure proper update
    if (drawerVisible.value) {
        drawerVisible.value = false
        await nextTick()
    }
    selectedDocument.value = doc
    await nextTick()
    drawerVisible.value = true
}

const handleCitationClick = async (ecli: string) => {
    const doc = props.docs?.find(d => d.id === ecli)
    if (doc) {
        // If drawer is already open, close it briefly to ensure proper update
        if (drawerVisible.value) {
            drawerVisible.value = false
            await nextTick()
        }
        selectedDocument.value = doc
        await nextTick()
        drawerVisible.value = true
    }
}

</script>

<style scoped>
.legal-doc-visualizer {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
}
</style>
