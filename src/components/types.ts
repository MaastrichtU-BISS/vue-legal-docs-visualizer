import type { RechtspraakDocument, EchrDocument, RechtspraakEdge, EchrEdge } from 'legal-docs-types'

export enum VisualizationMode {
    TABLE = 'table',
    GRAPH = 'graph'
}

/** A document plus the optional host grouping key. When `parent` (or
 * `data.parent`) is set, the graph compounds the document under that group
 * instead of the community-detection cluster — BlueLab uses it for instruments.
 * Hosts may also carry `data.instrument` / `data.instrument_title` for the
 * group label. */
export type LegalDocument = (RechtspraakDocument | EchrDocument) & {
    parent?: string
    data?: (RechtspraakDocument['data'] | EchrDocument['data']) & {
        parent?: string
        instrument?: string
        instrument_title?: string
    }
}

/** An edge, optionally carrying a BlueLab-style `relation_type` (the link
 * type) which the graph renders as a label and colour. */
export type LegalEdge = (RechtspraakEdge | EchrEdge) & {
    relation_type?: string
}

export const isEchrDocument = (doc: LegalDocument): doc is EchrDocument =>
    (doc.data as EchrDocument['data'])?.dataset === 'ECHR'