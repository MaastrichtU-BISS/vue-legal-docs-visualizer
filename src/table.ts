// Pure table model for the visualizer: turns a document-set@1 + a
// VisualizerConfig into columns and rows. Kept free of Vue so it is testable
// without mounting, and shared by the Table component.

import type { DocumentSetV1, GraphNode, VisualizerConfig } from './config'

export interface TableColumn {
  field: string
  header: string
  type: 'default' | 'number' | 'link' | 'button' | 'ellipsis' | 'highlighted'
  sortable: boolean
  width?: string
  maxWidth?: string
  buttonText?: string
  formatter?: (value: unknown, node: GraphNode) => string
}

/** A term occurrence inside the snippet text, as `IRResult.highlights` carries it. */
export interface HighlightRange {
  start: number
  end: number
}

export interface HighlightedChunk {
  text: string
  marked: boolean
}

/**
 * Split snippet text into plain and highlighted chunks, using the highlight
 * offsets the retrieval backend reported. Overlapping ranges merge; ranges
 * outside the text are clamped. Pure so the Table can render `<mark>` spans
 * from it and tests can pin the behavior.
 */
export function splitHighlights(
  text: string,
  highlights: HighlightRange[] = [],
): HighlightedChunk[] {
  const length = text.length
  if (length === 0) return []

  const marked = new Array<boolean>(length).fill(false)
  for (const range of highlights ?? []) {
    const start = Math.max(0, Math.floor(range.start))
    const end = Math.min(length, Math.floor(range.end))
    for (let i = start; i < end; i++) marked[i] = true
  }

  const chunks: HighlightedChunk[] = []
  for (let i = 0; i < length; ) {
    const isMarked = marked[i]
    let j = i + 1
    while (j < length && marked[j] === isMarked) j++
    chunks.push({ text: text.slice(i, j), marked: isMarked })
    i = j
  }
  return chunks
}

export interface TableRow {
  __id: string
  __node: GraphNode
  [field: string]: unknown
}

export interface TableModel {
  columns: TableColumn[]
  rows: TableRow[]
}

interface DegreeMaps {
  inDeg: Map<string, number>
  outDeg: Map<string, number>
}

function degreeMaps(graph: DocumentSetV1): DegreeMaps {
  const inDeg = new Map<string, number>()
  const outDeg = new Map<string, number>()
  for (const edge of graph.edges) {
    outDeg.set(edge.source, (outDeg.get(edge.source) ?? 0) + 1)
    inDeg.set(edge.target, (inDeg.get(edge.target) ?? 0) + 1)
  }
  return { inDeg, outDeg }
}

function prettyMetric(metric: string): string {
  return metric
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

function metricValue(
  metric: string,
  node: GraphNode,
  maps: DegreeMaps,
): unknown {
  const statistics = (node.data?.statistics ?? {}) as Record<string, unknown>
  if (typeof statistics[metric] === 'number') return statistics[metric]

  switch (metric) {
    case 'degree':
      return (maps.inDeg.get(node.id) ?? 0) + (maps.outDeg.get(node.id) ?? 0)
    case 'inDegree':
      return maps.inDeg.get(node.id) ?? 0
    case 'outDegree':
      return maps.outDeg.get(node.id) ?? 0
    default:
      return node.data?.[metric]
  }
}

export function buildTableModel(graph: DocumentSetV1, config: VisualizerConfig): TableModel {
  const accessors: { column: TableColumn; value: (node: GraphNode, graph: DocumentSetV1) => unknown }[] = []

  for (const column of config.columns) {
    accessors.push({
      column: {
        field: column.field,
        header: column.header,
        type: column.type ?? 'default',
        sortable: column.sortable ?? false,
        width: column.width,
        maxWidth: column.maxWidth,
        buttonText: column.buttonText,
        formatter: column.formatter,
      },
      value:
        column.value ??
        ((node: GraphNode) => (column.field === 'id' ? node.id : node.data?.[column.field])),
    })
  }

  const maps = degreeMaps(graph)
  for (const metric of config.analytics ?? []) {
    accessors.push({
      column: {
        field: `metric_${metric}`,
        header: config.metricHeaders?.[metric] ?? prettyMetric(metric),
        type: 'number',
        sortable: true,
      },
      value: (node: GraphNode) => metricValue(metric, node, maps),
    })
  }

  const rows: TableRow[] = graph.nodes.map((node) => {
    const row = { __id: node.id, __node: node } as TableRow
    for (const accessor of accessors) {
      row[accessor.column.field] = accessor.value(node, graph)
    }
    return row
  })

  return { columns: accessors.map((accessor) => accessor.column), rows }
}

/** Display text for a cell, matching the component's number/ellipsis rules. */
export function formatCell(value: unknown, column: TableColumn, node: GraphNode): string {
  if (column.formatter) return column.formatter(value, node)
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-'
    if (value < 0.01 && value > 0) return value.toExponential(4)
    return value % 1 === 0 ? value.toString() : value.toFixed(4)
  }
  return String(value)
}
