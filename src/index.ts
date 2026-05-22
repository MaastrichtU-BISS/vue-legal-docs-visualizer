import type { App } from 'vue'
import LegalDocVisualizer from './components/LegalDocVisualizer.vue'
import Graph from './components/Graph.vue'

export { LegalDocVisualizer, Graph }
export type { LegalDocument } from 'legal-docs-client'

export interface LegalDocsVisualizerPlugin {
  install: (app: App) => void
}

const plugin: LegalDocsVisualizerPlugin = {
  install: (app: App) => {
    app.component('LegalDocVisualizer', LegalDocVisualizer)
    app.component('Graph', Graph)
  }
}

export default plugin
