<template>
  <div class="graph-container">
    <div v-if="isLoading" class="graph-loading">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      <p><strong>{{ layoutInfo.nodeCount }}</strong> nodes · <strong>{{ layoutInfo.iterations }}</strong> iterations</p>
      <p style="font-size: 0.85rem; color: #6c757d;">
        {{ layoutInfo.iterations < 100 ? 'Optimizing layout...' : layoutInfo.iterations < 500 ? 'Fast layout mode' : 'High quality layout' }}
      </p>
    </div>
    <div class="filter-bar">
      <IconField>
        <InputIcon>
          <i class="pi pi-search" />
        </InputIcon>
        <InputText v-model="searchQuery" placeholder="Search..." @input="applyFilters" :style="'padding-right: 0;'" />
      </IconField>
    </div>
    <div class="cy-controls">
      <Button 
        icon="pi pi-minus" 
        severity="secondary" 
        size="small"
        rounded 
        @click="zoomOut"
        v-tooltip="'Zoom Out'" />
      <Button 
        icon="pi pi-plus" 
        severity="secondary" 
        size="small" 
        rounded 
        @click="zoomIn"
        v-tooltip="'Zoom In'" />
      <Button
        icon="pi pi-arrows-alt"
        severity="secondary"
        size="small"
        rounded
        @click="fitToView"
        v-tooltip="'Fit to View'" />
      <Button
        :icon="hasCollapsedClusters ? 'pi pi-plus-circle' : 'pi pi-minus-circle'"
        severity="secondary"
        size="small"
        rounded
        @click="toggleAllClusters"
        v-tooltip="hasCollapsedClusters ? 'Expand All Clusters' : 'Collapse All Clusters'" />
    </div>
    <div ref="cyContainer" class="cy-container"></div>
    <div ref="tooltip" class="graph-tooltip">
      <div class="graph-tooltip-arrow"></div>
      <div class="tooltip-ecli">{{ tooltipContent.ecli }}</div>
      <div v-if="tooltipContent.title" class="tooltip-title">{{ tooltipContent.title }}</div>
      <ul v-if="tooltipContent.provisions.length > 0" class="tooltip-provisions">
        <li v-for="(provision, index) in tooltipContent.provisions" :key="index">{{ provision }}</li>
      </ul>
      <div class="tooltip-summary">{{ tooltipContent.summary }}</div>
    </div>
    <div
      ref="clusterTooltip"
      class="cluster-tooltip"
      @mouseenter="cancelClusterHide"
      @mouseleave="scheduleHideClusterTooltip">
      <Button :label="clusterActionLabel" size="small" severity="secondary" @click="onClusterToggle" />
      <Button label="Summary" size="small" severity="primary" @click="onClusterSummary" />
    </div>
    <div class="selection-controls">
      <div class="selection-info">
        <span v-tooltip="{ value: 'View Mode: Click nodes to view details. \n\nSelection Mode: Click/drag to select multiple nodes (panning disabled).', pt: { root: { style: 'max-width: 250px' } } }">
          <i class="pi pi-info-circle" 
             style="font-size: 0.75rem; color: #6c757d; cursor: pointer;"></i>
        </span>
        <span class="selection-label"> Selected Documents: {{ selectedCount }}/{{ totalCount }}</span>
      </div>
      <div class="selection-mode">
        <div class="mode-switch">
          <label for="selection-mode-switch" style="font-size: 0.75rem; margin-right: 8px;">View</label>
          <InputSwitch 
            id="selection-mode-switch"
            v-model="selectionMode" />
          <label for="selection-mode-switch" style="font-size: 0.75rem; margin-left: 8px;">Selection</label>
        </div>
      </div>
      <div class="selection-actions">
        <Button 
          icon="pi pi-filter"
          label="Filter"
          severity="primary" 
          :disabled="selectedCount === 0"
          @click="filterSelected"
          v-tooltip="'Filter Selected Documents'" />
        <Button  
          icon="pi pi-times"
          severity="secondary" 
          label="Clear"
          :disabled="selectedCount === 0"
          @click="clearSelection" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue'
import cytoscape, { Core } from 'cytoscape'
import { createPopper } from '@popperjs/core'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import InputSwitch from 'primevue/inputswitch'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import type { LegalEdge } from './types'

// Dynamically import and register cytoscape-popper
let popperRegistered = false

const registerPopper = async () => {
  if (!popperRegistered) {
    const cytoscapePopper = await import('cytoscape-popper')
    const extension = cytoscapePopper.default

    // Pass the createPopper factory to the extension
    cytoscape.use(extension(createPopper) as any)

    popperRegistered = true
  }
}

// Dynamically import and register cytoscape-fcose - a much faster (near-linear vs the core
// cose layout's O(n^2) per iteration) and overlap-aware layout, needed once graphs reach the
// hundreds of nodes.
let fcoseRegistered = false

const registerFcose = async () => {
  if (!fcoseRegistered) {
    const cytoscapeFcose = await import('cytoscape-fcose')
    cytoscape.use(cytoscapeFcose.default)
    fcoseRegistered = true
  }
}

// Dynamically import and register cytoscape-expand-collapse - lets whole clusters be
// represented as a single collapsible node, which is what actually keeps large graphs
// (thousands of nodes) readable instead of just cramming every node into one layout.
let expandCollapseRegistered = false

const registerExpandCollapse = async () => {
  if (!expandCollapseRegistered) {
    const cytoscapeExpandCollapse = await import('cytoscape-expand-collapse')
    cytoscapeExpandCollapse.default(cytoscape)
    expandCollapseRegistered = true
  }
}

export interface Props {
  docs?: any[]
  edges?: LegalEdge[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  docClick: [doc: any]
  clusterClick: [payload: { clusterId: string; documents: any[] }]
}>()

const isLoading = ref(false)
const selectedCount = ref(0)
const selectionMode = ref(false)

const totalCount = computed(() => props.docs?.length || 0)

// Helper function to calculate iteration count based on node count. fcose's per-iteration
// cost is much lower than core cose's O(n^2) (spectral layout + quadtree-approximated forces),
// so we can afford far more iterations at every size without the slowdown cose had.
const getIterationsForNodeCount = (nodeCount: number): number => {
  if (nodeCount < 1000) return 2500
  if (nodeCount < 3000) return 1500
  return 1000
}

// Collapsing exists purely to alleviate rendering/layout overhead on big graphs - it's not a
// UX default worth paying for on its own, so whenever the graph is small enough to render
// cheaply in full, leave every cluster expanded. Mirrors the same size tiers as
// getIterationsForNodeCount above, since that's the actual boundary where layout starts
// costing more: below it there's no overhead reason to collapse anything. Above it, only
// clusters large enough to meaningfully cut the visible node count are worth collapsing -
// small clusters were never the problem, so they stay expanded even in a big graph.
const getClusterCollapseThreshold = (totalNodeCount: number): number => {
  if (totalNodeCount < 1000) return Infinity
  if (totalNodeCount < 3000) return 30
  return 12
}

const calculateClusterSize = (memberCount: number): number => {
  const minSize = 50
  const maxSize = 140
  const scaleFactor = 22
  return Math.min(minSize + Math.log(memberCount + 1) * scaleFactor, maxSize)
}

const layoutInfo = computed(() => {
  const nodeCount = props.docs?.length || 0
  const iterations = getIterationsForNodeCount(nodeCount)
  return { nodeCount, iterations }
})

const highlightNodeById = (id: string) => {
  if (!cy) return
  const node = cy.$(`node[id="${id}"]`)
  if (node && !node.isEdge()) {
    cy.$('.currentShown').removeClass('currentShown')
    cy.$(node).addClass('currentShown')
  }
}

// Filter state
const searchQuery = ref('')

const applyFilters = () => {
  if (!cy) return

  const searchLower = searchQuery.value.toLowerCase()
  const nodes = cy.nodes()

  // Determine which nodes should be visible
  nodes.forEach(node => {
    // Cluster placeholders' visibility is owned by expand/collapse, not search
    if (node.data('isClusterParent')) return
    const docData = node.data('fullData')
    const nodeId = node.data('id')

    // Check search query
    const matchesSearch = !searchLower ||
      nodeId.toLowerCase().includes(searchLower) ||
      (docData?.data?.summary || docData?.data?.conclusion || '').toLowerCase().includes(searchLower)

    // Apply visibility
    if (matchesSearch) {
      node.style('display', 'element')
    } else {
      node.style('display', 'none')
    }
  })

  // Also manage edge visibility - only for real per-document edges. Fictional cluster-to-
  // cluster edges and the library's own meta-edges have their own visibility rules tied to
  // collapse state (see updateClusterEdgeVisibility/the stylesheet), unrelated to search -
  // recomputing them here from endpoint visibility alone would fight with that.
  const edges = cy.edges('[!isFictionalClusterEdge]').not('.cy-expand-collapse-meta-edge')
  edges.forEach(edge => {
    if (edge.source().style('display') !== 'none' && edge.target().style('display') !== 'none') {
      edge.style('display', 'element')
    } else {
      edge.style('display', 'none')
    }
  })
}

// Cytoscape controls
const zoomIn = () => {
  if (!cy) return
  cy.zoom(cy.zoom() * 1.2)
}

const zoomOut = () => {
  if (!cy) return
  cy.zoom(cy.zoom() / 1.2)
}

const fitToView = () => {
  if (!cy) return
  cy.fit()
}

const hasCollapsedClusters = ref(false)

const updateHasCollapsedClusters = () => {
  hasCollapsedClusters.value = !!cy && cy.nodes('.cy-expand-collapse-collapsed-node').length > 0
}

const toggleAllClusters = () => {
  if (!cy || !expandCollapseApi) return
  if (hasCollapsedClusters.value) {
    expandCollapseApi.expandAll()
  } else {
    expandCollapseApi.collapseAll()
  }
}

const filterSelected = () => {
  if (!cy) return
  // Exclude cluster nodes - they can end up transiently :selected as part of showing their
  // expand/collapse cue (see the mouseover/mouseout handlers in initGraph) and don't
  // represent a real document to filter on anyway.
  const selectedNodes = cy.$('node:selected[!isClusterParent]')

  if (selectedNodes.length === 0) return
  
  // Get the selected node IDs
  const selectedIds = selectedNodes.map(node => node.data('id'))
  
  // TODO: User will implement the filtering logic
  console.log('Selected nodes:', selectedIds)
}

const clearSelection = () => {
  if (!cy) return
  const selectedNodes = cy.$('node:selected')
  selectedNodes.unselect()
  selectedCount.value = 0
}

const updateSelectionCount = () => {
  if (!cy) return
  // Exclude cluster nodes - see the note in filterSelected above.
  selectedCount.value = cy.$('node:selected[!isClusterParent]').length
}

const cyContainer = ref<HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const tooltipContent = ref({ ecli: '', title: '', summary: '', provisions: [] as string[] })
let cy: Core | null = null
let tooltipTimeout: ReturnType<typeof setTimeout> | null = null
let currentPopper: any = null

// Cluster hover popup (Expand/Collapse + Summary) - replaces cytoscape-expand-collapse's own
// +/- cue, which draws itself on a canvas overlay using its own bounding-box/coordinate math
// that drifts out of sync with the node on zoom and sometimes fails to redraw at all. Real DOM
// buttons positioned by the same popper.js already used for the doc tooltip above sidestep all
// of that - no canvas hit-testing, no synthetic coordinate math, just an ordinary hoverable menu.
const clusterTooltip = ref<HTMLElement | null>(null)
const clusterActionLabel = ref('Collapse')
let docsByCluster = new Map<string, any[]>()
let expandCollapseApi: any = null
let hoveredClusterNode: any = null
let clusterPopper: any = null
let clusterHideTimeout: ReturnType<typeof setTimeout> | null = null
let clusterShowTimeout: ReturnType<typeof setTimeout> | null = null

const updateClusterPopperPosition = () => {
  if (clusterPopper?.update) clusterPopper.update()
}

const hideClusterTooltip = () => {
  if (clusterHideTimeout) {
    clearTimeout(clusterHideTimeout)
    clusterHideTimeout = null
  }
  if (clusterShowTimeout) {
    clearTimeout(clusterShowTimeout)
    clusterShowTimeout = null
  }
  if (clusterTooltip.value) {
    clusterTooltip.value.style.display = 'none'
    clusterTooltip.value.style.opacity = '0'
  }
  if (clusterPopper) {
    if (clusterPopper.destroy) clusterPopper.destroy()
    clusterPopper = null
  }
  hoveredClusterNode = null
  cy?.off('pan zoom resize', updateClusterPopperPosition)
}

// Small delay before hiding so the mouse has time to travel from the node onto the popup
// itself - cancelClusterHide (bound to the popup's own @mouseenter) aborts it if it does.
const scheduleHideClusterTooltip = () => {
  if (clusterHideTimeout) clearTimeout(clusterHideTimeout)
  clusterHideTimeout = setTimeout(hideClusterTooltip, 200)
}

const cancelClusterHide = () => {
  if (clusterHideTimeout) {
    clearTimeout(clusterHideTimeout)
    clusterHideTimeout = null
  }
}

const cancelPendingClusterShow = () => {
  if (clusterShowTimeout) {
    clearTimeout(clusterShowTimeout)
    clusterShowTimeout = null
  }
}

// Two overlapping clusters can put one cluster's popup visually on top of the *other*
// cluster's node - so the straight-line path from the hovered node to its own popup can cross
// over that other node first. Showing a new popup immediately on mouseover would yank the
// first one away mid-transit, before the user ever reaches its buttons. Instead, wait for a
// short sustained hover before switching - a brief pass-through cancels via the mouseout
// handler below (cancelPendingClusterShow) before it ever fires, so it's a no-op.
const scheduleShowClusterTooltip = (node: any) => {
  if (clusterHideTimeout) {
    clearTimeout(clusterHideTimeout)
    clusterHideTimeout = null
  }
  if (hoveredClusterNode && hoveredClusterNode.id() === node.id() && clusterPopper) {
    cancelPendingClusterShow()
    return
  }
  cancelPendingClusterShow()
  clusterShowTimeout = setTimeout(() => {
    clusterShowTimeout = null
    showClusterTooltip(node)
  }, 200)
}

const showClusterTooltip = (node: any) => {
  if (clusterHideTimeout) {
    clearTimeout(clusterHideTimeout)
    clusterHideTimeout = null
  }
  if (hoveredClusterNode && hoveredClusterNode.id() === node.id() && clusterPopper) return

  if (clusterPopper) {
    if (clusterPopper.destroy) clusterPopper.destroy()
    clusterPopper = null
  }

  hoveredClusterNode = node
  clusterActionLabel.value = node.hasClass('cy-expand-collapse-collapsed-node') ? 'Expand' : 'Collapse'

  if (!clusterTooltip.value) return

  clusterPopper = (node as any).popper({
    content: clusterTooltip.value,
    popper: {
      placement: 'top',
      modifiers: [
        { name: 'offset', options: { offset: [0, 12] } },
        { name: 'preventOverflow', options: { boundary: cyContainer.value, padding: 10 } },
        { name: 'flip', options: { fallbackPlacements: ['bottom', 'left', 'right'] } }
      ]
    }
  })

  clusterTooltip.value.style.display = 'flex'
  clusterTooltip.value.style.opacity = '1'

  cy?.on('pan zoom resize', updateClusterPopperPosition)
}

const onClusterToggle = () => {
  if (!hoveredClusterNode || !expandCollapseApi) return
  const node = hoveredClusterNode
  if (node.hasClass('cy-expand-collapse-collapsed-node')) {
    expandCollapseApi.expand(node)
  } else {
    expandCollapseApi.collapse(node)
  }
  hideClusterTooltip()
}

const onClusterSummary = () => {
  if (!hoveredClusterNode) return
  const clusterId = hoveredClusterNode.data('id')
  emit('clusterClick', { clusterId, documents: docsByCluster.get(clusterId) || [] })
  hideClusterTooltip()
}

// Helper function to generate distinct colors for clusters
const generateClusterColors = (parentIds: string[]): Map<string, string> => {
  const colorMap = new Map<string, string>()
  const distinctColors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#d35400', '#c0392b', '#16a085',
    '#27ae60', '#2980b9', '#8e44ad', '#f1c40f', '#e84393',
    '#00b894', '#0984e3', '#6c5ce7', '#fdcb6e', '#00cec9',
    '#ff7675', '#74b9ff', '#a29bfe', '#fd79a8', '#fab1a0',
    '#55efc4', '#81ecec', '#ffeaa7'
  ]
  
  parentIds.forEach((parentId, index) => {
    colorMap.set(parentId, distinctColors[index % distinctColors.length])
  })
  
  return colorMap
}

const initGraph = async () => {
  if (!cyContainer.value || !props.docs || props.docs.length === 0) {
    isLoading.value = false
    return
  }

  isLoading.value = true

  // Register extensions first
  await registerPopper()
  await registerFcose()
  await registerExpandCollapse()

  // Group docs by cluster (statistics.community - a real community-detection cluster id).
  // statistics.parent looks like a similar grouping field but is actually a spanning-tree
  // pointer to another *real document's own id* - reusing it as a compound node id collided
  // with that document's actual node (edges attaching straight to "squares", cluster clicks
  // shadowing real document clicks). Prefixing the community number rules out any collision.
  const getClusterKey = (doc: any): string | undefined => {
    const community = doc.data?.statistics?.community
    return community === undefined || community === null ? undefined : `cluster-${community}`
  }

  docsByCluster = new Map<string, any[]>()
  props.docs.forEach(doc => {
    const clusterKey = getClusterKey(doc)
    if (clusterKey) {
      if (!docsByCluster.has(clusterKey)) docsByCluster.set(clusterKey, [])
      docsByCluster.get(clusterKey)!.push(doc)
    }
  })
  const parentColorMap = generateClusterColors(Array.from(docsByCluster.keys()))

  // Create a Set of valid node IDs for edge validation
  const validNodeIds = new Set(props.docs.map(doc => doc.id))

  // Color for isolated nodes (degree = 0)
  const isolatedNodeColor = '#95a5a6' // Gray color for isolated nodes

  // Helper function to calculate node size based on degree
  const calculateNodeSize = (degree: number): number => {
    // Base size for isolated nodes
    if (degree === 0) return 20
    
    // Logarithmic scaling for better visual distribution
    // Size ranges from 30px to 80px
    const minSize = 30
    const maxSize = 80
    const scaleFactor = 15
    
    const size = minSize + Math.log(degree + 1) * scaleFactor
    return Math.min(size, maxSize)
  }

  // Which clusters get wrapped in a compound node (size >= 2, not worth it for a singleton),
  // and which of those start collapsed depending on the overall graph size and their own size.
  const totalDocCount = props.docs.length
  const collapseThreshold = getClusterCollapseThreshold(totalDocCount)
  const clusterIdsToCollapse = new Set<string>()
  let collapsedDocCount = 0

  docsByCluster.forEach((docsInCluster, clusterId) => {
    if (docsInCluster.length < 2) return
    if (docsInCluster.length >= collapseThreshold) {
      clusterIdsToCollapse.add(clusterId)
      collapsedDocCount += docsInCluster.length
    }
  })

  const clusterParentNodes = Array.from(docsByCluster.entries())
    .filter(([, docsInCluster]) => docsInCluster.length >= 2)
    .map(([clusterId, docsInCluster]) => ({
      data: {
        id: clusterId,
        label: `${docsInCluster.length} documents`,
        color: parentColorMap.get(clusterId) || '#3498db',
        size: calculateClusterSize(docsInCluster.length),
        isClusterParent: true,
        memberCount: docsInCluster.length
      }
    }))

  // Create nodes from docs with color and size based on parent or isolation
  const nodes = props.docs.map(doc => {
    const degree = doc.data?.statistics?.degree || 0
    const isIsolated = degree === 0
    const size = calculateNodeSize(degree)
    const clusterId = getClusterKey(doc)
    const isGrouped = Boolean(clusterId && (docsByCluster.get(clusterId)?.length || 0) >= 2)

    let color: string
    if (isIsolated) {
      color = isolatedNodeColor
    } else {
      color = (clusterId ? parentColorMap.get(clusterId) : undefined) || '#3498db' // Default color if no parent
    }

    return {
      data: {
        id: doc.id,
        label: doc.id.split(':').pop() || doc.id, // Simplified label
        fullData: doc,
        color: color, // Store color in node data
        size: size, // Store size in node data
        ...(isGrouped ? { parent: clusterId } : {})
      }
    }
  })

  const allNodes = [...clusterParentNodes, ...nodes]

  // Real doc id -> the cluster id it's actually compounded into (only set for docs whose
  // cluster was big enough to get its own compound node - mirrors `isGrouped` above). Used by
  // dedupeParallelEdges below to tell whether an edge touches a cluster at all, independent of
  // whether that cluster happens to be collapsed or expanded right now.
  const docIdToClusterId = new Map<string, string>()
  nodes.forEach(n => {
    if (n.data.parent) docIdToClusterId.set(n.data.id, n.data.parent)
  })

  // Create edges - prefer the authoritative edges array when provided, falling back to
  // reconstructing from each doc's cites/cited_by (which ECHR documents don't populate).
  const edges: any[] = []
  const addedEdges = new Set<string>() // To avoid duplicate edges

  // Directed cluster-pair keys ("clusterA->clusterB") that have at least one real citation
  // between their members - turned into one fictional cluster-to-cluster edge per direction
  // actually present, further down. Shown instead of the real per-document edges whenever
  // either cluster is collapsed (see updateClusterEdgeVisibility).
  const clusterEdgeDirections = new Set<string>()
  const recordClusterPair = (sourceId: string, targetId: string) => {
    const sourceCluster = docIdToClusterId.get(sourceId)
    const targetCluster = docIdToClusterId.get(targetId)
    if (sourceCluster && targetCluster && sourceCluster !== targetCluster) {
      clusterEdgeDirections.add(`${sourceCluster}->${targetCluster}`)
    }
  }

  if (props.edges) {
    props.edges.forEach(edge => {
      if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
        const edgeId = `${edge.source}->${edge.target}`
        if (!addedEdges.has(edgeId)) {
          edges.push({
            data: {
              id: edgeId,
              source: edge.source,
              target: edge.target
            }
          })
          addedEdges.add(edgeId)
          recordClusterPair(edge.source, edge.target)
        }
      }
    })
  } else {
    props.docs.forEach(doc => {
      const sourceId = doc.id

      // Add edges for documents this one cites
      if (doc.data?.cites && Array.isArray(doc.data.cites)) {
        doc.data.cites.forEach((targetId: string) => {
          // Only create edge if target exists in our dataset
          if (validNodeIds.has(targetId)) {
            const edgeId = `${sourceId}->${targetId}`
            if (!addedEdges.has(edgeId)) {
              edges.push({
                data: {
                  id: edgeId,
                  source: sourceId,
                  target: targetId
                }
              })
              addedEdges.add(edgeId)
              recordClusterPair(sourceId, targetId)
            }
          }
        })
      }

      // Add edges for documents that cite this one
      if (doc.data?.cited_by && Array.isArray(doc.data.cited_by)) {
        doc.data.cited_by.forEach((targetId: string) => {
          // Only create edge if source exists in our dataset
          if (validNodeIds.has(targetId)) {
            const edgeId = `${targetId}->${sourceId}`
            if (!addedEdges.has(edgeId)) {
              edges.push({
                data: {
                  id: edgeId,
                  source: targetId,
                  target: sourceId
                }
              })
              addedEdges.add(edgeId)
              recordClusterPair(targetId, sourceId)
            }
          }
        })
      }
    })
  }

  clusterEdgeDirections.forEach(pairKey => {
    const [source, target] = pairKey.split('->')
    edges.push({
      data: { id: `fictional-cluster-edge:${pairKey}`, source, target, isFictionalClusterEdge: true }
    })
  })

  // fcose scales far better than core cose - near-linear instead of O(n^2) per iteration -
  // and natively packs disconnected components/isolated nodes into a tidy grid (packComponents
  // + tile) instead of letting them fight for space (or pile up) in the main force simulation.
  // What actually matters for cost/quality here is how many elements are *visible* once
  // collapsed clusters hide their members - not the raw doc count.
  const visibleNodeCount = (totalDocCount - collapsedDocCount) + clusterParentNodes.length
  const numIter = getIterationsForNodeCount(visibleNodeCount)

  const layoutConfig = {
    name: 'fcose',
    // 'draft' quality only runs fcose's spectral layout step and skips the incremental
    // force-directed refinement entirely - which is what actually separates disconnected
    // single-node components (isolated docs, collapsed cluster placeholders). Without it,
    // every such node has no edge information to place it anywhere, so they all pile up in
    // the same spot. Collapsing large clusters already did the real work of cutting the
    // *visible* node count, so 'default' quality here stays affordable.
    quality: 'default',
    randomize: true,
    animate: false,
    fit: true,
    padding: 30,
    nodeDimensionsIncludeLabels: false,
    // packComponents requires the separate cytoscape-layout-utilities extension to do
    // anything - without it this option is a no-op, so `tile` alone is what actually
    // arranges disconnected single-node components into a grid.
    tile: true,
    tilingPaddingVertical: 20,
    tilingPaddingHorizontal: 20,
    nodeRepulsion: 4500,
    idealEdgeLength: 100,
    edgeElasticity: 0.45,
    nestingFactor: 0.1,
    numIter,
    gravity: 0.25,
    gravityRange: 3.8,
    gravityCompound: 1.0,
    gravityRangeCompound: 1.5,
    initialEnergyOnIncremental: 0.3
  }

  // Initialize cytoscape
  cy = cytoscape({
    container: cyContainer.value,
    elements: {
      nodes: allNodes,
      edges
    },
    selectionType: 'additive',
    boxSelectionEnabled: false, // Controlled by selectionMode
    userPanningEnabled: true, // Controlled by selectionMode
    autoungrabify: false,
    autounselectify: true, // Controlled by selectionMode
    // No layout here - we collapse clusters first (see below) so the real fcose layout only
    // ever has to place the reduced, visible node set, not the full raw graph.
    layout: { name: 'preset' },
    style: [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)', // Use color from node data
          'width': 'data(size)', // Use size from node data
          'height': 'data(size)'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'background-color': '#000000',
          'border-width': 0,
          'opacity': 1
        }
      },
      {
        selector: 'node.currentShown',
        style: {
          'border-width': 3,
          'border-color': '#000000',
          'border-style': 'solid'
        }
      },
      {
        selector: 'node:active',
        style: {
          'background-color': 'data(color)',
          'opacity': 0.8
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#95a5a6',
          'target-arrow-color': '#95a5a6',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      },
      {
        // Expanded cluster: just a loose dashed boundary behind its (individually visible)
        // member nodes - no fill/label so it doesn't compete visually with its children.
        selector: 'node[?isClusterParent]',
        style: {
          'background-color': 'data(color)',
          'background-opacity': 0.12,
          'border-width': 2,
          'border-style': 'dashed',
          'border-color': 'data(color)',
          'shape': 'round-rectangle',
          'label': ''
        }
      },
      {
        // Collapsed cluster: a single sized/labeled placeholder node standing in for its
        // hidden members. Class is added by cytoscape-expand-collapse itself.
        selector: 'node.cy-expand-collapse-collapsed-node',
        style: {
          'background-opacity': 0.9,
          'width': 'data(size)',
          'height': 'data(size)',
          'border-style': 'solid',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 13,
          'font-weight': 'bold',
          'color': '#ffffff',
          'text-outline-width': 2,
          'text-outline-color': 'data(color)'
        }
      },
      {
        // The library's own meta-edges (auto-created whenever a real per-document edge
        // crosses into a collapsed cluster) are superseded by the fictional cluster-to-cluster
        // edges below, which convey the same "these two clusters are connected" information
        // without misleadingly anchoring at whichever specific member happened to survive
        // rerouting - hide them (updateClusterEdgeVisibility handles the fictional ones).
        selector: 'edge.cy-expand-collapse-meta-edge',
        style: {
          'display': 'none'
        }
      },
      {
        // Fictional cluster-to-cluster edge: a synthetic connection directly between two
        // cluster parent nodes, not any specific document - shown instead of the real
        // per-document edges whenever at least one of the two clusters is collapsed (see
        // updateClusterEdgeVisibility). Dashed to read as a summary, not a literal citation.
        selector: 'edge[?isFictionalClusterEdge]',
        style: {
          'line-style': 'dashed',
          'width': 2,
          'line-color': '#95a5a6',
          'target-arrow-color': '#95a5a6',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      },
      {
        // A cluster can still end up :selected via box-selection in selection mode (it's
        // excluded from the selection *count*, but cytoscape still applies the class) -
        // override back to its normal look instead of the generic node:selected rule's
        // solid black, which would otherwise make it look broken/highlighted for no reason.
        selector: 'node[?isClusterParent]:selected',
        style: {
          'background-color': 'data(color)',
          'border-width': 2,
          'border-color': 'data(color)',
          'opacity': 1
        }
      }
    ]
  })

  // Register expand/collapse itself, but with its own +/- cue disabled (cueEnabled: false) -
  // that cue draws on a canvas overlay using its own bounding-box math, which drifts out of
  // sync with the node on zoom and sometimes fails to redraw at all (confirmed both bugs by
  // testing). Expand/collapse is now driven entirely through the hover popup's buttons (see
  // showClusterTooltip/onClusterToggle above), calling expandCollapseApi.collapse()/.expand()
  // directly - those methods work independently of the cue.
  expandCollapseApi = (cy as any).expandCollapse({
    layoutBy: null,
    animate: true,
    animationDuration: 300,
    undoable: false,
    fisheye: false,
    cueEnabled: false
  })

  const toCollapse = cy.nodes().filter(n => clusterIdsToCollapse.has(n.id()))
  if (toCollapse.length > 0) {
    expandCollapseApi.collapse(toCollapse)
  }

  // Dense real data can have dozens of citations between the same two clusters - each one
  // would otherwise render as its own edge (rerouted to a meta-edge for whichever side is
  // collapsed), which is both visual clutter and a real layout slowdown (fcose has to account
  // for every one of them as a separate spring). Once a cluster is collapsed, per-document
  // detail on that side is already gone from the view anyway, so a single fictional
  // cluster-to-cluster edge per direction (built above, alongside the real edges) conveys the
  // same "these two clusters are connected" information without a misleading real edge landing
  // on whichever specific member happened to survive rerouting. Toggle those fictional edges
  // on/off here based on current collapse state.
  //
  // This is deliberately NOT done via the library's own collapseAllEdges/expandAllEdges: those
  // merge N parallel edges into a stored, separately-tracked replacement edge, but that
  // bookkeeping doesn't cascade when a node later expands/collapses - the "restored" edge
  // keeps stale endpoints from whenever it was merged instead of re-deriving them (confirmed
  // by testing: expanding a cluster left its merged edge still pointing at the cluster id).
  const updateClusterEdgeVisibility = () => {
    if (!cy) return
    const collapsedClusterIds = new Set(cy.nodes('.cy-expand-collapse-collapsed-node').map(n => n.id()))
    cy.edges('[?isFictionalClusterEdge]').forEach(edge => {
      const collapseInvolved = collapsedClusterIds.has(edge.data('source')) || collapsedClusterIds.has(edge.data('target'))
      edge.style('display', collapseInvolved ? 'element' : 'none')
    })
    // Real per-document edges need no handling here: cytoscape already skips drawing an edge
    // whenever either of its real endpoints is hidden (i.e. a document inside a collapsed
    // cluster), and the library's own meta-edge reroutes are hidden via the stylesheet.
  }
  updateClusterEdgeVisibility()
  updateHasCollapsedClusters()

  // Anything cytoscape isn't currently drawing (a document hidden inside a collapsed cluster,
  // a hidden meta-edge, a fictional cluster edge that's toggled off) should also be excluded
  // from fcose's physics computation, not just its rendering - fcose only filters hidden
  // elements out much later (when writing final positions back onto nodes), well after the
  // costly force iterations already ran (verified by reading its source).
  const getLayoutEles = () => cy!.elements().filter(ele => ele.style('display') !== 'none')

  // Run the real layout once, over just the resulting (much smaller) visible graph.
  // eles isn't in @types/cytoscape's LayoutOptions even though the layouts themselves
  // support it (verified directly in cytoscape-fcose's source) - cast to work around that.
  cy.layout({ ...layoutConfig, eles: getLayoutEles() } as any).run()

  // Whenever the user manually expands/collapses a cluster by clicking it, re-layout
  // incrementally (randomize: false) so unrelated nodes don't jump around.
  const relayoutConfig = { ...layoutConfig, randomize: false, animate: true }
  cy.on('expandcollapse.aftercollapse expandcollapse.afterexpand', () => {
    updateClusterEdgeVisibility()
    updateHasCollapsedClusters()
    cy?.layout({ ...relayoutConfig, eles: getLayoutEles() } as any).run()
  })

  // Cluster interaction now happens entirely through the hover popup (Expand/Collapse +
  // Summary buttons, see showClusterTooltip above) - tapping a cluster's body no longer does
  // anything special, only real document nodes respond to tap.
  cy.on('tap', 'node[!isClusterParent]', (event) => {
    if (selectionMode.value) return
    const node = event.target
    cy?.$('.currentShown').removeClass('currentShown')
    node.addClass('currentShown')
    emit('docClick', node.data('id'))
  })

  // Cluster hover: show the Expand/Collapse + Summary popup instead of the built-in cue.
  cy.on('mouseover', 'node[?isClusterParent]', (event) => {
    if (cyContainer.value) cyContainer.value.style.cursor = 'pointer'
    scheduleShowClusterTooltip(event.target)
  })

  cy.on('mouseout', 'node[?isClusterParent]', () => {
    if (cyContainer.value) cyContainer.value.style.cursor = 'default'
    cancelPendingClusterShow()
    scheduleHideClusterTooltip()
  })

  // Add selection event listeners to update count
  cy.on('select', 'node', () => {
    updateSelectionCount()
  })

  cy.on('unselect', 'node', () => {
    updateSelectionCount()
  })

  // Add hover event listeners for tooltip
  cy.on('mouseover', 'node', (event) => {
    const node = event.target

    if (cyContainer.value) {
      cyContainer.value.style.cursor = 'pointer'
    }

    if (node.data('isClusterParent')) return
    const docData = node.data('fullData')

    // Darken node color on hover only if not selected
    if (!node.selected()) {
      node.style('opacity', 0.7)
    }

    // Clear any existing timeout
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout)
    }

    const isEchr = docData.data?.dataset === 'ECHR'
    tooltipContent.value = {
      ecli: docData.id || '',
      title: isEchr ? (docData.data?.title || '') : '',
      summary: (isEchr ? docData.data?.conclusion : docData.data?.summary) || 'No summary available',
      provisions: docData.data?.legal_provisions || []
    }

    // Show tooltip after a delay
    tooltipTimeout = setTimeout(() => {
      if (tooltip.value && node) {
        // Create popper instance for this node
        currentPopper = (node as any).popper({
          content: tooltip.value,
          popper: {
            placement: 'top',
            modifiers: [
              {
                name: 'arrow',
                options: {
                  element: tooltip.value?.querySelector('.graph-tooltip-arrow')
                }
              },
              {
                name: 'offset',
                options: {
                  offset: [0, 12]
                }
              },
              {
                name: 'preventOverflow',
                options: {
                  boundary: cyContainer.value,
                  padding: 10
                }
              },
              {
                name: 'flip',
                options: {
                  fallbackPlacements: ['bottom', 'left', 'right']
                }
              }
            ]
          }
        })

        tooltip.value.style.display = 'block'
        tooltip.value.style.opacity = '1'

        // Update popper position
        const update = () => {
          if (currentPopper && currentPopper.update) {
            currentPopper.update()
          }
        }

        // Update on zoom/pan
        cy?.on('pan zoom resize', update)
      }
    }, 300)
  })

  cy.on('mouseout', 'node', (event) => {
    const node = event.target

    // Reset cursor
    if (cyContainer.value) {
      cyContainer.value.style.cursor = 'default'
    }

    if (node.data('isClusterParent')) return

    // Reset node opacity only if not selected
    if (!node.selected()) {
      node.style('opacity', 1)
    }

    // Clear timeout and hide tooltip
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout)
      tooltipTimeout = null
    }

    if (tooltip.value) {
      tooltip.value.style.display = 'none'
      tooltip.value.style.opacity = '0'
    }

    // Destroy popper instance
    if (currentPopper) {
      if (currentPopper.destroy) {
        currentPopper.destroy()
      }
      currentPopper = null
    }

    // Remove event listeners
    cy?.off('pan zoom resize')
  })

  // Graph rendering complete
  isLoading.value = false
}

const destroyGraph = () => {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout)
    tooltipTimeout = null
  }
  if (currentPopper) {
    if (currentPopper.destroy) {
      currentPopper.destroy()
    }
    currentPopper = null
  }
  hideClusterTooltip()
  expandCollapseApi = null
  if (cy) {
    cy.destroy()
    cy = null
  }
}

onMounted(async () => {
  await initGraph()
})

watch(() => props.docs, async () => {
  destroyGraph()
  await initGraph()
}, { deep: true })

// Watch selectionMode and update Cytoscape accordingly
watch(selectionMode, (enabled) => {
  if (!cy) return
  
  if (enabled) {
    // Enable selection mode: allow selection, disable panning
    cy.$('.currentShown').removeClass('currentShown')
    cy.autounselectify(false)
    cy.boxSelectionEnabled(true)
    cy.userPanningEnabled(false)
  } else {
    cy.$('node').unselect()
    cy.autounselectify(true)
    cy.boxSelectionEnabled(false)
    cy.userPanningEnabled(true)
  }
})

defineExpose({
  highlightNodeById,
  applyFilters
})

onBeforeUnmount(() => {
  destroyGraph()
})
</script>

<style scoped>
.graph-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.filter-bar {
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

.filter-bar :deep(.p-iconfield) {
  width: 220px;
}

.cy-container {
  flex: 1;
  width: 100%;
  min-height: 600px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: default;
  /* position:relative alone doesn't contain descendants' z-index - it also needs a
     non-auto z-index of its own, otherwise a high z-index child (like the cue overlay
     canvas below) escapes into the parent's stacking context and can sit on top of
     sibling elements like .cy-controls/.selection-controls. */
  z-index: 0;
}

/* cytoscape-expand-collapse draws its +/- cue on its own full-size overlay canvas inside
   .cy-container. It's purely decorative - actual click handling happens through
   cytoscape's own event system on the container, not on this element - so make it
   click-through. Without this it can end up sitting on top of (and swallowing clicks
   meant for) the surrounding UI controls. */
:deep(.expand-collapse-canvas) {
  pointer-events: none;
}

.graph-tooltip {
  display: none;
  background-color: white;
  color: #2c3e50;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 11px;
  max-width: 300px;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
  opacity: 0;
  transition: opacity 0.15s ease;
  position: relative;
  overflow: visible;
}

.graph-tooltip[data-show] {
  display: block;
}

.graph-tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}

.graph-tooltip[data-popper-placement^='bottom'] .graph-tooltip-arrow {
  top: -8px;
  bottom: auto;
  border-top-color: transparent;
  border-bottom: 8px solid white;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
}

.cluster-tooltip {
  display: none;
  gap: 6px;
  padding: 6px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.cluster-tooltip :deep(.p-button) {
  white-space: nowrap;
}

.tooltip-ecli {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 10px;
  word-break: break-all;
  color: #3498db;
}

.tooltip-title {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 11px;
  color: #212529;
}

.tooltip-provisions {
  margin: 6px 0;
  padding-left: 16px;
  font-size: 9px;
  line-height: 1.4;
  color: #495057;
  max-height: 60px;
  overflow-y: auto;
}

.tooltip-provisions li {
  margin-bottom: 2px;
}

.tooltip-summary {
  font-size: 10px;
  line-height: 1.3;
  max-height: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  line-clamp: 6;
  -webkit-box-orient: vertical;
}

.cy-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  background-color: rgba(255, 255, 255, 0.95);
  padding: 6px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
  z-index: 10;
}

.cy-controls :deep(.p-button) {
  padding: 0.15rem 0.15rem;
}

.cy-controls :deep(.p-button-icon) {
  font-size: 10px;
}

.graph-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 250px;
  text-align: center;
}

.graph-loading p {
  margin: 0;
  color: #495057;
  font-size: 0.95rem;
}

.selection-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background-color: rgba(255, 255, 255, 0.95);
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #dee2e6;
  z-index: 10;
  min-width: 200px;
  pointer-events: auto;
}

.selection-controls :deep(.p-tooltip) {
  z-index: 9999 !important;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #dee2e6;
}

.selection-info i {
  pointer-events: auto;
}

.selection-label {
  font-size: 0.75rem;
  color: #495057;
  flex: 1;
  text-align: right;
}

.selection-mode {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.selection-actions {
  display: flex;
  gap: 10px;
  font-size: 10px;
  justify-content: center;
}

.mode-switch {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
}

.selection-actions :deep(.p-button) {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.selection-actions :deep(.p-button-icon) {
  font-size: 0.75rem;
}
</style>
