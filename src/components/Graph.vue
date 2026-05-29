<template>
  <div class="filter-bar">
    <IconField>
      <InputIcon>
        <i class="pi pi-search" />
      </InputIcon>
      <InputText v-model="searchQuery" placeholder="Search..." @input="applyFilters" />
    </IconField>

    <Button label="Reset" icon="pi pi-times" severity="secondary" size="small" @click="resetFilters" />
  </div>
  <div class="graph-container">
    <div v-if="isLoading" class="graph-loading">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      <p><strong>{{ layoutInfo.nodeCount }}</strong> nodes · <strong>{{ layoutInfo.iterations }}</strong> iterations</p>
      <p style="font-size: 0.85rem; color: #6c757d;">
        {{ layoutInfo.iterations < 100 ? 'Optimizing layout...' : layoutInfo.iterations < 500 ? 'Fast layout mode' : 'High quality layout' }}
      </p>
    </div>
    <div class="cy-controls">
      <Button 
        icon="pi pi-plus" 
        severity="secondary" 
        size="small" 
        rounded 
        @click="zoomIn"
        v-tooltip="'Zoom In'" />
      <Button 
        icon="pi pi-minus" 
        severity="secondary" 
        size="small" 
        rounded 
        @click="zoomOut"
        v-tooltip="'Zoom Out'" />
      <Button 
        icon="pi pi-arrows-alt" 
        severity="secondary" 
        size="small" 
        rounded 
        @click="fitToView"
        v-tooltip="'Fit to View'" />
    </div>
    <div ref="cyContainer" class="cy-container"></div>
    <div ref="tooltip" class="graph-tooltip">
      <div class="graph-tooltip-arrow"></div>
      <div class="tooltip-ecli">{{ tooltipContent.ecli }}</div>
      <div class="tooltip-summary">{{ tooltipContent.summary }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue'
import cytoscape, { Core } from 'cytoscape'
import { createPopper } from '@popperjs/core'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'

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

export interface Props {
  docs?: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  docClick: [doc: any]
}>()

const isLoading = ref(false)

// Helper function to calculate iteration count based on node count
const getIterationsForNodeCount = (nodeCount: number): number => {
  if (nodeCount < 100) return 1000
  if (nodeCount < 300) return 500
  if (nodeCount < 500) return 200
  if (nodeCount < 1000) return 100
  if (nodeCount < 2000) return 50
  return 30
}

const layoutInfo = computed(() => {
  const nodeCount = props.docs?.length || 0
  const iterations = getIterationsForNodeCount(nodeCount)
  return { nodeCount, iterations }
})

const highlightNodeById = (id: string) => {
  if (!cy) return
  // Deselect all nodes first
  cy.$('node').unselect()
  const node = cy.$(`node[id="${id}"]`)
  if (node && !node.isEdge()) {
    cy.$(node).select()
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
    const docData = node.data('fullData')
    const nodeId = node.data('id')

    // Check search query
    const matchesSearch = !searchLower ||
      nodeId.toLowerCase().includes(searchLower) ||
      (docData?.data?.summary || '').toLowerCase().includes(searchLower)

    // Apply visibility
    if (matchesSearch) {
      node.style('display', 'element')
    } else {
      node.style('display', 'none')
    }
  })

  // Also manage edge visibility
  const edges = cy.edges()
  edges.forEach(edge => {
    if (edge.source().style('display') !== 'none' && edge.target().style('display') !== 'none') {
      edge.style('display', 'element')
    } else {
      edge.style('display', 'none')
    }
  })
}

const resetFilters = () => {
  searchQuery.value = ''
  applyFilters()
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


const cyContainer = ref<HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const tooltipContent = ref({ ecli: '', summary: '' })
let cy: Core | null = null
let tooltipTimeout: ReturnType<typeof setTimeout> | null = null
let currentPopper: any = null

const initGraph = async () => {
  if (!cyContainer.value || !props.docs || props.docs.length === 0) {
    isLoading.value = false
    return
  }

  isLoading.value = true

  // Register popper extension first
  await registerPopper()

  // Create nodes from docs
  const nodes = props.docs.map(doc => ({
    data: {
      id: doc.id,
      label: doc.id.split(':').pop() || doc.id, // Simplified label
      fullData: doc
    }
  }))

  // Create a Set of valid node IDs for edge validation
  const validNodeIds = new Set(props.docs.map(doc => doc.id))

  // Create edges from cites and cited_by
  const edges: any[] = []
  const addedEdges = new Set<string>() // To avoid duplicate edges

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
          }
        }
      })
    }
  })

  // Progressive layout optimization based on graph size
  // The COSE algorithm complexity is O(iterations × nodes²)
  // We scale down iterations, repulsion, and elasticity as graphs grow
  const nodeCount = nodes.length
  const numIter = getIterationsForNodeCount(nodeCount)
  
  let nodeRepulsion: number
  let edgeElasticity: number
  let coolingFactor: number
  
  if (nodeCount < 100) {
    // Small graphs: High quality
    nodeRepulsion = 400000
    edgeElasticity = 100
    coolingFactor = 0.95
  } else if (nodeCount < 300) {
    // Medium graphs: Good quality
    nodeRepulsion = 300000
    edgeElasticity = 80
    coolingFactor = 0.93
  } else if (nodeCount < 500) {
    // Large graphs: Balanced
    nodeRepulsion = 250000
    edgeElasticity = 60
    coolingFactor = 0.90
  } else if (nodeCount < 1000) {
    // Very large graphs: Performance focus
    nodeRepulsion = 200000
    edgeElasticity = 50
    coolingFactor = 0.88
  } else if (nodeCount < 2000) {
    // Huge graphs: Minimal iterations
    nodeRepulsion = 150000
    edgeElasticity = 40
    coolingFactor = 0.85
  } else {
    // Massive graphs: Ultra-fast
    nodeRepulsion = 100000
    edgeElasticity = 30
    coolingFactor = 0.80
  }

  const layoutConfig = {
    name: 'cose',
    animate: false,
    idealEdgeLength: 100,
    nodeOverlap: 20,
    refresh: 20,
    fit: true,
    padding: 30,
    randomize: false,
    componentSpacing: 100,
    nodeRepulsion,
    edgeElasticity,
    nestingFactor: 5,
    gravity: 80,
    numIter,
    initialTemp: 200,
    coolingFactor,
    minTemp: 1.0
  }

  console.log(`Graph rendering: ${nodeCount} nodes with ${numIter} iterations`)

  // Initialize cytoscape
  cy = cytoscape({
    container: cyContainer.value,
    elements: {
      nodes,
      edges
    },
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#3498db',
          'width': '40px',
          'height': '40px'
        }
      },
      {
        selector: 'node:active',
        style: {
          'background-color': '#2980b9'
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
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#e74c3c'
        }
      }
    ],
    layout: layoutConfig
  })

  // Add click event listener
  cy.on('tap', 'node', (event) => {
    const nodeId = event.target.data('id')
    highlightNodeById(nodeId)
    emit('docClick', nodeId)
  })

  // Add hover event listeners for tooltip
  cy.on('mouseover', 'node', (event) => {
    const node = event.target
    const docData = node.data('fullData')

    // Change cursor to pointer
    if (cyContainer.value) {
      cyContainer.value.style.cursor = 'pointer'
    }

    // Change node color on hover
    node.style('background-color', '#2980b9')

    // Clear any existing timeout
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout)
    }

    tooltipContent.value = {
      ecli: docData.id || '',
      summary: docData.data?.summary || 'No summary available'
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

    // Reset node color
    if (!node.selected()) {
      node.style('background-color', '#3498db')
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

defineExpose({
  highlightNodeById,
  applyFilters,
  resetFilters
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
  margin-bottom: 1rem;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-bar :deep(.p-iconfield) {
  flex: 1;
  min-width: 250px;
}

.cy-container {
  flex: 1;
  width: 100%;
  min-height: 600px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: default;
}

.graph-tooltip {
  display: none;
  background-color: white;
  color: #2c3e50;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 11px;
  max-width: 250px;
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

.tooltip-ecli {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 10px;
  word-break: break-all;
  color: #3498db;
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
  bottom: 12px;
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
</style>
