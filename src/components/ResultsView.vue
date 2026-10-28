<template>
    <div class="results-view">
        <!-- Left column: the retrieval's documents as score-encoded cards. -->
        <aside class="results-panel">
            <div class="results-summary" data-test="results-summary">
                {{ cards.length }} result(s) · {{ aboveCount }} above threshold
            </div>

            <div v-if="cards.length === 0" class="results-empty" data-test="results-empty">
                No results for this query.
            </div>

            <button
                v-for="card in cards"
                :key="card.id"
                type="button"
                class="result-card"
                :class="{ 'below-threshold': card.below, active: card.id === openId }"
                :data-doc-id="card.id"
                @click="open(card.id)"
            >
                <div class="card-head">
                    <span class="card-rank">#{{ card.rank }}</span>
                    <span class="card-title">{{ card.title }}</span>
                </div>
                <div class="card-meta">
                    {{ card.id }} · {{ card.segmentCount }} prov
                    <template v-if="card.topSegment"> · Top: {{ card.topSegment }}</template>
                </div>
                <div class="score-row">
                    <div class="score-bar-bg">
                        <div
                            class="score-bar"
                            :style="{ width: scoreWidth(card.score) + '%', background: scoreColor(card.score) }"
                        ></div>
                    </div>
                    <div class="score-num" :style="{ color: scoreColor(card.score) }">
                        {{ formatScore(card.score) }}
                    </div>
                </div>
                <p v-if="card.snippetChunks.length" class="card-snippet">
                    <template v-for="(chunk, i) in card.snippetChunks" :key="i">
                        <mark v-if="chunk.marked" class="ir-highlight">{{ chunk.text }}</mark>
                        <template v-else>{{ chunk.text }}</template>
                    </template>
                </p>
            </button>

            <p v-if="cards.length > 0 && aboveCount === 0" class="results-hint" data-test="threshold-hint">
                No result reaches the current threshold — lower it to bring cards back.
            </p>
        </aside>

        <!-- Right column: the picked result's provisions, in place. -->
        <section class="viewer-panel">
            <div v-if="!openCard" class="viewer-empty">Click a result to view its contents</div>

            <template v-else>
                <header class="viewer-head">
                    <h2>{{ openCard.title }}</h2>
                    <div class="viewer-meta">
                        <span class="viewer-id">{{ openCard.id }}</span>
                        <span class="viewer-score">Rank #{{ openCard.rank }} · score {{ formatScore(openCard.score) }}</span>
                    </div>
                </header>

                <div class="viewer-tabs">
                    <button
                        type="button"
                        :class="{ active: tab === 'provisions' }"
                        @click="tab = 'provisions'"
                    >
                        Provisions ({{ openSegments.length }})
                    </button>
                    <button
                        v-if="loadDocument"
                        type="button"
                        :class="{ active: tab === 'document' }"
                        @click="showDocument"
                    >
                        Full document
                    </button>
                </div>

                <div v-if="tab === 'provisions'" class="provision-list">
                    <label
                        v-for="segment in shownSegments"
                        :key="segment.id"
                        class="prov-card"
                        :class="{ selected: isSelected(segment.id) }"
                    >
                        <input
                            type="checkbox"
                            :checked="isSelected(segment.id)"
                            @change="toggleSegment(segment, ($event.target as HTMLInputElement).checked)"
                        />
                        <span class="prov-body">
                            <span class="prov-head">
                                <span class="prov-citation">{{ segmentLabel(segment) }}</span>
                                <span
                                    v-if="typeof segment.score === 'number'"
                                    class="prov-score"
                                    :style="{ color: scoreColor(segment.score) }"
                                >{{ formatScore(segment.score) }}</span>
                            </span>
                            <span class="prov-id">{{ segment.id }}</span>
                            <span class="prov-text">
                                <template v-for="(chunk, i) in segmentChunks(segment)" :key="i">
                                    <mark v-if="chunk.marked" class="ir-highlight">{{ chunk.text }}</mark>
                                    <template v-else>{{ chunk.text }}</template>
                                </template>
                            </span>
                        </span>
                    </label>
                    <p v-if="openSegments.length === 0" class="results-empty">This result carries no provisions.</p>
                </div>

                <!-- Pager for the opt-in paginated mode, pinned under the
                     scrolling list; hidden until there is something to page. -->
                <div v-if="tab === 'provisions' && paginated && pages > 1" class="provision-pager">
                    <button type="button" :disabled="page === 0" @click="page--">‹ Prev</button>
                    <span class="pager-status">Page {{ page + 1 }} of {{ pages }} · {{ openSegments.length }} provisions</span>
                    <button type="button" :disabled="page >= pages - 1" @click="page++">Next ›</button>
                </div>

                <div v-if="tab === 'document'" class="document-view">
                    <p v-if="docLoading" class="doc-note">Loading…</p>
                    <p v-else-if="docError" class="doc-error" data-test="document-error">{{ docError }}</p>
                    <template v-else-if="docDetail">
                        <p v-if="docDetail.title" class="doc-title">{{ docDetail.title }}</p>
                        <template v-if="docDetail.sections?.length">
                            <section v-for="(section, i) in docDetail.sections" :key="i" class="doc-section">
                                <h3 v-if="section.heading">{{ section.heading }}</h3>
                                <p>{{ section.text }}</p>
                            </section>
                        </template>
                        <p v-else class="doc-text">{{ docDetail.text }}</p>
                    </template>
                    <p v-else class="doc-error">No document text available — the provisions tab still works.</p>
                </div>
            </template>
        </section>
    </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import {
  caseLawConfig,
  resolveVisualizerConfig,
  type DocumentSetV1,
  type GraphNode,
  type IRDocumentDetail,
  type IRDocumentLoader,
  type IRSegment,
  type VisualizerConfig,
} from '../config'
import { splitHighlights, type HighlightedChunk } from '../table'
import {
  formatScore,
  isBelowThreshold,
  pageCount,
  scoreColor,
  scoreWidth,
  segmentPage,
  sortedSegments,
  termRanges,
} from '../ir-results'

export interface Props {
  /** Canonical input. When absent, `docs`/`edges` are adapted. */
  graph?: DocumentSetV1
  /** A preset id or a full config. Defaults to the case-law preset. */
  config?: VisualizerConfig | string
  /** Legacy case-law input, still supported. */
  docs?: Record<string, unknown>[]
  edges?: Record<string, unknown>[]
  /**
   * The score threshold the host's slider holds: cards below it dim, and the
   * host re-derives its selection from it. Without it the config's own
   * `threshold` stands; with neither, nothing dims.
   */
  threshold?: number
  /**
   * The host's selected segments, when it owns the selection. The host
   * re-derives the threshold-based pre-tick (see `preselectedSegmentIds`)
   * and passes the set back, so the viewer renders exactly what the host
   * has. Without it the viewer keeps its own toggle state.
   */
  selectedSegmentIds?: string[]
  /** Query terms marked in snippet and provision text. */
  queryTerms?: string[]
  /** Loads a result's full document for the "Full document" tab. */
  loadDocument?: IRDocumentLoader
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'segment-select': [payload: { nodeId: string; segmentId: string; selected: boolean }]
}>()

const effectiveConfig = computed<VisualizerConfig>(
  () => resolveVisualizerConfig(props.config) ?? caseLawConfig,
)

const effectiveThreshold = computed<number>(
  () => props.threshold ?? effectiveConfig.value.threshold ?? 0,
)

const scoreField = computed(() => effectiveConfig.value.relevanceField ?? 'score')
const snippetField = computed(() => effectiveConfig.value.snippetField ?? 'snippet')

interface ResultCard {
  id: string
  node: GraphNode
  rank: number
  title: string
  score: number
  below: boolean
  segmentCount: number
  topSegment: string
  snippetChunks: HighlightedChunk[]
}

const cards = computed<ResultCard[]>(() =>
  (props.graph?.nodes ?? []).map((node, index) => {
    const data = (node.data ?? {}) as Record<string, unknown>
    const score = typeof data[scoreField.value] === 'number' ? (data[scoreField.value] as number) : 0
    const snippet = typeof data[snippetField.value] === 'string' ? (data[snippetField.value] as string) : ''
    const highlights = Array.isArray(data.highlights) ? (data.highlights as { start: number; end: number }[]) : []
    const segments = Array.isArray(data.segments) ? (data.segments as IRSegment[]) : []
    const metadataTop = typeof data.top_provision === 'string' ? data.top_provision : ''
    const scored = segments.filter((segment) => typeof segment.score === 'number') as (IRSegment & { score: number })[]
    const bestSegment = scored.length
      ? scored.reduce((best, segment) => (segment.score > best.score ? segment : best), scored[0]).id
      : ''
    return {
      id: node.id,
      node,
      rank: typeof data.rank === 'number' ? data.rank : index + 1,
      title: typeof data.title === 'string' && data.title ? data.title : node.id,
      score,
      below: isBelowThreshold(score, effectiveThreshold.value),
      segmentCount: segments.length,
      topSegment: metadataTop || bestSegment,
      snippetChunks: snippet ? splitHighlights(snippet, highlights) : [],
    }
  }),
)

const aboveCount = computed(() => cards.value.filter((card) => !card.below).length)

// --- open result -------------------------------------------------------------

const openId = ref<string | null>(null)
const tab = ref<'provisions' | 'document'>('provisions')

const openCard = computed<ResultCard | null>(
  () => cards.value.find((card) => card.id === openId.value) ?? null,
)

const openSegments = computed<IRSegment[]>(() => {
  const data = (openCard.value?.node.data ?? {}) as Record<string, unknown>
  const segments = Array.isArray(data.segments) ? (data.segments as IRSegment[]) : []
  return sortedSegments(segments)
})

// --- provision pagination (opt-in) ----------------------------------------------

const paginated = computed(() => effectiveConfig.value.segmentOverflow === 'paginate')
const pageSize = computed(() => Math.max(effectiveConfig.value.segmentsPerPage ?? 20, 1))
const pages = computed(() => pageCount(openSegments.value.length, pageSize.value))
const page = ref(0)

/** The segments on screen: the whole sorted list, or the current page. */
const shownSegments = computed<IRSegment[]>(() =>
  paginated.value ? segmentPage(openSegments.value, page.value, pageSize.value) : openSegments.value,
)

function open(id: string) {
  openId.value = id
  tab.value = 'provisions'
  page.value = 0
  docDetail.value = undefined
  docError.value = ''
}

function close() {
  openId.value = null
}

defineExpose({ close })

// --- selection ----------------------------------------------------------------

const localSelected = ref<Set<string>>(new Set())

const selected = computed<Set<string>>(() =>
  props.selectedSegmentIds ? new Set(props.selectedSegmentIds) : localSelected.value,
)

function isSelected(segmentId: string): boolean {
  return selected.value.has(segmentId)
}

function toggleSegment(segment: IRSegment, checked: boolean) {
  const next = new Set(selected.value)
  if (checked) next.add(segment.id)
  else next.delete(segment.id)
  localSelected.value = next
  if (openId.value) emit('segment-select', { nodeId: openId.value, segmentId: segment.id, selected: checked })
}

function segmentLabel(segment: IRSegment): string {
  const data = (openCard.value?.node.data ?? {}) as Record<string, unknown>
  const provisions = Array.isArray(data.provisions)
    ? (data.provisions as { prov_id: string; citation?: string | null; article?: string }[])
    : []
  const entry = provisions.find((provision) => provision.prov_id === segment.id)
  return entry?.citation || entry?.article || segment.id
}

function segmentChunks(segment: IRSegment): HighlightedChunk[] {
  if (!segment.text) return []
  return splitHighlights(segment.text, termRanges(segment.text, queryTermsForView.value))
}

const queryTermsForView = computed<string[]>(() => {
  if (props.queryTerms?.length) return props.queryTerms
  // Fall back to the terms already marked in the snippet: whatever the
  // retrieval backend highlighted there is what the viewer highlights too.
  const terms = new Set<string>()
  for (const card of cards.value) {
    for (const chunk of card.snippetChunks) {
      if (chunk.marked) terms.add(chunk.text.trim())
    }
  }
  return Array.from(terms).filter((term) => term.length >= 2)
})

// --- full document tab ----------------------------------------------------------

const docLoading = ref(false)
const docError = ref('')
const docDetail = ref<IRDocumentDetail | undefined>(undefined)
const docCache = new Map<string, IRDocumentDetail | undefined>()

function showDocument() {
  tab.value = 'document'
  void loadOpenDocument()
}

watch(openId, () => {
  if (tab.value === 'document') void loadOpenDocument()
})

async function loadOpenDocument() {
  const id = openId.value
  if (!id || !props.loadDocument) return
  if (docCache.has(id)) {
    docDetail.value = docCache.get(id)
    docError.value = ''
    return
  }
  docLoading.value = true
  docError.value = ''
  try {
    const detail = await props.loadDocument(id)
    docCache.set(id, detail)
    if (openId.value === id) docDetail.value = detail
  } catch {
    if (openId.value === id) docError.value = 'Could not load the document.'
  } finally {
    docLoading.value = false
  }
}
</script>

<style scoped>
.results-view {
  display: flex;
  gap: 0;
  height: 100%;
  min-height: 30rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.results-panel {
  width: 380px;
  flex-shrink: 0;
  border-right: 1px solid #dee2e6;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.results-summary {
  font-size: 12px;
  color: #6b7280;
  padding: 2px 4px;
}

.results-empty {
  color: #6b7280;
  font-size: 13px;
  padding: 12px 4px;
}

.results-hint {
  color: #b45309;
  font-size: 12px;
  margin: 0;
  padding: 4px;
}

.result-card {
  text-align: left;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: white;
  padding: 8px 10px;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.result-card:hover {
  border-color: #3498db;
}

.result-card.active {
  border-color: #3498db;
  background: #f2f8fd;
}

.result-card.below-threshold {
  opacity: 0.35;
}

.card-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 2px;
}

.card-rank {
  font-size: 11px;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

.card-title {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
}

.card-meta {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.score-bar-bg {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  overflow: hidden;
}

.score-bar {
  height: 100%;
  border-radius: 3px;
}

.score-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  min-width: 40px;
  text-align: right;
}

.card-snippet {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #374151;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:deep(.ir-highlight),
mark.ir-highlight {
  background: #fff3c4;
  border-radius: 3px;
  padding: 0 1px;
  color: inherit;
}

/* The viewer is a frame: header/meta/tabs stay put, only the tab content
 * scrolls. Without this the whole panel scrolled as one unit and the chrome
 * disappeared under a long provision list. */
.viewer-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
}

.viewer-empty {
  color: #6b7280;
  font-size: 14px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-head {
  flex-shrink: 0;
}

.viewer-head h2 {
  margin: 0 0 4px;
  font-size: 16px;
  color: #1f2937;
}

.viewer-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 12px;
}

.viewer-tabs {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  border-bottom: 1px solid #dee2e6;
  margin-bottom: 12px;
}

.viewer-tabs button {
  border: none;
  background: none;
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.viewer-tabs button.active {
  color: #1f2937;
  font-weight: 600;
  border-bottom-color: #3498db;
}

.provision-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provision-pager {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid #dee2e6;
}

.provision-pager button {
  border: 1px solid #dee2e6;
  background: white;
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 12px;
  color: #1f2937;
  cursor: pointer;
}

.provision-pager button:disabled {
  opacity: 0.4;
  cursor: default;
}

.pager-status {
  font-size: 12px;
  color: #6b7280;
}

.prov-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
}

.prov-card:hover {
  background: #f8f9fa;
}

.prov-card.selected {
  background: #e8f1fb;
  border-color: #3498db;
}

.prov-card input {
  margin-top: 3px;
}

.prov-body {
  display: block;
  flex: 1;
  min-width: 0;
}

.prov-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.prov-citation {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
}

.prov-score {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.prov-id {
  display: block;
  font-size: 11px;
  color: #6b7280;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  margin: 2px 0 6px;
}

.prov-text {
  display: block;
  font-size: 13px;
  line-height: 1.5;
  color: #374151;
}

.document-view {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.document-view .doc-title {
  font-weight: 600;
  margin: 0 0 8px;
}

.document-view .doc-section h3 {
  font-size: 14px;
  margin: 12px 0 4px;
  color: #1f2937;
}

.document-view .doc-section p,
.document-view .doc-text {
  font-size: 13px;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
  margin: 0;
}

.doc-note {
  color: #6b7280;
  font-size: 13px;
}

.doc-error {
  color: #b91c1c;
  font-size: 13px;
}
</style>
