import { defineComponent, h } from 'vue'
import LegalDocVisualizer from './components/LegalDocVisualizer.vue'
import type { VisualizerConfig } from './config'

export interface CreateVisualizerOptions {
  config?: VisualizerConfig | string
  views?: ('documents' | 'graph')[]
}

export function createVisualizer(options: CreateVisualizerOptions = {}) {
  const baseConfig = options.config
  return defineComponent({
    name: 'ConfiguredLegalDocVisualizer',
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      return () =>
        h(LegalDocVisualizer, { ...attrs, config: baseConfig }, slots)
    },
  })
}

export default createVisualizer