import { defineComponent, h } from 'vue'
import LegalDocVisualizer from './components/LegalDocVisualizer.vue'
import { resolveFactoryConfig, type FactoryOptions } from './config'

/**
 * Build a pre-configured visualizer component. The config (preset id or full
 * config, including `views`) is import-time and authoritative; runtime props
 * (`results`, `docs`, `edges`, `graph`) carry the data.
 */
export function createVisualizer(options: FactoryOptions = {}) {
  const { config: baseConfig } = resolveFactoryConfig(options)
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
