// The input of the generic network graph (NetworkGraph): plain nodes and
// edges, with nothing legal-specific in them. It is deliberately small, so any
// host can map its own data onto it — documents and the relations between
// them, say, or any other set of things that point at each other. Everything
// but a node's `id` and an edge's endpoints is optional.

export interface NetworkNode {
  /** Unique within the graph; edges refer to it. */
  id: string
  /** What the node shows. Defaults to `id`. */
  label?: string
  /** A first line in the hover tooltip. */
  title?: string
  /** The body of the hover tooltip. */
  description?: string
  /** Nodes of the same group share a colour. */
  group?: string
  /** An explicit colour (any CSS colour), taking precedence over `group`. */
  color?: string
}

export interface NetworkEdge {
  /** The `id` of the node the edge starts at. */
  source: string
  /** The `id` of the node the edge points at. */
  target: string
  /** Shown along the edge. */
  label?: string
}
