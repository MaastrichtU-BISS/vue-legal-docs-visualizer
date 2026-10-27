<template>
    <Drawer v-model:visible="isVisible" position="right" :modal="false" class="document-drawer" :style="{ width: '400px' }">
        <template #header>
            <div class="drawer-header">
                <h2>{{ entityLabel }} Details</h2>
            </div>
        </template>

        <div v-if="activeNode" class="document-content">
            <!-- Identifier -->
            <div class="info-section">
                <h3 class="section-title">Identifier</h3>
                <div class="info-field">
                    <span class="field-label">{{ idLabel }}:</span>
                    <span class="field-value">{{ activeNode.id }}</span>
                </div>
            </div>

            <!-- Configured details -->
            <div class="info-section" v-if="visibleDetails.length > 0">
                <h3 class="section-title">Basic Information</h3>
                <div class="info-field" v-for="detail in visibleDetails" :key="detail.label + detail.field">
                    <span class="field-label">{{ detail.label }}:</span>
                    <a v-if="detail.type === 'link'" :href="detailHref(detail)" target="_blank" class="publication-link">
                        {{ detailDisplay(detail) }} <i class="pi pi-external-link"></i>
                    </a>
                    <span v-else class="field-value">{{ detailDisplay(detail) }}</span>
                </div>
            </div>

            <!-- Summary -->
            <div class="info-section" v-if="summary">
                <h3 class="section-title">Summary</h3>
                <p class="summary-text">{{ summary }}</p>
            </div>

            <!-- Segments (provisions), overridable via the `segments` slot -->
            <slot
                v-if="segments.length > 0"
                name="segments"
                :segments="segments"
                :node="activeNode"
                :selected="selectedSegmentIds"
            >
                <div class="info-section">
                    <h3 class="section-title">Segments ({{ segments.length }})</h3>
                    <ul class="segment-list">
                        <li
                            v-for="segment in segments"
                            :key="segment.id"
                            class="segment-item"
                            :class="{ selected: selectedSegmentIds.has(segment.id) }"
                            @click="toggleSegment(segment)"
                        >
                            <span class="segment-check" aria-hidden="true">
                                <i :class="selectedSegmentIds.has(segment.id) ? 'pi pi-check-circle' : 'pi pi-circle'" />
                            </span>
                            <span class="segment-text">{{ segment.text }}</span>
                        </li>
                    </ul>
                </div>
            </slot>

            <!-- Host extra content -->
            <slot name="details-extra" :node="activeNode" :config="activeConfig" />

            <!-- Statistics -->
            <div class="info-section" v-if="statistics">
                <h3 class="section-title">Statistics</h3>
                <div class="stats-list">
                    <div class="info-field" v-for="(value, key) in statistics" :key="key">
                        <template v-if="key != 'parent'">
                            <span class="field-label">{{ formatStatKey(String(key)) }}:</span>
                            <span class="field-value">{{ formatStatValue(value) }}</span>
                        </template>
                    </div>
                </div>
            </div>

            <!-- Citations -->
            <div class="info-section" v-if="documentCites.length > 0">
                <h3 class="section-title">Cites ({{ documentCites.length }})</h3>
                <ul class="citation-list">
                    <li v-for="(cite, index) in documentCites" :key="index">
                        <span v-if="isNodeInGraph(cite)" class="citation-link" @click="handleCitationClick(cite)">
                            {{ cite }}
                        </span>
                        <span v-else class="citation-text">
                            {{ cite }}
                        </span>
                    </li>
                </ul>
            </div>

            <!-- Cited By -->
            <div class="info-section" v-if="documentCitedBy.length > 0">
                <h3 class="section-title">Cited By ({{ documentCitedBy.length }})</h3>
                <ul class="citation-list">
                    <li v-for="(cite, index) in documentCitedBy" :key="index">
                        <span v-if="isNodeInGraph(cite)" class="citation-link" @click="handleCitationClick(cite)">
                            {{ cite }}
                        </span>
                        <span v-else class="citation-text">
                            {{ cite }}
                        </span>
                    </li>
                </ul>
            </div>
        </div>
    </Drawer>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Drawer from 'primevue/drawer'
import type { LegalDocument, LegalEdge } from './types'
import {
  caseLawConfig,
  resolveVisualizerConfig,
  type DetailField,
  type DocumentSetV1,
  type GraphNode,
  type IRSegment,
  type VisualizerConfig,
} from '../config'

export interface Props {
    /** The selected node (canonical). */
    node?: GraphNode | null
    /** A preset id or a full config. Defaults to the case-law preset. */
    config?: VisualizerConfig | string
    /** The full graph, for citation lookup. */
    graph?: DocumentSetV1
    /** Legacy input, still supported. */
    document?: LegalDocument | null
    docs?: LegalDocument[]
    edges?: LegalEdge[]
    visible?: boolean
}

const props = defineProps<Props>()

const activeNode = computed<GraphNode | null>(() => {
    if (props.node) return props.node
    if (props.document) {
        return { id: String(props.document.id), data: (props.document.data ?? {}) as unknown as Record<string, unknown> }
    }
    return null
})

const activeConfig = computed<VisualizerConfig>(() => resolveVisualizerConfig(props.config) ?? caseLawConfig)
const entityLabel = computed(() => activeConfig.value.labels?.entity ?? 'Document')
const idLabel = computed(() => activeConfig.value.labels?.idLabel ?? 'ID')

const data = computed<Record<string, unknown>>(() => activeNode.value?.data ?? {})
const statistics = computed<Record<string, unknown> | undefined>(() => {
    const value = data.value.statistics
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
})
const summary = computed<string | undefined>(() => {
    const field = activeConfig.value.summaryField
    if (!field) return undefined
    const value = data.value[field]
    return value === undefined || value === null || value === '' ? undefined : String(value)
})

// Segments (provisions), as the IR adapter places them in node.data. The host
// selects segments for annotation; the panel keeps its own toggle state and
// reports every change through `segment-select`.
const segments = computed<IRSegment[]>(() => {
    const value = data.value.segments
    return Array.isArray(value) ? (value as IRSegment[]) : []
})

const selectedSegmentIds = ref<Set<string>>(new Set())

watch(() => activeNode.value?.id, () => {
    selectedSegmentIds.value = new Set()
})

function toggleSegment(segment: IRSegment) {
    const next = new Set(selectedSegmentIds.value)
    const selected = !next.has(segment.id)
    if (selected) next.add(segment.id)
    else next.delete(segment.id)
    selectedSegmentIds.value = next
    if (activeNode.value) {
        emit('segment-select', { nodeId: activeNode.value.id, segmentId: segment.id, selected })
    }
}

function detailValue(detail: DetailField): unknown {
    if (!activeNode.value) return undefined
    return detail.value ? detail.value(activeNode.value) : data.value[detail.field]
}

function hasDetail(detail: DetailField): boolean {
    const value = detailValue(detail)
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
}

const visibleDetails = computed(() => (activeConfig.value.details ?? []).filter(hasDetail))

function detailDisplay(detail: DetailField): string {
    const value = detailValue(detail)
    if (Array.isArray(value)) return value.join(', ')
    if (value === undefined || value === null || value === '') return ''
    return String(value)
}

function detailHref(detail: DetailField): string | undefined {
    const value = detailValue(detail)
    return typeof value === 'string' && value ? value : undefined
}

// Citation lists prefer the authoritative graph/edges; otherwise fall back to
// the node's own cites/cited_by (which ECHR nodes don't populate).
const documentCites = computed<string[]>(() => {
    const node = activeNode.value
    if (!node) return []
    if (props.graph) return props.graph.edges.filter((e) => e.source === node.id).map((e) => e.target)
    if (props.edges) return props.edges.filter((e) => e.source === node.id).map((e) => e.target)
    const cites = data.value.cites
    return Array.isArray(cites) ? (cites as string[]) : []
})

const documentCitedBy = computed<string[]>(() => {
    const node = activeNode.value
    if (!node) return []
    if (props.graph) return props.graph.edges.filter((e) => e.target === node.id).map((e) => e.source)
    if (props.edges) return props.edges.filter((e) => e.target === node.id).map((e) => e.source)
    const citedBy = data.value.cited_by
    return Array.isArray(citedBy) ? (citedBy as string[]) : []
})

const emit = defineEmits<{
    'update:visible': [value: boolean]
    'citation-click': [id: string]
    'segment-select': [payload: { nodeId: string; segmentId: string; selected: boolean }]
}>()

const isVisible = ref(props.visible || false)

watch(() => props.visible, (newVal) => {
    isVisible.value = newVal || false
})

watch(isVisible, (newVal) => {
    emit('update:visible', newVal)
})

const isNodeInGraph = (id: string): boolean => {
    if (props.graph) return props.graph.nodes.some((n) => n.id === id)
    if (props.docs && props.docs.length > 0) return props.docs.some((doc) => doc.id === id)
    return false
}

const handleCitationClick = (id: string) => {
    emit('citation-click', id)
}

const formatStatKey = (key: string): string => {
    // Convert camelCase to Title Case with spaces
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
}

const formatStatValue = (value: any): string => {
    if (typeof value === 'number') {
        // Format numbers with appropriate precision
        if (value < 0.01 && value > 0) {
            return value.toExponential(4)
        } else if (value % 1 === 0) {
            return value.toString()
        } else {
            return value.toFixed(4)
        }
    }
    return String(value)
}
</script>

<style>
/* Non-scoped to apply to PrimeVue Drawer which renders outside component tree */
.document-drawer {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.document-drawer {
    width: 1000px;
}

.drawer-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
}

.document-content {
    padding: 0;
    overflow-y: auto;
    font-size: 14px;
}

.info-section {
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5e7eb;
}

.info-section:last-child {
    border-bottom: none;
}

.section-title {
    font-size: 15px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 10px 0;
}

.info-field {
    display: flex;
    margin-bottom: 6px;
    gap: 12px;
}

.field-label {
    font-weight: 600;
    color: #6b7280;
    min-width: 120px;
    flex-shrink: 0;
    font-size: 13px;
}

.field-value {
    color: #1f2937;
    flex: 1;
    font-size: 14px;
}

.summary-text {
    color: #374151;
    line-height: 1.6;
    margin: 0;
    font-size: 14px;
}

.segment-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 320px;
    overflow-y: auto;
}

.segment-item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 6px 8px;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    line-height: 1.5;
    transition: background-color 0.15s ease, border-color 0.15s ease;
}

.segment-item:hover {
    background-color: #f8f9fa;
}

.segment-item.selected {
    background-color: #e8f1fb;
    border-color: #3498db;
}

.segment-check {
    color: #adb5bd;
    flex-shrink: 0;
    margin-top: 2px;
}

.segment-item.selected .segment-check {
    color: #3498db;
}

.segment-text {
    color: #374151;
}

.provision-list,
.citation-list {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
}

.provision-list li,
.citation-list li {
    color: #374151;
    margin-bottom: 4px;
    line-height: 1.5;
}

.stats-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.publication-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
    font-size: 14px;
}

.publication-link:hover {
    text-decoration: underline;
}

.publication-link i {
    font-size: 12px;
}

.citation-link {
    color: #3b82f6;
    cursor: pointer;
    text-decoration: underline;
}

.citation-link:hover {
    color: #2563eb;
}

.citation-text {
    color: #6b7280;
}
</style>
