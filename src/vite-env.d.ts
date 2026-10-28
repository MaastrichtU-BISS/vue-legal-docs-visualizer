/// <reference types="vite/client" />

/**
 * The details panel's presentation, decided when the CONSUMING app builds:
 * a PrimeVue drawer pinned to the right edge ('drawer') or a centered,
 * maximizable dialog ('modal'). The consuming app sets it in its Vite
 * config, where the bundler folds the choice into the bundle:
 *
 *     define: { __LEGAL_VISUALIZER_DETAILS_PRESENTATION__: "'modal'" }
 *
 * Unset, the panel falls back to the modal at runtime.
 */
declare const __LEGAL_VISUALIZER_DETAILS_PRESENTATION__: 'drawer' | 'modal'

declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape'
  const register: Ext
  export default register
}

declare module 'cytoscape-expand-collapse' {
  const register: (cytoscape: any) => void
  export default register
}
