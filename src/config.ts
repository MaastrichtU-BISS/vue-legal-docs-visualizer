// Visualizer configuration: the canonical `document-set@1` input, the
// workflow-agnostic view config, and the built-in presets. Additive and
// backward compatible — the case-law `docs`/`edges` props still work and are
// adapted into this shape.
//
// The config type is owned by this package (not a shared retrieval package):
// the view is the visualizer's concern.

import type { LegalDocument, LegalEdge } from './components/types'

/** One node of a `document-set@1`. */
export interface GraphNode {
  id: string
  data: Record<string, unknown>
}

/** One edge of a `document-set@1`. */
export interface GraphEdge {
  id?: string
  source: string
  target: string
  /** The link type, e.g. an annotation relation label. */
  relation_type?: string
}

/** The canonical graph the visualizer renders. */
export interface DocumentSetV1 {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** Where a node's display fields live in `node.data` (or the node itself). */
export interface NodeFieldConfig {
  /** Key holding the node id. Default "id". */
  id?: string
  /** Key for the primary label. */
  label: string
  /** Key for a secondary label. */
  secondaryLabel?: string
  /** Key for the node type / group. */
  type?: string
  /** Key for a numeric size metric. */
  size?: string
}

export interface EdgeTypeStyle {
  label?: string
  color?: string
  width?: number
  direction?: 'forward' | 'backward' | 'bidirectional' | 'none'
}

export interface EdgeConfig {
  /** Key holding the relation type. Default "relation_type". */
  typeField?: string
  /** Type used when an edge has none. */
  defaultType?: string
  /** Styling per relation type. */
  types?: Record<string, EdgeTypeStyle>
}

export interface GroupingConfig {
  mode: 'parent' | 'clusterBy' | 'community' | 'none'
  /** Field to group by, when mode is "parent" or "clusterBy". */
  field?: string
  /** Custom grouping, when a field is not enough. */
  fn?: (node: GraphNode) => string
}

export interface ColumnConfig {
  field: string
  header: string
  type?: 'default' | 'number' | 'link' | 'button' | 'ellipsis' | 'highlighted'
  sortable?: boolean
  width?: string
  maxWidth?: string
  buttonText?: string
  /** Derive the cell value from the node (and graph). Falls back to `data[field]`. */
  value?: (node: GraphNode, graph: DocumentSetV1) => unknown
  /** Format the derived value for display. */
  formatter?: (value: unknown, node: GraphNode) => string
}

export interface TooltipLine {
  label: string
  field: string
}

export interface TooltipConfig {
  title?: string
  subtitle?: string
  lines?: TooltipLine[]
}

/** One field shown in the document details panel. */
export interface DetailField {
  label: string
  field: string
  type?: 'text' | 'list' | 'number' | 'link'
  /** Derive the value (e.g. build a link URL). Falls back to `data[field]`. */
  value?: (node: GraphNode) => unknown
}

/** One categorical breakdown shown for a cluster. */
export interface BreakdownConfig {
  title: string
  field: string
  /** The field holds a list of values. */
  multi?: boolean
}

/** Terminology overrides so the same view reads right per workflow. */
export interface VisualizerLabels {
  entity?: string
  entityPlural?: string
  idLabel?: string
}

export interface VisualizerConfig {
  id: string
  nodes: NodeFieldConfig
  edges: EdgeConfig
  grouping: GroupingConfig
  columns: ColumnConfig[]
  /** Which views are available. Empty/absent => ['documents','graph']. */
  views?: ('documents' | 'graph')[]
  /**
   * How the documents view renders. 'table' (the default) is the generic
   * DataTable; 'results' is the IR master-detail view: result cards with
   * score bars beside an in-place provision viewer.
   */
  documentsView?: 'table' | 'results'
  /**
   * How the results view's provision list overflows: 'scroll' (default)
   * scrolls a bounded frame; 'paginate' slices the sorted list into pages of
   * `segmentsPerPage` behind a pager.
   */
  segmentOverflow?: 'scroll' | 'paginate'
  /** Provisions per page when segmentOverflow is 'paginate'. Default 20. */
  segmentsPerPage?: number
  /**
   * The score threshold the IR results view starts from: cards below it dim,
   * provisions below it are not pre-ticked. The host's slider overrides it
   * at runtime through the `threshold` prop.
   */
  threshold?: number
  /** Field holding the relevance score for IR results. Default 'score'. */
  relevanceField?: string
  /** Field holding the snippet text for IR results. Default 'snippet'. */
  snippetField?: string
  /** Optional formatter for the score. */
  scoreFormatter?: (value: unknown) => string
  /** Minimum relevance to include a node in graph mode. */
  minRelevance?: number
  /** Graph metrics to compute and show as extra columns. Empty/absent = none. */
  analytics?: string[]
  /** Column headers for analytics metrics. */
  metricHeaders?: Record<string, string>
  tooltip?: TooltipConfig
  /** Fields shown in the document details panel. */
  details?: DetailField[]
  /** Field holding a summary paragraph, rendered as its own section. */
  summaryField?: string
  /** Field holding the primary date, for ranges and timelines. */
  dateField?: string
  /** Categorical breakdowns shown for a cluster. */
  breakdowns?: BreakdownConfig[]
  labels?: VisualizerLabels
}

// --- value helpers used by the presets -------------------------------------

const firstOf = (...values: unknown[]): unknown =>
  values.find((value) => value !== undefined && value !== null && value !== '')

const joinList = (value: unknown): unknown =>
  Array.isArray(value) ? (value.length ? value.join(', ') : undefined) : value

const inDegree = (node: GraphNode, graph: DocumentSetV1): number =>
  graph.edges.filter((edge) => edge.target === node.id).length

const buildHudocUrl = (itemid: string): string =>
  `https://hudoc.echr.coe.int/eng#%7B%22itemid%22:%5B%22${encodeURIComponent(itemid)}%22%5D%7D`

const CASE_LAW_ANALYTICS = [
  'degree',
  'inDegree',
  'outDegree',
  'degreeCentrality',
  'betweennessCentrality',
  'closenessCentrality',
  'pageRank',
  'community',
]

const CASE_LAW_METRIC_HEADERS: Record<string, string> = {
  degree: 'Degree',
  inDegree: 'In Degree',
  outDegree: 'Out Degree',
  degreeCentrality: 'Degree Centrality',
  betweennessCentrality: 'Betweenness',
  closenessCentrality: 'Closeness',
  pageRank: 'PageRank',
  community: 'Community',
}

const CASE_LAW_COLUMNS: ColumnConfig[] = [
  {
    field: 'fullTextUrl',
    header: 'Full Text',
    type: 'link',
    width: '80px',
    value: (n) => n.data.url_publication,
  },
  { field: 'ecli', header: 'ECLI', type: 'default', sortable: true, width: '200px', value: (n) => n.id },
  {
    field: 'date',
    header: 'Date',
    type: 'default',
    sortable: true,
    width: '120px',
    value: (n) => firstOf(n.data.date_decision, n.data.date_judgment),
  },
  {
    field: 'summary',
    header: 'Summary',
    type: 'ellipsis',
    sortable: true,
    maxWidth: '300px',
    value: (n) => firstOf(n.data.summary, n.data.conclusion),
  },
  {
    field: 'instance',
    header: 'Instance',
    type: 'default',
    sortable: true,
    width: '200px',
    value: (n) => firstOf(n.data.instance, n.data.respondent_state),
  },
  {
    field: 'domain',
    header: 'Domain',
    type: 'default',
    width: '180px',
    value: (n) => joinList(firstOf(n.data.domains, n.data.keywords)),
  },
  {
    field: 'decisionSummary',
    header: 'Decision Summary',
    type: 'default',
    sortable: true,
    width: '150px',
    value: (n) => n.data.document_type,
  },
  {
    field: 'timesCited',
    header: 'Times Cited',
    type: 'number',
    sortable: true,
    width: '120px',
    value: (n, g) => inDegree(n, g),
  },
  {
    field: 'topic',
    header: 'Topic',
    type: 'default',
    sortable: true,
    width: '150px',
    value: (n) => n.data.procedure_type,
  },
]

const CITATION_EDGES: EdgeConfig = {
  typeField: 'relation_type',
  defaultType: 'cites',
  types: {
    cites: { label: 'cites', color: '#8aa6b8', direction: 'forward' },
    cited_by: { label: 'cited by', color: '#c0a36e', direction: 'backward' },
  },
}

/** The default case-law workflow (Rechtspraak). */
export const caseLawConfig: VisualizerConfig = {
  id: 'caseLaw',
  nodes: { id: 'id', label: 'ecli', secondaryLabel: 'title', type: 'dataset', size: 'degree' },
  edges: CITATION_EDGES,
  grouping: { mode: 'community' },
  columns: CASE_LAW_COLUMNS,
  analytics: CASE_LAW_ANALYTICS,
  metricHeaders: CASE_LAW_METRIC_HEADERS,
  tooltip: {
    title: 'ecli',
    subtitle: 'title',
    lines: [{ label: 'Summary', field: 'summary' }],
  },
  details: [
    { label: 'Date', field: 'date_decision' },
    { label: 'Instance', field: 'instance' },
    { label: 'Domains', field: 'domains', type: 'list' },
    { label: 'Document Type', field: 'document_type' },
    { label: 'Procedure Type', field: 'procedure_type' },
    { label: 'Jurisdiction', field: 'jurisdiction_country' },
    { label: 'Publication', field: 'url_publication', type: 'link' },
  ],
  summaryField: 'summary',
  dateField: 'date_decision',
  breakdowns: [
    { title: 'By domain', field: 'domains', multi: true },
    { title: 'By instance', field: 'instance' },
    { title: 'By document type', field: 'document_type' },
    { title: 'Most-cited provisions', field: 'legal_provisions', multi: true },
  ],
  labels: { entity: 'Document', entityPlural: 'Documents', idLabel: 'ECLI' },
}

/** The ECHR workflow. */
export const echrConfig: VisualizerConfig = {
  ...caseLawConfig,
  id: 'echr',
  columns: [
    {
      field: 'fullTextUrl',
      header: 'Full Text',
      type: 'link',
      width: '80px',
      value: (n) => (n.data.itemid ? buildHudocUrl(String(n.data.itemid)) : undefined),
    },
    { field: 'ecli', header: 'ECLI', type: 'default', sortable: true, width: '200px', value: (n) => n.id },
    {
      field: 'date',
      header: 'Date',
      type: 'default',
      sortable: true,
      width: '120px',
      value: (n) => firstOf(n.data.date_judgment, n.data.date_decision),
    },
    {
      field: 'conclusion',
      header: 'Conclusion',
      type: 'ellipsis',
      sortable: true,
      maxWidth: '300px',
      value: (n) => n.data.conclusion,
    },
    {
      field: 'respondent_state',
      header: 'Respondent State',
      type: 'default',
      sortable: true,
      width: '200px',
      value: (n) => n.data.respondent_state,
    },
    {
      field: 'importance',
      header: 'Importance',
      type: 'number',
      sortable: true,
      width: '110px',
      value: (n) => n.data.importance,
    },
  ],
  details: [
    { label: 'Date', field: 'date_judgment' },
    { label: 'Respondent State', field: 'respondent_state' },
    { label: 'Keywords', field: 'keywords', type: 'list' },
    { label: 'Document Type', field: 'document_type' },
    { label: 'Importance', field: 'importance', type: 'number' },
    {
      label: 'Publication',
      field: 'itemid',
      type: 'link',
      value: (n) => (n.data.itemid ? buildHudocUrl(String(n.data.itemid)) : undefined),
    },
  ],
  summaryField: 'conclusion',
  dateField: 'date_judgment',
  breakdowns: [
    { title: 'By respondent state', field: 'respondent_state' },
    { title: 'By keyword', field: 'keywords', multi: true },
    { title: 'By document type', field: 'document_type' },
    { title: 'By importance', field: 'importance' },
    { title: 'Articles violated', field: 'article_violated', multi: true },
    { title: 'Articles applied', field: 'article_applied', multi: true },
  ],
}

/** The generic provisions workflow. */
export const provisionsConfig: VisualizerConfig = {
  id: 'provisions',
  nodes: { id: 'id', label: 'title', type: 'instrument', size: 'degree' },
  edges: {
    typeField: 'relation_type',
    defaultType: 'related',
    types: {
      'Is a': { label: 'Is a', color: '#7aa6c2', direction: 'forward' },
      'Has a': { label: 'Has a', color: '#7ac29a', direction: 'forward' },
      'Belongs to': { label: 'Belongs to', color: '#c2a17a', direction: 'forward' },
      Implies: { label: 'Implies', color: '#b07ac2', direction: 'forward' },
      'Depends on': { label: 'Depends on', color: '#c27a7a', direction: 'forward' },
      'Related to': { label: 'Related to', color: '#9aa6b8', direction: 'bidirectional' },
      'Is not': { label: 'Is not', color: '#b8b8b8', direction: 'none' },
      'Part of': { label: 'Part of', color: '#7ac2c2', direction: 'forward' },
    },
  },
  grouping: { mode: 'parent', field: 'instrument' },
  columns: [
    { field: 'id', header: 'Provision ID', type: 'default', sortable: true, width: '200px', value: (n) => n.id },
    { field: 'title', header: 'Title', type: 'default', sortable: true, width: '280px', value: (n) => n.data.title },
    {
      field: 'instrument',
      header: 'Instrument',
      type: 'default',
      sortable: true,
      width: '180px',
      value: (n) => n.data.instrument,
    },
  ],
  analytics: ['degree', 'inDegree', 'outDegree'],
  metricHeaders: { degree: 'Degree', inDegree: 'In Degree', outDegree: 'Out Degree' },
  tooltip: { title: 'title', subtitle: 'instrument' },
  details: [
    { label: 'Title', field: 'title' },
    { label: 'Instrument', field: 'instrument' },
  ],
  summaryField: 'text',
  breakdowns: [{ title: 'By instrument', field: 'instrument' }],
  labels: { entity: 'Provision', entityPlural: 'Provisions', idLabel: 'Provision ID' },
}

/** The presets this package ships, by id. */
export const irConfig: VisualizerConfig = {
  id: 'ir',
  nodes: { id: 'id', label: 'title', type: 'result', size: 'score' },
  edges: { typeField: 'relation_type', defaultType: 'related', types: {} },
  grouping: { mode: 'none' },
  views: ['documents'],
  documentsView: 'results',
  threshold: 0.2,
  relevanceField: 'score',
  snippetField: 'snippet',
  columns: [
    { field: 'rank', header: 'Rank', type: 'number', sortable: true, width: '70px', value: (n) => n.data.rank },
    { field: 'title', header: 'Title', type: 'default', sortable: true, width: '240px', value: (n) => n.data.title },
    { field: 'score', header: 'Score', type: 'number', sortable: true, width: '90px', value: (n) => n.data.score },
    { field: 'snippet', header: 'Snippet', type: 'highlighted', maxWidth: '400px', value: (n) => n.data.snippet },
  ],
  analytics: [],
  tooltip: { title: 'title', subtitle: 'score' },
  details: [
    { label: 'Score', field: 'score', type: 'number' },
    { label: 'Snippet', field: 'snippet' },
  ],
  summaryField: 'snippet',
  labels: { entity: 'Result', entityPlural: 'Results', idLabel: 'ID' },
}

export const visualizerPresets: Record<string, VisualizerConfig> = {
  caseLaw: caseLawConfig,
  echr: echrConfig,
  provisions: provisionsConfig,
  ir: irConfig,
}

/** Resolve a preset id or a full config into a config. */
export function resolveVisualizerConfig(
  configOrId: VisualizerConfig | string | undefined,
): VisualizerConfig | undefined {
  if (configOrId === undefined) return undefined
  if (typeof configOrId === 'string') return visualizerPresets[configOrId]
  return configOrId
}

export interface FactoryOptions {
  /** A preset id or a full config. */
  config?: VisualizerConfig | string
  /** Import-time view selection; overrides the config's `views` when given. */
  views?: ('documents' | 'graph')[]
}

export interface ResolvedFactoryConfig {
  config: VisualizerConfig
}

/**
 * Resolve the factory's import-time options into a full config. Preset ids
 * resolve through `visualizerPresets`; an explicit `views` option wins over
 * the config's own `views`. Import-time config is authoritative for views
 * once resolved — runtime cannot widen them.
 */
export function resolveFactoryConfig(options: FactoryOptions = {}): ResolvedFactoryConfig {
  const resolved = resolveVisualizerConfig(options.config) ?? resolveVisualizerConfig('ir')!
  if (options.views === undefined) return { config: resolved }
  return { config: { ...resolved, views: options.views } }
}

/** Merge a preset with host overrides: scalars win, columns/analytics replace. */
export function mergeVisualizerConfig(
  base: VisualizerConfig,
  override: Partial<VisualizerConfig> = {},
): VisualizerConfig {
  return {
    id: override.id ?? base.id,
    nodes: { ...base.nodes, ...override.nodes },
    edges: {
      ...base.edges,
      ...override.edges,
      types: override.edges?.types ?? base.edges.types,
    },
    grouping: { ...base.grouping, ...override.grouping },
    columns: override.columns ?? base.columns,
    views: override.views ?? base.views,
    documentsView: override.documentsView ?? base.documentsView,
    segmentOverflow: override.segmentOverflow ?? base.segmentOverflow,
    segmentsPerPage: override.segmentsPerPage ?? base.segmentsPerPage,
    threshold: override.threshold ?? base.threshold,
    relevanceField: override.relevanceField ?? base.relevanceField,
    snippetField: override.snippetField ?? base.snippetField,
    scoreFormatter: override.scoreFormatter ?? base.scoreFormatter,
    minRelevance: override.minRelevance ?? base.minRelevance,
    analytics: override.analytics ?? base.analytics,
    metricHeaders: override.metricHeaders ?? base.metricHeaders,
    tooltip: override.tooltip ?? base.tooltip,
    details: override.details ?? base.details,
    summaryField: override.summaryField ?? base.summaryField,
    dateField: override.dateField ?? base.dateField,
    breakdowns: override.breakdowns ?? base.breakdowns,
    labels: { ...base.labels, ...override.labels },
  }
}

/**
 * Adapt the case-law `docs`/`edges` props into `document-set@1`, so existing
 * consumers keep working while the canonical input is introduced.
 */
export function documentSetFromLegalDocs(
  docs: LegalDocument[] = [],
  edges: LegalEdge[] = [],
): DocumentSetV1 {
  return {
    nodes: docs.map((doc) => ({
      id: String(doc.id),
      data: {
        ...(doc.data ?? {}),
        // Keep the top-level grouping key reachable from node.data.
        ...(doc.parent !== undefined ? { parent: doc.parent } : {}),
      } as Record<string, unknown>,
    })),
    edges: edges.map((edge, index) => {
      const record = edge as unknown as Record<string, unknown>
      return {
        id: (record.id as string | undefined) ?? `e${index}`,
        source: String(record.source),
        target: String(record.target),
        relation_type: record.relation_type as string | undefined,
      }
    }),
  }
}


// --- IR types & adapter ------------------------------------------------------

export interface IRSegment {
  id: string
  text: string
  score?: number
}

export interface IRResult {
  id: string
  title?: string
  score: number
  snippet?: string
  highlights?: { start: number; end: number }[]
  rank?: number
  segments?: IRSegment[]
  metadata?: Record<string, unknown>
}

/**
 * A result's full document, as the host's loader returns it for the results
 * view's "Full document" tab. `sections` renders one block per provision;
 * without them `text` is shown as one block.
 */
export interface IRDocumentDetail {
  id: string
  title?: string
  text?: string
  sections?: { heading?: string; text: string }[]
}

/**
 * The host callback that loads a result's full document, when it has one.
 * The package never calls an API: without the loader the results view simply
 * does not offer the "Full document" tab.
 */
export type IRDocumentLoader = (
  nodeId: string,
) => Promise<IRDocumentDetail | undefined> | IRDocumentDetail | undefined

export function irResultsToDocumentSet(
  results: IRResult[] = [],
  relations: IRRelationInput[] = [],
): DocumentSetV1 {
  return {
    nodes: results.map((r, i) => ({
      id: String(r.id),
      data: {
        ...(r.metadata ?? {}),
        title: r.title,
        score: r.score,
        snippet: r.snippet,
        highlights: r.highlights ?? [],
        rank: r.rank ?? i + 1,
        segments: r.segments ?? [],
      },
    })),
    edges: irRelationsToEdges(relations),
  }
}

/** A relation between retrieved documents, as a retrieval backend returns it. */
export interface IRRelationInput {
  source: string
  target: string
  relation_type?: string
}

/** Map retrieval-backend relations into canonical graph edges. */
export function irRelationsToEdges(relations: IRRelationInput[] = []): GraphEdge[] {
  return relations.map((relation, index) => ({
    id: `rel${index}`,
    source: String(relation.source),
    target: String(relation.target),
    relation_type: relation.relation_type,
  }))
}


