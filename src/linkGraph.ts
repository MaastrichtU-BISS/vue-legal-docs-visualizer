// Annotation -> document-set@1 adapter.
//
// Folds the link-graph build step into the visualizer: the annotation kit emits
// per-document relations (DocumentRelation { to, labels[], metadata }); this
// turns an annotated task's documents into the canonical graph the visualizer
// renders. Pure functions only — the host still supplies the raw annotations.

import type { DocumentSetV1, GraphEdge, GraphNode } from './config'

/** One relation from a document to another, as the annotation kit carries it. */
export interface AnnotationRelation {
  /** Target document's key — its `name` unless the host gave it a `key`. */
  to: string
  labels: string[]
  /** Free-form host data carried with the relation (e.g. link strength). */
  metadata?: Record<string, unknown> | null
}

/** A document with its outgoing relations, as the annotation kit carries it. */
export interface AnnotatedDocument {
  name: string
  /** How relations refer to this document; defaults to `name`. */
  key?: string
  full_text?: string
  relations?: AnnotationRelation[]
}

export interface LinkGraphOptions {
  /** Keep documents that have no links; off drops the isolated nodes. */
  includeUnlinked?: boolean
  /** Group documents into a compound cluster by this key (e.g. an instrument). */
  groupBy?: (doc: AnnotatedDocument) => string | undefined
  /** Which label of a relation becomes the edge type. Default: the first. */
  relationType?: (relation: AnnotationRelation) => string | undefined
}

const keyOf = (doc: AnnotatedDocument): string => doc.key ?? doc.name

/**
 * Build a `document-set@1` from annotated documents: one node per document, one
 * edge per relation whose target exists in the set. The first relation label is
 * the edge type unless `relationType` overrides it.
 */
export function documentSetFromAnnotations(
  documents: AnnotatedDocument[] = [],
  options: LinkGraphOptions = {},
): DocumentSetV1 {
  const { includeUnlinked = true, groupBy, relationType } = options

  const nodes: GraphNode[] = documents.map((doc) => {
    const parent = groupBy?.(doc)
    return {
      id: keyOf(doc),
      data: {
        title: doc.name,
        ...(doc.full_text !== undefined ? { text: doc.full_text } : {}),
        ...(parent !== undefined ? { parent } : {}),
      },
    }
  })

  const ids = new Set(nodes.map((node) => node.id))
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  for (const doc of documents) {
    const source = keyOf(doc)
    for (const relation of doc.relations ?? []) {
      if (!ids.has(relation.to)) continue
      const id = `${source}->${relation.to}`
      if (seen.has(id)) continue
      seen.add(id)
      edges.push({
        id,
        source,
        target: relation.to,
        relation_type: relationType ? relationType(relation) : relation.labels?.[0],
      })
    }
  }

  const keptNodes = includeUnlinked
    ? nodes
    : nodes.filter((node) => edges.some((edge) => edge.source === node.id || edge.target === node.id))

  return { nodes: keptNodes, edges }
}
