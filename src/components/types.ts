import type { RechtspraakDocument, EchrDocument, RechtspraakEdge, EchrEdge } from 'legal-docs-types'

export enum VisualizationMode {
    TABLE = 'table',
    GRAPH = 'graph'
}

export type LegalDocument = RechtspraakDocument | EchrDocument

export type LegalEdge = RechtspraakEdge | EchrEdge

export const isEchrDocument = (doc: LegalDocument): doc is EchrDocument =>
    (doc.data as EchrDocument['data'])?.dataset === 'ECHR'