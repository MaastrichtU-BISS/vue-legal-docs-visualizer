import cytoscape from 'cytoscape'
import { createPopper } from '@popperjs/core'

// Cytoscape extensions are registered once per page, however many graphs there
// are, and loaded on demand so a page without a graph does not pay for them.
// Shared by every graph component in this package.

let popperRegistered = false

/** cytoscape-popper: anchors a tooltip element to a node. */
export const registerPopper = async () => {
  if (popperRegistered) return
  const cytoscapePopper = await import('cytoscape-popper')
  // The extension is handed the createPopper factory.
  cytoscape.use(cytoscapePopper.default(createPopper) as any)
  popperRegistered = true
}

let fcoseRegistered = false

/**
 * cytoscape-fcose: a much faster (near-linear, where the core cose layout is
 * O(n^2) per iteration) and overlap-aware layout, needed once graphs reach the
 * hundreds of nodes.
 */
export const registerFcose = async () => {
  if (fcoseRegistered) return
  const cytoscapeFcose = await import('cytoscape-fcose')
  cytoscape.use(cytoscapeFcose.default)
  fcoseRegistered = true
}
