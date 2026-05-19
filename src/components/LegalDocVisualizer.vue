<template>
    <div class="legal-doc-visualizer">
        <div v-if="mode == VisualizationMode.TABLE">
            <Table :docs="docs" @row-click="handleRowClick" />
        </div>
        <div v-else-if="mode == VisualizationMode.GRAPH">
                <!-- Placeholder for graph visualization -->
                <p>Graph visualization coming soon...</p>
        </div>

        <DocumentInfo 
            :document="selectedDocument" 
            :docs="docs"
            v-model:visible="drawerVisible" 
            @citation-click="handleCitationClick"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { LegalDocument } from 'legal-docs-client'
import Table from './Table.vue'
import DocumentInfo from './DocumentInfo.vue'
import { VisualizationMode } from './types'

export interface Props {
    docs?: LegalDocument[]
    mode?: VisualizationMode
}

const props = defineProps<Props>();

const selectedDocument = ref<any>(null)
const drawerVisible = ref(false)

const handleRowClick = (doc: any) => {
    selectedDocument.value = doc
    drawerVisible.value = true
}

const handleCitationClick = (ecli: string) => {
    const doc = props.docs?.find(d => d.id === ecli)
    if (doc) {
        selectedDocument.value = doc
    }
}

</script>

<style scoped>
.legal-doc-visualizer {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
}
</style>
