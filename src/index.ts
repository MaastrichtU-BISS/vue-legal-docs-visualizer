import type { App } from 'vue'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import Aura from '@primeuix/themes/aura'
import Graph from './components/Graph.vue'
import LegalDocVisualizer from './components/LegalDocVisualizer.vue'
import './styles/main.css'

export { Graph, LegalDocVisualizer }
export type { LegalDocument, LegalEdge } from './components/types'

// Canonical document-set@1 input, the workflow-agnostic view config, presets
// and the case-law adapter. Additive — the docs/edges props still work.
export * from './config'
export * from './createVisualizer'
export * from './relevance'
export * from './annotation'

// Annotation -> document-set@1 adapter (folds in the link-graph build step).
export * from './linkGraph'

export interface LegalDocsVisualizerPlugin {
  install: (app: App) => void
}

const plugin: LegalDocsVisualizerPlugin = {
  install: (app: App) => {
    // Configure PrimeVue automatically
    if (!app.config.globalProperties.$primevue) {
      app.use(PrimeVue, {
        theme: {
          preset: Aura,
          options: {
            darkModeSelector: false || 'none',
          }
        },
        pt: {
          tooltip: {
            root: {
              style: {
                maxWidth: '300px',
                fontFamily: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Roboto\', \'Helvetica Neue\', Arial, sans-serif'
              }
            }
          }
        }
      })
    }
    
    // Register tooltip directive
    app.directive('tooltip', Tooltip)
    
    app.component('Graph', Graph)
  }
}

export default plugin
