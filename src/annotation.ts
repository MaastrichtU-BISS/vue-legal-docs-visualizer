// Annotation-kit hand-off adapter: turns the IR results the visualizer
// displayed (and the segments its user selected) into the document shape
// `legal-annotation-kit`'s `TaskData.documents` expects. Mirrors the kit's
// `AnnotationDocument` contract without depending on it — the host composes
// the two packages and owns the rest of the task file (labelset, assignments).
//
// Segmented documents are NOT concatenated into one `full_text`: each
// selected segment becomes its own annotation-kit document, so the annotator
// works span-level on the segment that was actually selected.

import type { DocumentSetV1, GraphEdge, GraphNode, IRResult } from './config'

/** Mirrors `AnnotationDocument` from legal-annotation-kit (types only). */
export interface AnnotationKitDocument {
  name: string
  full_text: string
  /** How relations refer to this document; set when `name` is not the id. */
  key?: string
}

/** Mirrors the kit's `DocumentRelation` (types only). */
export interface AnnotatedDocumentRelation {
  to: string
  labels?: string[]
  metadata?: Record<string, unknown> | null
}

/** The part of the kit's `Assignment` the graph derivation needs (types only). */
export interface AnnotatedAssignment {
  documentName: string
  documentKey?: string
  document_relations?: AnnotatedDocumentRelation[] | null
  document_annotations?: { label: string }[] | null
}

/**
 * Build annotation-kit documents from IR results.
 *
 * - Results **with** segments: every in-scope segment becomes its own
 *   annotation-kit document (`full_text` is that segment alone). In-scope =
 *   all segments when `selectedSegmentIds` is omitted, otherwise just the
 *   selected ones.
 * - Results **without** segments (or with none in scope): the whole result
 *   stays one document, falling back to its snippet.
 *
 * `name` is the result title (falling back to its id); `key` carries the
 * document or segment id so relations can reference documents unambiguously.
 */
export function irResultsToAnnotationDocuments(
  results: IRResult[] = [],
  selectedSegmentIds?: Set<string> | string[],
): AnnotationKitDocument[] {
  const selected = selectedSegmentIds
    ? selectedSegmentIds instanceof Set
      ? selectedSegmentIds
      : new Set(selectedSegmentIds)
    : undefined

  const documents: AnnotationKitDocument[] = []
  for (const result of results) {
    const segments = result.segments ?? []
    const inScope =
      selected === undefined
        ? segments
        : segments.filter((segment) => selected.has(segment.id))

    if (inScope.length > 0) {
      const baseName = result.title ?? result.id
      for (const segment of inScope) {
        documents.push({
          name: `${baseName} · ${segment.id}`,
          full_text: segment.text,
          key: segment.id,
        })
      }
    } else {
      const name = result.title ?? result.id
      documents.push({
        name,
        full_text: result.snippet ?? '',
        ...(name === result.id ? {} : { key: result.id }),
      })
    }
  }
  return documents
}

// --- the annotated loop: assignments back into the graph ----------------------

export interface AssignmentsToDocumentSetOptions {
  /** Include the parent-document nodes next to the segment nodes. Default true. */
  includeParentDocuments?: boolean
  /** How an edge's relation_type joins an annotation relation's labels. */
  relationTypeSeparator?: string
}

/**
 * Derive the annotated graph: segment nodes (carrying their parent document's
 * info) from the IR results, and one edge per document relation created
 * during annotation. This closes the retrieval -> selection -> annotation ->
 * visualization loop as a pure function, so a platform pipeline can wire it
 * by configuration.
 *
 * - Nodes: every segment of every result (`data.parent` = the document id,
 *   `data.parent_title` = the document title, `data.document_tags` = the
 *   document-level labels the annotator applied). When
 *   `includeParentDocuments` is on (default), the parent documents are nodes
 *   too, so `grouping: {mode:'parent', field:'parent'}` compounds segments
 *   under visible parents.
 * - Edges: `source` = the annotating queue document's key (falling back to
 *   its name), `target` = `relation.to`, `relation_type` = the relation's
 *   labels joined with `relationTypeSeparator` (default " / "). Relations
 *   pointing outside the node set are skipped; duplicates collapse.
 */
export function assignmentsToDocumentSet(
  results: IRResult[] = [],
  assignments: AnnotatedAssignment[] = [],
  options: AssignmentsToDocumentSetOptions = {},
): DocumentSetV1 {
  const includeParents = options.includeParentDocuments ?? true
  const separator = options.relationTypeSeparator ?? ' / '

  const nodes: GraphNode[] = []
  const knownIds = new Set<string>()
  const annotationBySource = new Map<string, AnnotatedAssignment>()

  for (const assignment of assignments) {
    const source = assignment.documentKey ?? assignment.documentName
    if (source) annotationBySource.set(source, assignment)
  }

  for (const result of results) {
    const parentTitle = result.title ?? result.id
    const documentTags = (annotationBySource.get(result.id)?.document_annotations ?? [])
      .map((tag) => tag.label)
      .filter(Boolean)

    if (includeParents) {
      knownIds.add(result.id)
      nodes.push({
        id: result.id,
        data: {
          id: result.id,
          title: parentTitle,
          type: 'document',
          ...(documentTags.length > 0 ? { document_tags: documentTags } : {}),
        },
      })
    }

    for (const segment of result.segments ?? []) {
      knownIds.add(segment.id)
      const segmentAssignment = annotationBySource.get(segment.id)
      const tags = (segmentAssignment?.document_annotations ?? [])
        .map((tag) => tag.label)
        .filter(Boolean)
      nodes.push({
        id: segment.id,
        data: {
          id: segment.id,
          title: segment.id,
          text: segment.text,
          parent: result.id,
          parent_title: parentTitle,
          type: 'segment',
          ...(segmentAssignment?.document_annotations?.length
            ? { span_count: segmentAssignment.document_annotations.length }
            : {}),
          ...(tags.length > 0 ? { document_tags: tags } : {}),
        },
      })
    }
  }

  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  for (const assignment of assignments) {
    const source = assignment.documentKey ?? assignment.documentName
    if (!source || !knownIds.has(source)) continue
    for (const relation of assignment.document_relations ?? []) {
      if (!knownIds.has(relation.to)) continue
      const relation_type = (relation.labels ?? []).join(separator)
      const edgeId = `${source}->${relation.to}:${relation_type}`
      if (seen.has(edgeId)) continue
      seen.add(edgeId)
      edges.push({ id: edgeId, source, target: relation.to, relation_type })
    }
  }

  return { nodes, edges }
}
