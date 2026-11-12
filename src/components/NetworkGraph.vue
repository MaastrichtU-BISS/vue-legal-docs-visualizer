<template>
  <div class="network-graph">
    <div class="network-graph__search">
      <IconField>
        <InputIcon>
          <i class="pi pi-search" />
        </InputIcon>
        <InputText v-model="query" placeholder="Search..." @input="applySearch" :style="'padding-right: 0;'" />
      </IconField>
    </div>

    <div class="network-graph__controls">
      <Button icon="pi pi-minus" severity="secondary" size="small" rounded title="Zoom Out" aria-label="Zoom Out" @click="zoomOut" />
      <Button icon="pi pi-plus" severity="secondary" size="small" rounded title="Zoom In" aria-label="Zoom In" @click="zoomIn" />
      <Button icon="pi pi-arrows-alt" severity="secondary" size="small" rounded title="Fit to View" aria-label="Fit to View" @click="fitToView" />
    </div>

    <div ref="canvas" class="network-graph__canvas"></div>

    <div v-if="!nodes.length" class="network-graph__empty">{{ emptyText }}</div>

    <div ref="tooltip" class="network-graph__tooltip">
      <div class="network-graph__tooltip-arrow"></div>
      <!-- What a hovered node shows. Replace it with the `tooltip` slot. -->
      <slot name="tooltip" :node="hovered">
        <div v-if="hovered?.title" class="network-graph__tooltip-title">{{ hovered.title }}</div>
        <div v-if="hovered?.description" class="network-graph__tooltip-body">{{ hovered.description }}</div>
      </slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import cytoscape, { type Core } from 'cytoscape'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import type { NetworkEdge, NetworkNode } from '../graph/types'
import { buildElements, nodeMatches } from '../graph/elements'
import { registerFcose, registerPopper } from '../graph/extensions'

// A generic network graph: plain nodes and edges in, an interactive graph out
// (search, zoom, fit, hover tooltips, click on a node). It knows nothing about
// legal documents; the table view, clusters and selection of the
// LegalDocVisualizer are not part of it. Use it where a host has a modest
// number of things pointing at each other and wants to see them as a picture.

export interface Props {
  nodes: NetworkNode[]
  edges?: NetworkEdge[]
  /** The node to mark as the one in focus (a thick border), e.g. the open document. */
  currentId?: string
  /** Shown when there are no nodes. */
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  edges: () => [],
  emptyText: 'Nothing to show.'
})

const emit = defineEmits<{
  /** A node was clicked; `id` is its `NetworkNode.id`. */
  nodeClick: [id: string]
}>()

const canvas = ref<HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const query = ref('')
const hovered = ref<NetworkNode | null>(null)

let cy: Core | null = null
let popper: { destroy?: () => void; update?: () => void } | null = null
let tooltipTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

const nodeById = () => new Map(props.nodes.map((n) => [n.id, n]))

const zoomIn = () => cy?.zoom(cy.zoom() * 1.2)
const zoomOut = () => cy?.zoom(cy.zoom() / 1.2)
const fitToView = () => cy?.fit()

/** Marks a node as the one in focus. */
const highlightNodeById = (id: string | undefined) => {
  if (!cy) return
  cy.$('.current').removeClass('current')
  if (id) cy.getElementById(id).addClass('current')
}

// Hides what the search does not match, and the edges left without both ends.
const applySearch = () => {
  if (!cy) return
  const byId = nodeById()
  cy.nodes().forEach((node) => {
    const source = byId.get(node.id())
    node.style('display', source && nodeMatches(source, query.value) ? 'element' : 'none')
  })
  cy.edges().forEach((edge) => {
    const shown = edge.source().style('display') !== 'none' && edge.target().style('display') !== 'none'
    edge.style('display', shown ? 'element' : 'none')
  })
}

const hideTooltip = () => {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  tooltipTimer = null
  popper?.destroy?.()
  popper = null
  if (tooltip.value) {
    tooltip.value.style.display = 'none'
    tooltip.value.style.opacity = '0'
  }
  cy?.off('pan zoom resize', updatePopper)
}

const updatePopper = () => popper?.update?.()

const showTooltip = (node: cytoscape.NodeSingular, source: NetworkNode) => {
  const el = tooltip.value
  if (!el) return
  // Nothing to say about this node, unless the host brings its own tooltip.
  if (!source.title && !source.description && !hasTooltipSlot) return
  hovered.value = source
  tooltipTimer = setTimeout(() => {
    popper = (node as any).popper({
      content: el,
      popper: {
        placement: 'top',
        modifiers: [
          { name: 'arrow', options: { element: el.querySelector('.network-graph__tooltip-arrow') } },
          { name: 'offset', options: { offset: [0, 12] } },
          { name: 'preventOverflow', options: { boundary: canvas.value, padding: 10 } },
          { name: 'flip', options: { fallbackPlacements: ['bottom', 'left', 'right'] } }
        ]
      }
    })
    el.style.display = 'block'
    el.style.opacity = '1'
    cy?.on('pan zoom resize', updatePopper)
  }, 300)
}

const slots = defineSlots<{ tooltip?: (props: { node: NetworkNode | null }) => unknown }>()
const hasTooltipSlot = !!slots.tooltip

const destroyGraph = () => {
  hideTooltip()
  cy?.destroy()
  cy = null
}

const initGraph = async () => {
  if (!canvas.value || !props.nodes.length) return

  await registerPopper()
  await registerFcose()
  // The graph may have been torn down (or the input emptied) while loading.
  if (!canvas.value || !props.nodes.length) return

  const elements = buildElements(props.nodes, props.edges)

  cy = cytoscape({
    container: canvas.value,
    elements,
    layout: { name: 'preset' },
    boxSelectionEnabled: false,
    autounselectify: true,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)',
          width: 34,
          height: 34,
          label: 'data(label)',
          'font-size': 11,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          color: '#2c3e50',
          'text-wrap': 'ellipsis',
          'text-max-width': '150px'
        }
      },
      {
        selector: 'node.current',
        style: { 'border-width': 3, 'border-color': '#000000', 'border-style': 'solid' }
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#95a5a6',
          'target-arrow-color': '#95a5a6',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          label: 'data(label)',
          'font-size': 9,
          color: '#495057',
          'text-rotation': 'autorotate',
          'text-background-color': '#ffffff',
          'text-background-opacity': 0.85,
          'text-background-padding': '2px'
        }
      }
    ]
  })

  // fcose packs disconnected nodes into a tidy grid (tile) instead of piling
  // them up, which matters here: a document with no relations is a lone node.
  cy.layout({
    name: 'fcose',
    quality: 'default',
    randomize: true,
    animate: false,
    fit: true,
    // Room for the search box and the controls floating over the corners.
    padding: 64,
    tile: true,
    nodeRepulsion: 6500,
    idealEdgeLength: 120,
    numIter: 2500
  } as any).run()

  highlightNodeById(props.currentId)

  cy.on('tap', 'node', (event) => emit('nodeClick', event.target.id()))

  cy.on('mouseover', 'node', (event) => {
    const source = nodeById().get(event.target.id())
    if (canvas.value) canvas.value.style.cursor = 'pointer'
    if (source) showTooltip(event.target, source)
  })
  cy.on('mouseout', 'node', () => {
    if (canvas.value) canvas.value.style.cursor = 'default'
    hideTooltip()
  })
}

onMounted(async () => {
  await initGraph()
  // A graph opened inside something that is still growing (a dialog, say) has
  // to follow its size.
  if (canvas.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      cy?.resize()
      cy?.fit()
    })
    resizeObserver.observe(canvas.value)
  }
})

watch(
  () => [props.nodes, props.edges],
  async () => {
    destroyGraph()
    await initGraph()
    applySearch()
  },
  { deep: true }
)

watch(() => props.currentId, highlightNodeById)

defineExpose({ highlightNodeById, fitToView })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  destroyGraph()
})
</script>

<style scoped>
.network-graph {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 24rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
}

.network-graph__search {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.95);
  padding: 6px 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
}

.network-graph__search :deep(.p-iconfield) {
  width: 200px;
}

.network-graph__controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.network-graph__canvas {
  flex: 1;
  width: 100%;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: default;
  z-index: 0;
}

.network-graph__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
  font-size: 14px;
  pointer-events: none;
}

.network-graph__tooltip {
  display: none;
  position: relative;
  max-width: 300px;
  padding: 8px 10px;
  background-color: white;
  color: #2c3e50;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 11px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 1000;
}

.network-graph__tooltip-arrow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}

.network-graph__tooltip[data-popper-placement^='bottom'] .network-graph__tooltip-arrow {
  top: -8px;
  bottom: auto;
  border-top-color: transparent;
  border-bottom: 8px solid white;
}

.network-graph__tooltip-title {
  margin-bottom: 4px;
  font-weight: 600;
  color: #212529;
}

.network-graph__tooltip-body {
  max-height: 90px;
  overflow: hidden;
  line-height: 1.3;
  white-space: pre-line;
}
</style>
