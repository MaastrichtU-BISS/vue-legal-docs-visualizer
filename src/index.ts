import type { App } from 'vue'
import LegalDocVisualizer from './components/LegalDocVisualizer.vue'

export { LegalDocVisualizer }
export type { LegalDocument } from 'legal-docs-client'

export interface LegalDocsVisualizerPlugin {
  install: (app: App) => void
}

const plugin: LegalDocsVisualizerPlugin = {
  install: (app: App) => {
    app.component('LegalDocVisualizer', LegalDocVisualizer)
  }
}

export default plugin
