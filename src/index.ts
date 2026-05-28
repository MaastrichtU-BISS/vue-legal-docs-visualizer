import type { App } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import LegalDocVisualizer from './components/LegalDocVisualizer.vue'
import Graph from './components/Graph.vue'

export { LegalDocVisualizer, Graph }
export type { LegalDocument } from 'legal-docs-client'

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
        }
      })
    }
    
    app.component('LegalDocVisualizer', LegalDocVisualizer)
    app.component('Graph', Graph)
  }
}

export default plugin
