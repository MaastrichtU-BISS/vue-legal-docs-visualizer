<template>
  <Dialog v-model:visible="isVisible" modal :style="{ width: '700px' }" class="cluster-preview-dialog">
    <template #header>
      <div class="dialog-header">
        <h2>{{ memberCount }} documents in this cluster</h2>
      </div>
    </template>

    <div class="cluster-content">
      <!-- Summary -->
      <div class="preview-section">
        <div class="summary-grid">
          <div class="summary-stat">
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

      <!-- Categorical breakdowns -->
      <div class="preview-section" v-if="categoricalHistograms.length > 0">
        <HistogramBars v-for="h in categoricalHistograms" :key="h.title" :title="h.title" :items="h.items" />
      </div>

      <!-- Top provisions / articles -->
      <div class="preview-section" v-if="topProvisions.length > 0">
        <h3 class="section-title">Most-cited provisions</h3>
        <ol class="provision-rank-list">
          <li v-for="item in topProvisions" :key="item.label">
            <span class="provision-name">{{ item.label }}</span>
            <span class="provision-count">{{ item.count }}</span>
          </li>
        </ol>
      </div>

      <div class="preview-section" v-if="topViolatedArticles.length > 0 || topAppliedArticles.length > 0">
        <h3 class="section-title">Articles</h3>
        <div class="article-columns">
          <div v-if="topViolatedArticles.length > 0">
            <h4 class="histogram-title">Violated</h4>
            <ol class="provision-rank-list">
              <li v-for="item in topViolatedArticles" :key="item.label">
                <span class="provision-name">{{ item.label }}</span>
                <span class="provision-count">{{ item.count }}</span>
              </li>
            </ol>
          </div>
          <div v-if="topAppliedArticles.length > 0">
            <h4 class="histogram-title">Applied</h4>
            <ol class="provision-rank-list">
              <li v-for="item in topAppliedArticles" :key="item.label">
                <span class="provision-name">{{ item.label }}</span>
                <span class="provision-count">{{ item.count }}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import { isEchrDocument, type LegalDocument, type LegalEdge } from './types'
import HistogramBars, { type HistogramItem } from './HistogramBars.vue'

export interface Props {
  documents?: LegalDocument[]
  edges?: LegalEdge[]
  visible?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const isVisible = ref(props.visible || false)

watch(() => props.visible, (newVal) => {
  isVisible.value = newVal || false
})

watch(isVisible, (newVal) => {
  emit('update:visible', newVal)
})

const documents = computed(() => props.documents || [])
const memberCount = computed(() => documents.value.length)

// Count occurrences of each value produced by `pick`, sorted by frequency, top N.
const topCounts = (pick: (doc: LegalDocument) => (string | undefined | null)[] | string | undefined | null, limit = 8): HistogramItem[] => {
  const counts = new Map<string, number>()
  documents.value.forEach(doc => {
    const raw = pick(doc)
    const values = Array.isArray(raw) ? raw : raw ? [raw] : []
    values.forEach(v => {
      if (!v) return
      counts.set(v, (counts.get(v) || 0) + 1)
    })
  })
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

const getYear = (doc: LegalDocument): number | null => {
  const data = doc.data as any
  const dateStr = data?.date_decision || data?.date_judgment || data?.date_published
  if (!dateStr) return null
  const year = parseInt(String(dateStr).slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

const dateRangeLabel = computed(() => {
  const years = documents.value.map(getYear).filter((y): y is number => y !== null)
  if (years.length === 0) return 'Unknown'
  const min = Math.min(...years)
  const max = Math.max(...years)
  return min === max ? `${min}` : `${min}–${max}`
})

const decadeHistogram = computed<HistogramItem[]>(() => {
  const counts = new Map<number, number>()
  documents.value.forEach(doc => {
    const year = getYear(doc)
    if (year === null) return
    const decade = Math.floor(year / 10) * 10
    counts.set(decade, (counts.get(decade) || 0) + 1)
  })
  return Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([decade, count]) => ({ label: `${decade}s`, count }))
})

const categoricalHistograms = computed(() => {
  if (documents.value.length === 0) return []
  const echrCluster = isEchrDocument(documents.value[0])

  if (echrCluster) {
    return [
      { title: 'Respondent state', items: topCounts(d => (d.data as any)?.respondent_state) },
      { title: 'Document type', items: topCounts(d => (d.data as any)?.document_type) },
      { title: 'Importance', items: topCounts(d => {
        const importance = (d.data as any)?.importance
        return importance !== undefined && importance !== null ? `${importance}` : undefined
      }) }
    ].filter(h => h.items.length > 0)
  }

  return [
    { title: 'Domain', items: topCounts(d => (d.data as any)?.domains) },
    { title: 'Instance', items: topCounts(d => (d.data as any)?.instance) },
    { title: 'Document type', items: topCounts(d => (d.data as any)?.document_type) }
  ].filter(h => h.items.length > 0)
})

const topProvisions = computed(() => topCounts(d => (d.data as any)?.legal_provisions, 10))

const toArticleList = (value?: string | string[]): string[] =>
  !value ? [] : Array.isArray(value) ? value : [value]

const topViolatedArticles = computed(() => topCounts(d => toArticleList((d.data as any)?.article_violated), 5))
const topAppliedArticles = computed(() => topCounts(d => toArticleList((d.data as any)?.article_applied), 5))

// How self-contained this cluster is: citations where both ends are members here
// ("internal") vs. citations reaching outside it ("external") - a direct signal for
// whether expanding is likely to surface a tight, self-explanatory group of documents
// or just a handful of nodes with most of their citations elsewhere.
const memberIds = computed(() => new Set(documents.value.map(d => d.id)))

const relevantEdges = computed(() => {
  if (!props.edges) return []
  return props.edges.filter(e => memberIds.value.has(e.source) || memberIds.value.has(e.target))
})

const internalEdgeCount = computed(() =>
  relevantEdges.value.filter(e => memberIds.value.has(e.source) && memberIds.value.has(e.target)).length
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

.histogram-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.article-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.provision-rank-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
}

.provision-rank-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #374151;
  margin-bottom: 4px;
  line-height: 1.5;
}

.provision-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provision-count {
  color: #6b7280;
  flex-shrink: 0;
}
</style>
