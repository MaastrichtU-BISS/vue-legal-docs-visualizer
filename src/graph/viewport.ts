import type { Core } from 'cytoscape'

// What the zoom and fit buttons do, for every graph in this package.

const ZOOM_STEP = 1.2

export const zoomIn = (cy: Core | null) => cy?.zoom(cy.zoom() * ZOOM_STEP)
export const zoomOut = (cy: Core | null) => cy?.zoom(cy.zoom() / ZOOM_STEP)
export const fitToView = (cy: Core | null) => cy?.fit()
