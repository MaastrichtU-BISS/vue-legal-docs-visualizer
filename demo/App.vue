<template>
  <main class="page">
    <header class="hero">
      <h1>Legal Docs Visualizer — IR + Annotation Demo</h1>
      <p>
        Search-engine-style IR results (score, snippet, highlights, segments), configurable
        views, hand-off to <code>vue-legal-annotation-kit</code>, and post-annotation
        visualization: segments as nodes (with parent-document info), annotated relations as edges.
      </p>
      <label class="mode-toggle">
        Mode
        <select v-model="layout">
          <option value="documents">documents only</option>
          <option value="both">documents + graph</option>
          <option value="graph">graph only</option>
          <option value="annotate">annotate (hand-off)</option>
          <option value="annotated">annotated segments graph</option>
        </select>
      </label>
    </header>

    <section class="panel">
      <form class="search-bar" @submit.prevent="runSearch">
        <input
          v-model="query"
          type="search"
          placeholder="Try: data retention, overeenkomst, milieuzonering… (empty searches everything)"
        />
        <button type="submit" :disabled="searching">
          {{ searching ? 'Searching…' : 'Search' }}
        </button>
      </form>

      <div class="retrieval-controls">
        <div class="method-picker" role="group" aria-label="Search method">
          <button
            v-for="option in DEMO_METHODS"
            :key="option.id"
            type="button"
            :class="{ active: method === option.id }"
            @click="setMethod(option.id)"
          >
            {{ option.label }}
          </button>
        </div>
        <label class="threshold-control">
          Threshold
          <input type="range" min="0" max="100" :value="Math.round(threshold * 100)" @input="onThresholdInput" />
          <span class="threshold-value">{{ threshold.toFixed(2) }}</span>
        </label>
      </div>
      <p v-if="error" class="error">{{ error }}</p>

      <section v-if="results.length > 0 && layout !== 'annotate'" class="selection">
        <h2>Selection — documents and segments for annotation</h2>
        <div v-for="result in results" :key="result.id" class="doc-selection">
          <label class="doc-check">
            <input
              type="checkbox"
              :checked="isDocumentSelected(result)"
              @change="toggleDocument(result)"
            />
            <strong>{{ result.title ?? result.id }}</strong>
          </label>
          <div class="segment-checks">
            <label v-for="segment in result.segments ?? []" :key="segment.id" class="segment-check">
              <input
                type="checkbox"
                :checked="selectedSegments.has(segment.id)"
                @change="toggleSegmentCheckbox(segment.id, ($event.target as HTMLInputElement).checked)"
              />
              {{ segment.id }}
            </label>
          </div>
        </div>
      </section>

      <component
        v-if="visualizerFor(layout)"
        :is="visualizerFor(layout)"
        :graph="layout === 'annotated' ? annotatedGraph : graph"
        :results="layout === 'annotated' ? [] : results"
        :threshold="threshold"
        :query-terms="highlightTerms"
        :load-document="loadDemoDocument"
        :selected-segment-ids="layout === 'annotated' ? [] : [...selectedSegments]"
        class="visualizer"
        @segment-select="onSegmentSelect"
      />

      <section v-else class="annotator">
        <h2>vue-legal-annotation-kit — annotating the hand-off</h2>
        <p class="hint">
          One queue entry per selected segment (span-level + document-level tags),
          with document relations targetable at every other queue entry. Save logs the
          assignment and advances; the annotated relations feed the segments graph.
        </p>
        <AnnotatorView
          v-if="annotatorDocument"
          :key="annotatorDocument.name"
          :document="annotatorDocument"
          :labelset="demoLabelset"
          annotation-level="paragraph"
          :assignment="annotatorAssignment"
          :position="annotatorPosition"
          :other-documents="annotatorOtherDocuments"
          :document-tags="true"
          @save="onAnnotationSave"
          @next="onAnnotationSave"
          @previous="goToPrevious"
        />
        <p v-else class="hint">
          Nothing selected yet — search and select segments or documents first.
        </p>
      </section>
    </section>

    <section class="logs">
      <article class="log-card">
        <h2>Selected segments (for annotation)</h2>
        <pre>{{ selectedSegmentsLog }}</pre>
      </article>
      <article class="log-card">
        <h2>Annotation hand-off (TaskData documents)</h2>
        <pre>{{ annotationLog }}</pre>
      </article>
      <article class="log-card">
        <h2>Saved assignments (from vue-legal-annotation-kit)</h2>
        <pre>{{ savedAssignmentsLog }}</pre>
      </article>
      <article class="log-card">
        <h2>Annotated graph input (segments as nodes, relations as edges)</h2>
        <pre>{{ annotatedGraphLog }}</pre>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createVisualizer } from '../src/createVisualizer'
import { irResultsToAnnotationDocuments, assignmentsToDocumentSet } from '../src/annotation'
import {
  AnnotatorView,
  RELATION_LABELS,
  type AnnotationDocument,
  type Assignment,
  type DocumentRef,
  type Labelset,
} from 'legal-annotation-kit'
import 'legal-annotation-kit/style.css'
import {
  irConfig,
  irResultsToDocumentSet,
  type DocumentSetV1,
  type IRDocumentDetail,
  type IRResult,
  type VisualizerConfig,
} from '../src/config'
import { preselectedSegmentIds, queryTerms } from '../src/ir-results'
import { search, corpus, DEMO_METHODS, type DemoRelation } from './stubBackend'

type Layout = 'documents' | 'both' | 'graph' | 'annotate' | 'annotated'

// One visualizer per import-time configuration: this is the contract — a host
// picks its views when it imports the module, and the layout is fixed.
const DocumentsOnly = createVisualizer({ config: { ...irConfig, views: ['documents'] } })
const BothViews = createVisualizer({ config: { ...irConfig, views: ['documents', 'graph'] } })
const GraphOnly = createVisualizer({ config: { ...irConfig, views: ['graph'] } })

// The annotated graph: segment nodes grouped under their parent document,
// edges styled by the kit's relation labels.
const SEGMENT_EDGE_COLORS = ['#8aa6b8', '#c0a36e', '#7ac29a', '#b07ac2', '#c27a7a', '#7aa6c2', '#b8b8b8', '#7ac2c2']

const relationTypes = Object.fromEntries(
  RELATION_LABELS.map((label, i) => [
    label,
    { label, color: SEGMENT_EDGE_COLORS[i % SEGMENT_EDGE_COLORS.length], direction: 'forward' as const },
  ]),
)

const SegmentsGraphConfig: VisualizerConfig = {
  ...irConfig,
  id: 'ir-segments',
  views: ['graph'],
  nodes: { id: 'id', label: 'title', secondaryLabel: 'text', type: 'type', size: 'degree' },
  edges: {
    typeField: 'relation_type',
    defaultType: 'Related to',
    types: relationTypes,
  },
  grouping: { mode: 'parent', field: 'parent' },
  tooltip: {
    title: 'title',
    subtitle: 'parent_title',
    lines: [{ label: 'Segment', field: 'text' }],
  },
  details: [
    { label: 'Parent document', field: 'parent_title' },
    { label: 'Segment text', field: 'text' },
  ],
  summaryField: 'text',
  labels: { entity: 'Segment', entityPlural: 'Segments', idLabel: 'Segment ID' },
}

const AnnotatedGraph = createVisualizer({ config: SegmentsGraphConfig })

function visualizerFor(layout: Layout) {
  if (layout === 'annotate') return undefined
  if (layout === 'annotated') return AnnotatedGraph
  return layout === 'documents' ? DocumentsOnly : layout === 'both' ? BothViews : GraphOnly
}

const query = ref('data retention')
const method = ref('bm25')
const threshold = ref(0.2)
const layout = ref<Layout>('both')
const searching = ref(false)
const error = ref('')
const results = ref<IRResult[]>([])
const relations = ref<DemoRelation[]>([])

// Host-side mapping: IR results become nodes, the relations become edges. The
// visualizer only ever sees the canonical document-set shape.
const graph = computed<DocumentSetV1>(() =>
  irResultsToDocumentSet(results.value, relations.value),
)

// The terms the query contributes to snippet/provision highlighting.
const highlightTerms = computed(() => queryTerms(query.value))

// The full document behind a result, for the results view's document tab.
// The demo synthesizes it from the same stub corpus a real host would load.
async function loadDemoDocument(id: string): Promise<IRDocumentDetail | undefined> {
  const doc = corpus.find((candidate) => candidate.id === id)
  if (!doc) return undefined
  return {
    id: doc.id,
    title: doc.title,
    sections: doc.segments.map((segment) => ({ heading: segment.id, text: segment.text })),
  }
}

async function runSearch() {
  searching.value = true
  error.value = ''
  try {
    const response = await search({ query: query.value, method: method.value })
    results.value = response.results
    relations.value = response.relations
    // The threshold's pre-tick, re-derived for the fresh results.
    selectedSegments.value = new Set(preselectedSegmentIds(response.results, threshold.value))
    savedAssignments.value = []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    searching.value = false
  }
}

function setMethod(id: string) {
  if (id === method.value) return
  method.value = id
  void runSearch()
}

function onThresholdInput(event: Event) {
  threshold.value = Number((event.target as HTMLInputElement).value) / 100
}

// A slider move re-derives the pre-tick: the selection becomes exactly the
// provisions the threshold admits (a manual un-tick does not survive it).
watch(threshold, () => {
  selectedSegments.value = new Set(preselectedSegmentIds(results.value, threshold.value))
})

// --- selection: whole documents and/or individual segments --------------------
// Selecting a whole document simply selects all of its segments: the hand-off
// is segment-scoped either way.

const selectedSegments = ref<Set<string>>(new Set())

function toggleSegmentCheckbox(segmentId: string, checked: boolean) {
  const next = new Set(selectedSegments.value)
  if (checked) next.add(segmentId)
  else next.delete(segmentId)
  selectedSegments.value = next
}

function isDocumentSelected(result: IRResult): boolean {
  const segments = result.segments ?? []
  return segments.length > 0 && segments.every((s) => selectedSegments.value.has(s.id))
}

function toggleDocument(result: IRResult) {
  const next = new Set(selectedSegments.value)
  const allSelected = isDocumentSelected(result)
  for (const segment of result.segments ?? []) {
    if (allSelected) next.delete(segment.id)
    else next.add(segment.id)
  }
  selectedSegments.value = next
}

function onSegmentSelect(payload: { nodeId: string; segmentId: string; selected: boolean }) {
  const next = new Set(selectedSegments.value)
  if (payload.selected) next.add(payload.segmentId)
  else next.delete(payload.segmentId)
  selectedSegments.value = next
}

const selectedSegmentsLog = computed(() =>
  JSON.stringify(Array.from(selectedSegments.value).map((segmentId) => {
    const result = results.value.find((r) => r.segments.some((s) => s.id === segmentId))
    return { documentId: result?.id, segmentId }
  }), null, 2),
)

// The hand-off payload: what a host would wrap in a `TaskData` (labelset,
// assignments) and hand to vue-legal-annotation-kit.
const annotationDocuments = computed(() =>
  irResultsToAnnotationDocuments(results.value, selectedSegments.value),
)

const annotationLog = computed(() => JSON.stringify(annotationDocuments.value, null, 2))

// --- vue-legal-annotation-kit integration ------------------------------------
// The hand-off documents become the annotator's queue; saving logs the
// assignment exactly as a host would receive it from `onSave`, and every
// saved assignment's document_relations become graph edges.

const demoLabelset: Labelset = {
  name: 'Demo labelset',
  desc: 'A tiny labelset to exercise the annotator',
  labels: [
    { name: 'Provision', color: '#3498db' },
    { name: 'Conclusion', color: '#e67e22' },
    { name: 'Fact', color: '#27ae60' },
  ],
}

const annotatorIndex = ref(0)

const annotatorDocument = computed<AnnotationDocument | null>(() => {
  const docs = annotationDocuments.value
  if (docs.length === 0) return null
  return { ...docs[Math.min(annotatorIndex.value, docs.length - 1)] }
})

function emptyAssignment(order: number): Assignment {
  return {
    annotator: 'demo',
    order,
    status: 'pending',
    confidence: 0,
    annotations: [],
    document_annotations: [],
    document_relations: [],
  }
}

const annotatorAssignment = computed<Assignment>(() =>
  emptyAssignment(annotatorIndex.value + 1),
)

const annotatorPosition = computed(() => ({
  current: Math.min(annotatorIndex.value, annotationDocuments.value.length - 1) + 1,
  total: annotationDocuments.value.length,
}))

const annotatorOtherDocuments = computed<DocumentRef[]>(() =>
  annotationDocuments.value
    .filter((d) => d.name !== annotatorDocument.value?.name)
    .map((d, i) => ({ name: d.name, key: d.key, order: i + 1 })),
)

interface SavedAssignment extends Assignment {
  /** The queue document the assignment belongs to (its hand-off key). */
  documentName: string
  documentKey?: string
}

const savedAssignments = ref<SavedAssignment[]>([])

function onAnnotationSave(assignment: Assignment) {
  const doc = annotatorDocument.value
  if (doc) {
    savedAssignments.value = [
      ...savedAssignments.value,
      { ...assignment, documentName: doc.name, documentKey: doc.key },
    ]
  }
  annotatorIndex.value = annotatorIndex.value + 1
}

function goToPrevious() {
  annotatorIndex.value = Math.max(0, annotatorIndex.value - 1)
}

const savedAssignmentsLog = computed(() => JSON.stringify(savedAssignments.value, null, 2))

// --- the annotated segments graph ---------------------------------------------
// Derived entirely by the exported adapter: segment nodes with parent info,
// annotated document relations as edges.
const annotatedGraph = computed<DocumentSetV1>(() =>
  assignmentsToDocumentSet(results.value, savedAssignments.value),
)

const annotatedGraphLog = computed(() => JSON.stringify(annotatedGraph.value, null, 2))
</script>

<style>
.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px 64px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1f2937;
}
.hero {
  margin-bottom: 20px;
}
.hero h1 {
  font-size: 1.5rem;
  margin: 0 0 6px;
}
.hero p {
  margin: 0 0 12px;
  color: #4b5563;
}
.mode-toggle select {
  margin-left: 6px;
  padding: 4px 8px;
}
.panel {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 16px;
}
.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.search-bar input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}
.search-bar button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #1d4ed8;
  color: white;
  cursor: pointer;
}
.error {
  color: #b91c1c;
}
.retrieval-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.method-picker {
  display: flex;
  gap: 4px;
}
.method-picker button {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #4b5563;
}
.method-picker button.active {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: white;
}
.threshold-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: #4b5563;
}
.threshold-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  min-width: 32px;
}
.selection {
  margin: 8px 0 16px;
}
.selection h2 {
  font-size: 0.95rem;
  margin: 0 0 8px;
}
.doc-selection {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
}
.doc-check {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}
.segment-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-left: 22px;
}
.segment-check {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 0.8rem;
  color: #4b5563;
}
.visualizer {
  min-height: 420px;
}
.annotator {
  margin-top: 12px;
}
.annotator h2 {
  font-size: 1.05rem;
  margin: 0 0 4px;
}
.annotator .hint {
  color: #4b5563;
  font-size: 0.85rem;
  margin: 0 0 10px;
}
.logs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}
.log-card {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow: auto;
}
.log-card h2 {
  font-size: 0.9rem;
  margin: 0 0 8px;
}
.log-card pre {
  font-size: 0.75rem;
  margin: 0;
  white-space: pre-wrap;
}
</style>
