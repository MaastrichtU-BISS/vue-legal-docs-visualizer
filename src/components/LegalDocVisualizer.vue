<template>
    <div class="legal-doc-visualizer">
        <div v-if="availableViews.length > 1" class="mode-switcher">
            <Button 
                v-for="view in availableViews"
                :key="view"
                :icon="view === 'documents' ? 'pi pi-table' : 'pi pi-share-alt'"
                :label="view === 'documents' ? 'Documents' : 'Graph'"
                :class="{ active: currentMode === viewMode(view) }"
                @click="currentMode = viewMode(view)"
                severity="secondary"
            />
        </div>

        <div class="content">
            <KeepAlive>
                <component
                    :is="currentMode === VisualizationMode.TABLE ? Table : Graph"
                    ref="currentComponentRef"
                    :graph="documentSet"
                    :config="activeConfig"
                    :docs="docs"
                    :edges="edges"
                    @doc-click="handleDocClick"
                    @cluster-click="handleClusterClick"
                    class="visualization-container"
                >
                    <template v-for="(_, name) in viewSlots" #[name]="slotProps">
                        <slot :name="name" v-bind="slotProps || {}" />
                    </template>
                </component>
            </KeepAlive>
        </div>

        <DocumentInfo :node="selectedNode" :graph="documentSet" :config="activeConfig" v-model:visible="drawerVisible"
            :selected-segment-ids="selectedSegmentIds"
            @citation-click="handleCitationClick" @segment-select="handleSegmentSelect">
            <template v-for="(_, name) in documentSlots" #[name]="slotProps">
                <slot :name="name" v-bind="slotProps || {}" />
            </template>
        </DocumentInfo>

        <ClusterPreview :nodes="selectedClusterNodes" :graph="documentSet" :config="activeConfig" v-model:visible="clusterModalVisible">
            <template v-for="(_, name) in clusterSlots" #[name]="slotProps">
                <slot :name="name" v-bind="slotProps || {}" />
            </template>
        </ClusterPreview>
    </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, watch, useSlots } from 'vue'
import type { LegalDocument, LegalEdge } from './types'
import Button from 'primevue/button'
import Table from './Table.vue'
import DocumentInfo from './DocumentInfo.vue'
import ClusterPreview from './ClusterPreview.vue'
import { VisualizationMode, isEchrDocument } from './types'
import Graph from './Graph.vue'
import 'primeicons/primeicons.css'
import {
  caseLawConfig,
  echrConfig,
  documentSetFromLegalDocs,
  resolveVisualizerConfig,
  type DocumentSetV1,
  type GraphNode,
  type VisualizerConfig,
} from '../config'

export interface Props {
    docs?: LegalDocument[]
    edges?: LegalEdge[]
    /** Canonical input. When absent, `docs`/`edges` are adapted. */
    graph?: DocumentSetV1
    /** A preset id or a full config. Defaults to case-law/ECHR by dataset. */
    config?: VisualizerConfig | string
    /**
     * The host's selected segments, when it owns the selection.
     *
     * The host keeps the set (the annotation step needs all of it, not the
     * last toggle) and passes it back, so the panel renders exactly what the
     * host has. Without it the panel keeps its own state.
     */
    selectedSegmentIds?: string[]
}

const props = defineProps<Props>();

const documentSet = computed<DocumentSetV1>(
    () => props.graph ?? documentSetFromLegalDocs(props.docs ?? [], props.edges ?? []),
)

const activeConfig = computed<VisualizerConfig>(() => {
    const resolved = resolveVisualizerConfig(props.config)
    if (resolved) return resolved
    const first = props.docs?.[0]
    return first && isEchrDocument(first) ? echrConfig : caseLawConfig
})

// The views the host configured at import time. Empty/absent keeps the
// historical behavior: both the documents (table) and graph views.
const availableViews = computed<('documents' | 'graph')[]>(() => {
    const views = activeConfig.value.views
    return views && views.length > 0 ? views : ['documents', 'graph']
})

function viewMode(view: 'documents' | 'graph'): VisualizationMode {
    return view === 'documents' ? VisualizationMode.TABLE : VisualizationMode.GRAPH
}

// Slot passthrough: hosts override cells (`cell-*`, `node-*`), the details
// panel (`document-*`, `details-extra`) and the cluster preview
// (`cluster-*`, default) without forking the components.
const slots = useSlots()
type SlotFn = (slotProps?: Record<string, unknown>) => unknown

function pickSlots(predicate: (name: string) => boolean): Record<string, SlotFn> {
    const out: Record<string, SlotFn> = {}
    for (const [name, fn] of Object.entries(slots)) {
        if (fn && predicate(name)) out[name] = fn as SlotFn
    }
    return out
}

const viewSlots = computed(() => pickSlots((name) => name.startsWith('cell') || name.startsWith('node')))
const documentSlots = computed(() => pickSlots((name) => name.startsWith('document') || name === 'details-extra'))
const clusterSlots = computed(() => pickSlots((name) => name.startsWith('cluster') || name === 'default'))

const selectedNode = ref<GraphNode | null>(null)
const drawerVisible = ref(false)
const selectedClusterNodes = ref<GraphNode[]>([])
const clusterModalVisible = ref(false)
const currentMode = ref(VisualizationMode.TABLE)

// A view can never be switched away from into a view the config excludes
// (import-time config is authoritative): snap currentMode into the allowed set.
watch(availableViews, (views) => {
    const allowed = views.map(viewMode)
    if (!allowed.includes(currentMode.value)) currentMode.value = allowed[0]
}, { immediate: true, deep: false })
const currentComponentRef = ref<InstanceType<typeof Graph> | InstanceType<typeof Table> | null>(null)

const emit = defineEmits<{
    'segment-select': [payload: { nodeId: string; segmentId: string; selected: boolean }]
}>()

function handleSegmentSelect(payload: { nodeId: string; segmentId: string; selected: boolean }) {
    emit('segment-select', payload)
}

const refGraphComponent = computed(() => {
  return currentMode.value === VisualizationMode.GRAPH ? currentComponentRef.value as InstanceType<typeof Graph> : null
})

const refTableComponent = computed(() => {
  return currentMode.value === VisualizationMode.TABLE ? currentComponentRef.value as InstanceType<typeof Table> : null
})

const handleDocClick = async (id: string) => {
  const node = documentSet.value.nodes.find((n) => n.id === id)
  if (!node) return

  // If drawer is already open, close it briefly to ensure proper update
  if (drawerVisible.value) {
    drawerVisible.value = false
    await nextTick()
  }
  selectedNode.value = node
  await nextTick()
  drawerVisible.value = true
}

const handleClusterClick = async (payload: { clusterId: string; documents: GraphNode[] }) => {
  if (clusterModalVisible.value) {
    clusterModalVisible.value = false
    await nextTick()
  }
  selectedClusterNodes.value = payload.documents
  await nextTick()
  clusterModalVisible.value = true
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

<style>
/* Non-scoped to apply font-family globally within component */
.legal-doc-visualizer {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.legal-doc-visualizer {
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
    min-height: 38rem;
}
</style>
