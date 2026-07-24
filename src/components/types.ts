import type { RechtspraakDocument, EchrDocument } from 'legal-docs-client'

export enum VisualizationMode {
    TABLE = 'table',
    GRAPH = 'graph'
}

export type LegalDocument = RechtspraakDocument | EchrDocument

export const isEchrDocument = (doc: LegalDocument): doc is EchrDocument =>
    (doc.data as EchrDocument['data'])?.dataset === 'ECHR'