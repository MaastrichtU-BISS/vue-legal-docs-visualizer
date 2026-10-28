// Pure relevance-metric helpers for the graph view: which node field carries
// the relevance score, how it maps onto node size and color, and the
// `minRelevance` threshold. Kept free of Vue/cytoscape so tests can pin the
// behavior without mounting.

import type { GraphNode, VisualizerConfig } from './config'

/**
 * The node field the relevance metric comes from: the config's
 * `relevanceField` if set, else the node size field from `nodes.size`.
 * Returns undefined when neither is configured — callers then fall back to
 * the legacy degree-based sizing.
 */
export function resolveMetricField(config: VisualizerConfig): string | undefined {
  return config.relevanceField ?? config.nodes.size ?? undefined
}

/** The node's numeric value for the metric field, tolerating missing data. */
export function nodeMetric(node: GraphNode, field?: string): number | undefined {
  if (!field) return undefined
  const value = (node.data as Record<string, unknown> | undefined)?.[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export interface MetricRange {
  min: number
  max: number
}

/** The [min, max] span of the metric over a node set, when any node has one. */
export function metricRange(nodes: GraphNode[], field?: string): MetricRange | undefined {
  let min = Infinity
  let max = -Infinity
  let any = false
  for (const node of nodes) {
    const value = nodeMetric(node, field)
    if (value === undefined) continue
    any = true
    if (value < min) min = value
    if (value > max) max = value
  }
  return any ? { min, max } : undefined
}

/** True when the node carries a metric and it clears the threshold. */
export function passesMinRelevance(
  node: GraphNode,
  field: string | undefined,
  minRelevance: number | undefined,
): boolean {
  if (minRelevance === undefined) return true
  const value = nodeMetric(node, field)
  // Nodes without a metric value are kept — only measurable low scores drop.
  return value === undefined || value >= minRelevance
}

/** Map a metric value onto the graph's node-size range (20–80px, log-like). */
export function metricToSize(value: number, range: MetricRange): number {
  if (range.max <= range.min) return 50
  const t = (value - range.min) / (range.max - range.min)
  return Math.round(20 + t * 60)
}

// A calm blue ramp for relevance: low = pale gray-blue, high = deep blue.
const RAMP = ['#dbe4ec', '#b7cadd', '#8aa6b8', '#5b82a0', '#1d4ed8']

/** Map a metric value onto the color ramp, from low (0) to high (1). */
export function metricToColor(value: number, range: MetricRange): string {
  if (range.max <= range.min) return RAMP[RAMP.length - 1]
  const t = Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)))
  const index = Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))
  return RAMP[index]
}
