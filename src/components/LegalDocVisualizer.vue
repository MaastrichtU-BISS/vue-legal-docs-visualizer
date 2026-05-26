<template>
    <div class="legal-doc-visualizer">
        <div class="mode-switcher">
            <button 
                :class="['mode-btn', { active: currentMode === VisualizationMode.TABLE }]"
                @click="currentMode = VisualizationMode.TABLE"
            >
                Table
            </button>
            <button 
                :class="['mode-btn', { active: currentMode === VisualizationMode.GRAPH }]"
                @click="currentMode = VisualizationMode.GRAPH"
            >
                Graph
            </button>
        </div>

        <div class="content">
            <div v-if="currentMode === VisualizationMode.TABLE" class="visualization-container">
                <Table ref="refTableComponent" :docs="docs" @row-click="handleDocClick" />
            </div>
            <div v-else-if="currentMode === VisualizationMode.GRAPH" class="visualization-container">
                <Graph ref="refGraphComponent" :docs="docs" @node-click="handleDocClick" />
            </div>
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
import 'primeicons/primeicons.css'

export interface Props {
    docs?: LegalDocument[]
}

const props = defineProps<Props>();

const selectedDocument = ref<any>(null)
const drawerVisible = ref(false)
const currentMode = ref(VisualizationMode.TABLE)
const refGraphComponent = ref<InstanceType<typeof Graph> | null>(null)
const refTableComponent = ref<InstanceType<typeof Table> | null>(null);

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
