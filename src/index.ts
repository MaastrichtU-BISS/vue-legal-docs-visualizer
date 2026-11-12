import type { App } from 'vue'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import Aura from '@primeuix/themes/aura'
import LegalDocVisualizer from './components/LegalDocVisualizer.vue'
import Graph from './components/Graph.vue'
import NetworkGraph from './components/NetworkGraph.vue'
import './styles/main.css'

export { LegalDocVisualizer, Graph, NetworkGraph }
export type { LegalDocument, LegalEdge } from './components/types'
export type { NetworkNode, NetworkEdge } from './graph/types'

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
    
    app.component('LegalDocVisualizer', LegalDocVisualizer)
    app.component('Graph', Graph)
    app.component('NetworkGraph', NetworkGraph)
  }
}

export default plugin
