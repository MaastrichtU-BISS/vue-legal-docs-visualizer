import type { NetworkEdge, NetworkNode } from './types'
import { colorsForGroups, DEFAULT_NODE_COLOR } from './palette'

// Turns the public input (NetworkNode / NetworkEdge) into what cytoscape is
// given. Pure and free of cytoscape itself, so the rules below (which input is
// dropped, merged or defaulted) can be tested on their own.

export interface NodeElement {
  data: { id: string; label: string; color: string }
}

export interface EdgeElement {
  data: { id: string; source: string; target: string; label: string }
}

export interface GraphElements {
  nodes: NodeElement[]
  edges: EdgeElement[]
}

/**
 * - A node listed twice keeps its first definition.
 * - A node's colour is its own `color`, else its group's, else the default.
 * - An edge to or from an unknown node is dropped.
 * - Edges with the same endpoints become one: their labels are joined.
 */
export function buildElements(nodes: NetworkNode[], edges: NetworkEdge[]): GraphElements {
  const groupColors = colorsForGroups(nodes.flatMap((n) => (n.group ? [n.group] : [])))

  const seen = new Set<string>()
  const nodeElements: NodeElement[] = []
  for (const node of nodes) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    nodeElements.push({
      data: {
        id: node.id,
        label: node.label ?? node.id,
        color: node.color ?? (node.group ? groupColors.get(node.group) : undefined) ?? DEFAULT_NODE_COLOR
      }
    })
  }

  const byEnds = new Map<string, EdgeElement>()
  for (const edge of edges) {
    if (!seen.has(edge.source) || !seen.has(edge.target)) continue
    const id = `${edge.source}->${edge.target}`
    const existing = byEnds.get(id)
    if (!existing) {
      byEnds.set(id, { data: { id, source: edge.source, target: edge.target, label: edge.label ?? '' } })
    } else if (edge.label && !existing.data.label.split(', ').includes(edge.label)) {
      existing.data.label = existing.data.label ? `${existing.data.label}, ${edge.label}` : edge.label
    }
  }

  return { nodes: nodeElements, edges: [...byEnds.values()] }
}

/** Whether a node matches a search typed by the user: any case, in its id, label, title or description. */
export function nodeMatches(node: NetworkNode, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [node.id, node.label, node.title, node.description].some((text) => text?.toLowerCase().includes(q))
}
