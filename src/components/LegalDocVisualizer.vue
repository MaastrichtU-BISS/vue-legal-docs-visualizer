<template>
    <div class="legal-doc-visualizer">
        <div class="mode-switcher">
            <Button 
                icon="pi pi-table"
                label="Table"
                :class="{ active: currentMode === VisualizationMode.TABLE }"
                @click="currentMode = VisualizationMode.TABLE"
                severity="secondary"
            />
            <Button 
                icon="pi pi-share-alt"
                label="Graph"
                :class="{ active: currentMode === VisualizationMode.GRAPH }"
                @click="currentMode = VisualizationMode.GRAPH"
                severity="secondary"
            />
        </div>

        <div class="content">
            <KeepAlive>
                <component 
                    :is="currentMode === VisualizationMode.TABLE ? Table : Graph"
                    ref="currentComponentRef"
                    :docs="docs"
                    @doc-click="handleDocClick"
                    class="visualization-container"
                />
            </KeepAlive>
        </div>

        <DocumentInfo :document="selectedDocument" :docs="docs" v-model:visible="drawerVisible"
            @citation-click="handleCitationClick" />
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import type { LegalDocument } from 'legal-docs-client'
import Button from 'primevue/button'
import Table from './Table.vue'
import DocumentInfo from './DocumentInfo.vue'
import { VisualizationMode } from './types'
import Graph from './Graph.vue'
import 'primeicons/primeicons.css'

export interface Props {
    docs?: LegalDocument[]
}

const props = defineProps<Props>();

const selectedDocument = ref<LegalDocument | null>(null)
const drawerVisible = ref(false)
const currentMode = ref(VisualizationMode.TABLE)
const currentComponentRef = ref<InstanceType<typeof Graph> | InstanceType<typeof Table> | null>(null)

const refGraphComponent = computed(() => {
    return currentMode.value === VisualizationMode.GRAPH ? currentComponentRef.value as InstanceType<typeof Graph> : null
})

const refTableComponent = computed(() => {
    return currentMode.value === VisualizationMode.TABLE ? currentComponentRef.value as InstanceType<typeof Table> : null
})

const handleDocClick = async (id: string) => {
    const doc = props.docs?.find(d => d.id === id)
    if (!doc) return

    // If drawer is already open, close it briefly to ensure proper update
    if (drawerVisible.value) {
        drawerVisible.value = false
        await nextTick()
    }
    selectedDocument.value = doc
    await nextTick()
    drawerVisible.value = true
}

const handleCitationClick = async (id: string) => {
    handleDocClick(id)

    switch(currentMode.value) {
        case VisualizationMode.TABLE:
            refTableComponent.value?.highlightRowById(id)
            break
        case VisualizationMode.GRAPH:
            refGraphComponent.value?.highlightNodeById(id)
            break
        default:
            break
    }
}

</script>

<style scoped>
.legal-doc-visualizer {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.mode-switcher {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid #dee2e6;
    background-color: #f8f9fa;
    justify-content: center;
}

.mode-switcher :deep(.p-button) {
    padding: 8px 16px;
}

.mode-switcher .active {
    background-color: #3498db !important;
    color: white !important;
    border-color: #3498db !important;
}

.mode-switcher .active :deep(.p-button-label) {
    color: white !important;
}

.mode-btn {
    padding: 6px 16px;
    border: 1px solid #dee2e6;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #495057;
    transition: all 0.2s ease;
}

.mode-btn:hover {
    background-color: #f8f9fa;
    border-color: #adb5bd;
}

.mode-btn.active {
    background-color: #3498db;
    color: white;
    border-color: #3498db;
}

.content {
    margin-top: 10px;
    flex: 1;
    overflow: hidden;
}

.visualization-container {
    width: 100%;
    height: 100%;
}
</style>
