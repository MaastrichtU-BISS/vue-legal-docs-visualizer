<template>
  <div class="network-graph">
    <GraphSearch v-model="query" @search="applySearch" />
    <GraphControls @zoom-in="zoomIn" @zoom-out="zoomOut" @fit="fitToView" />

    <div ref="canvas" class="network-graph__canvas"></div>

    <div v-if="!nodes.length" class="network-graph__empty">{{ emptyText }}</div>

    <GraphTooltip ref="tooltipBox">
      <!-- What a hovered node shows. Replace it with the `tooltip` slot. -->
      <slot name="tooltip" :node="hovered">
        <div v-if="hovered?.title" class="network-graph__tooltip-title">{{ hovered.title }}</div>
        <div v-if="hovered?.description" class="network-graph__tooltip-body">{{ hovered.description }}</div>
      </slot>
    </GraphTooltip>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import cytoscape, { type Core } from 'cytoscape'
import type { NetworkEdge, NetworkNode } from '../graph/types'
import { buildElements, nodeMatches } from '../graph/elements'
import { registerFcose, registerPopper } from '../graph/extensions'
import { createNodeTooltip } from '../graph/nodeTooltip'
import * as viewport from '../graph/viewport'
import GraphSearch from './GraphSearch.vue'
import GraphControls from './GraphControls.vue'
import GraphTooltip from './GraphTooltip.vue'

// A generic network graph: plain nodes and edges in, an interactive graph out
// (search, zoom, fit, hover tooltips, click on a node). It knows nothing about
// legal documents; the table view, clusters and selection of the
// LegalDocVisualizer are not part of it. The search box, zoom controls, tooltip
// and extension loading are the same ones the LegalDocVisualizer's graph uses
// (GraphSearch, GraphControls, GraphTooltip, graph/*): only what is specific to
// this input lives here. Use it where a host has a modest number of things
// pointing at each other and wants to see them as a picture.

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

const slots = defineSlots<{ tooltip?: (props: { node: NetworkNode | null }) => unknown }>()

const canvas = ref<HTMLElement | null>(null)
const tooltipBox = ref<InstanceType<typeof GraphTooltip> | null>(null)
const query = ref('')
const hovered = ref<NetworkNode | null>(null)

let cy: Core | null = null
let resizeObserver: ResizeObserver | null = null

const tooltip = createNodeTooltip({
  element: () => tooltipBox.value?.root ?? null,
  boundary: () => canvas.value,
  cy: () => cy
})

const zoomIn = () => viewport.zoomIn(cy)
const zoomOut = () => viewport.zoomOut(cy)
const fitToView = () => viewport.fitToView(cy)

const nodeById = () => new Map(props.nodes.map((n) => [n.id, n]))

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

const destroyGraph = () => {
  tooltip.hide()
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

  tooltip.hideWhileDragging(cy)
  cy.on('mouseover', 'node', (event) => {
    const source = nodeById().get(event.target.id())
    if (canvas.value) canvas.value.style.cursor = 'pointer'
    if (!source) return
    // Nothing to say about this node, unless the host brings its own tooltip.
    if (!source.title && !source.description && !slots.tooltip) return
    hovered.value = source
    tooltip.show(event.target)
  })
  cy.on('mouseout', 'node', () => {
    if (canvas.value) canvas.value.style.cursor = 'default'
    tooltip.hide()
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
