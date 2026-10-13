<template>
  <Dialog v-model:visible="isVisible" modal :style="{ width: '700px' }" class="cluster-preview-dialog">
    <template #header>
      <div class="dialog-header">
        <h2>{{ memberCount }} {{ entityPlural.toLowerCase() }} in this cluster</h2>
      </div>
    </template>

    <div class="cluster-content">
      <!-- Summary -->
      <div class="preview-section">
        <div class="summary-grid">
          <div class="summary-stat" v-if="dateField">
            <span class="summary-value">{{ dateRangeLabel }}</span>
            <span class="summary-label">Date range</span>
          </div>
          <div class="summary-stat">
            <span class="summary-value">{{ internalEdgeCount }}</span>
            <span class="summary-label">Internal citations</span>
          </div>
          <div class="summary-stat">
            <span class="summary-value">{{ externalEdgeCount }}</span>
            <span class="summary-label">External citations</span>
          </div>
        </div>
        <p class="summary-hint">
          {{ connectivityHint }}
        </p>
      </div>

      <!-- Timeline -->
      <div class="preview-section" v-if="decadeHistogram.length > 0">
        <HistogramBars title="By decade" :items="decadeHistogram" />
      </div>

      <!-- Categorical breakdowns (from config) -->
      <div class="preview-section" v-if="categoricalHistograms.length > 0">
        <HistogramBars v-for="h in categoricalHistograms" :key="h.title" :title="h.title" :items="h.items" />
      </div>

      <!-- Host extra content -->
      <slot :nodes="members" :config="activeConfig" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import type { LegalDocument, LegalEdge } from './types'
import HistogramBars, { type HistogramItem } from './HistogramBars.vue'
import {
  caseLawConfig,
  resolveVisualizerConfig,
  type DocumentSetV1,
  type GraphNode,
  type VisualizerConfig,
} from '../config'

export interface Props {
  /** Cluster members (canonical). */
  nodes?: GraphNode[]
  /** A preset id or a full config. Defaults to the case-law preset. */
  config?: VisualizerConfig | string
  /** The full graph, for edge counts. */
  graph?: DocumentSetV1
  /** Legacy input, still supported. */
  documents?: LegalDocument[]
  edges?: LegalEdge[]
  visible?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const activeConfig = computed<VisualizerConfig>(() => resolveVisualizerConfig(props.config) ?? caseLawConfig)
const entityPlural = computed(() => activeConfig.value.labels?.entityPlural ?? 'Documents')
const dateField = computed(() => activeConfig.value.dateField)

const members = computed<GraphNode[]>(() => {
  if (props.nodes) return props.nodes
  return (props.documents ?? []).map((doc) => ({
    id: String(doc.id),
    data: (doc.data ?? {}) as unknown as Record<string, unknown>,
  }))
})
const memberCount = computed(() => members.value.length)

const isVisible = ref(props.visible || false)

watch(() => props.visible, (newVal) => {
  isVisible.value = newVal || false
})

watch(isVisible, (newVal) => {
  emit('update:visible', newVal)
})

// Count occurrences of each value produced by `pick`, sorted by frequency, top N.
const topCounts = (
  pick: (node: GraphNode) => (string | undefined | null)[] | string | undefined | null,
  limit = 8,
): HistogramItem[] => {
  const counts = new Map<string, number>()
  members.value.forEach((node) => {
    const raw = pick(node)
    const values = Array.isArray(raw) ? raw : raw ? [raw] : []
    values.forEach((v) => {
      if (!v) return
      counts.set(v, (counts.get(v) || 0) + 1)
    })
  })
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

const getYear = (node: GraphNode): number | null => {
  const field = dateField.value
  if (!field) return null
  const dateStr = node.data?.[field]
  if (!dateStr) return null
  const year = parseInt(String(dateStr).slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

const dateRangeLabel = computed(() => {
  const years = members.value.map(getYear).filter((y): y is number => y !== null)
  if (years.length === 0) return 'Unknown'
  const min = Math.min(...years)
  const max = Math.max(...years)
  return min === max ? `${min}` : `${min}–${max}`
})

const decadeHistogram = computed<HistogramItem[]>(() => {
  const counts = new Map<number, number>()
  members.value.forEach((node) => {
    const year = getYear(node)
    if (year === null) return
    const decade = Math.floor(year / 10) * 10
    counts.set(decade, (counts.get(decade) || 0) + 1)
  })
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([decade, count]) => ({ label: `${decade}s`, count }))
})

const categoricalHistograms = computed(() => {
  return (activeConfig.value.breakdowns ?? [])
    .map((breakdown) => ({
      title: breakdown.title,
      items: topCounts((node) => {
        const value = node.data?.[breakdown.field]
        if (breakdown.multi) return Array.isArray(value) ? (value as string[]) : undefined
        return value === undefined || value === null ? undefined : String(value)
      }),
    }))
    .filter((histogram) => histogram.items.length > 0)
})

// How self-contained this cluster is: citations where both ends are members here
// ("internal") vs. citations reaching outside it ("external").
const memberIds = computed(() => new Set(members.value.map((node) => node.id)))

const allEdges = computed(() => props.graph?.edges ?? props.edges ?? [])

const relevantEdges = computed(() =>
  allEdges.value.filter((edge) => memberIds.value.has(edge.source) || memberIds.value.has(edge.target)),
)

const internalEdgeCount = computed(() =>
  relevantEdges.value.filter((edge) => memberIds.value.has(edge.source) && memberIds.value.has(edge.target)).length,
)

const externalEdgeCount = computed(() => relevantEdges.value.length - internalEdgeCount.value)

const connectivityHint = computed(() => {
  const total = internalEdgeCount.value + externalEdgeCount.value
  if (total === 0) return 'No citation data available for these documents.'
  const internalShare = internalEdgeCount.value / total
  if (internalShare >= 0.6) {
    return 'Mostly cites itself - expanding should show a tight, self-contained group.'
  }
  if (internalShare <= 0.2) {
    return 'Mostly cites documents outside this cluster - expanding may not explain much on its own.'
  }
  return 'A mix of internal and external citations.'
})
</script>

<style>
/* Non-scoped to apply to PrimeVue Dialog, which renders outside the component tree */
.cluster-preview-dialog {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.dialog-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.cluster-content {
  font-size: 14px;
}

.preview-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.preview-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 10px 0;
}

.summary-grid {
  display: flex;
  gap: 24px;
  margin-bottom: 8px;
}

.summary-stat {
  display: flex;
  flex-direction: column;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
}

.summary-label {
  font-size: 12px;
  color: #6b7280;
}

.summary-hint {
  font-size: 13px;
  color: #4b5563;
  margin: 8px 0 0 0;
}
</style>
