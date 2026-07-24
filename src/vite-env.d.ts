/// <reference types="vite/client" />

declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape'
  const register: Ext
  export default register
}

declare module 'cytoscape-expand-collapse' {
  const register: (cytoscape: any) => void
  export default register
}
