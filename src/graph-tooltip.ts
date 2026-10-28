// Graph tooltip content: pure mapping from node data + display config to the
// tooltip the graph view renders. Kept free of Vue and cytoscape so the
// content policy is testable without mounting.
//
// Compatibility contract: with the case-law preset's config the rendered
// content is unchanged — node id as headline, the subtitle field as the bold
// line, one unlabeled summary line, and 'No summary available' when nothing
// fills it.

import type { GraphNode, TooltipConfig } from './config'

/** Read a display field from a node, tolerating missing values. */
export function fieldValue(node: GraphNode, field?: string): string | undefined {
  if (!field) return undefined
  const value = node.data?.[field]
  return value === undefined || value === null || value === '' ? undefined : String(value)
}

export interface TooltipLineView {
  label: string
  text: string
  clamp: boolean
}

export interface TooltipView {
  /** The tooltip's top line: the `headline` field's value, else the node id. */
  headline: string
  /** The `title` field's value; dropped when absent or equal to the headline. */
  title: string
  subtitle: string
  /** Every configured line that resolved to a value. */
  lines: TooltipLineView[]
  /** Shown when the config declares lines but none resolved to a value. */
  fallback: string
}

const NO_SUMMARY = 'No summary available'

export function buildTooltipView(node: GraphNode, config?: TooltipConfig): TooltipView {
  const cfg = config ?? {}
  const headline = fieldValue(node, cfg.headline) ?? node.id

  // A title that restates the headline (the case-law preset's title field IS
  // the node id) would render the same string twice — drop it.
  const titleValue = fieldValue(node, cfg.title) ?? ''
  const title = titleValue && titleValue !== headline ? titleValue : ''

  const lines: TooltipLineView[] = []
  for (const line of cfg.lines ?? []) {
    const raw = line.value ? line.value(node) : fieldValue(node, line.field)
    if (raw === undefined || raw === null || raw === '') continue
    lines.push({ label: line.label, text: String(raw), clamp: line.clamp === true })
  }

  return {
    headline,
    title,
    subtitle: fieldValue(node, cfg.subtitle) ?? '',
    lines,
    fallback: lines.length === 0 ? NO_SUMMARY : '',
  }
}
