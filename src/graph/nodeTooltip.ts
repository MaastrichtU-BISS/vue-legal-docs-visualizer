import type { Core, NodeSingular } from 'cytoscape'

// The hover tooltip of a node, shared by every graph in this package: it
// appears over the node after a short delay, stays inside the graph, follows
// panning and zooming, and goes away with the hover. What it *says* is up to
// each graph (the content is a slot of GraphTooltip); this only places it.
// Needs cytoscape-popper to be registered (see extensions.ts).

export interface NodeTooltipOptions {
  /** The tooltip's element, once rendered (GraphTooltip's `root`). */
  element: () => HTMLElement | null
  /** What the tooltip must stay inside: the graph's canvas. */
  boundary: () => HTMLElement | null
  /** The cytoscape instance the hovered nodes belong to. */
  cy: () => Core | null
  /** Milliseconds of hover before it shows. */
  delay?: number
}

export function createNodeTooltip({ element, boundary, cy, delay = 300 }: NodeTooltipOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let popper: { destroy?: () => void; update?: () => void } | null = null

  const update = () => popper?.update?.()

  /** Shows the tooltip over `node` once the delay has passed. */
  const show = (node: NodeSingular) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const el = element()
      if (!el) return
      popper = (node as any).popper({
        content: el,
        popper: {
          placement: 'top',
          modifiers: [
            { name: 'arrow', options: { element: el.querySelector('.graph-tooltip-arrow') } },
            { name: 'offset', options: { offset: [0, 12] } },
            { name: 'preventOverflow', options: { boundary: boundary(), padding: 10 } },
            { name: 'flip', options: { fallbackPlacements: ['bottom', 'left', 'right'] } }
          ]
        }
      })
      el.style.display = 'block'
      el.style.opacity = '1'
      cy()?.on('pan zoom resize', update)
    }, delay)
  }

  /** Hides it, or cancels it if it has not shown yet. */
  const hide = () => {
    if (timer) clearTimeout(timer)
    timer = null
    popper?.destroy?.()
    popper = null
    const el = element()
    if (el) {
      el.style.display = 'none'
      el.style.opacity = '0'
    }
    cy()?.off('pan zoom resize', update)
  }

  return { show, hide }
}
