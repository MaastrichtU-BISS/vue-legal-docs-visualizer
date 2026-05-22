<template>
    <div class="graph-container">
        <div ref="cyContainer" class="cy-container"></div>
        <div ref="tooltip" class="graph-tooltip">
            <div class="graph-tooltip-arrow"></div>
            <div class="tooltip-ecli">{{ tooltipContent.ecli }}</div>
            <div class="tooltip-summary">{{ tooltipContent.summary }}</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import cytoscape, { Core } from 'cytoscape'
import { createPopper } from '@popperjs/core'

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
  nodeClick: [doc: any]
}>()

const cyContainer = ref<HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const tooltipContent = ref({ ecli: '', summary: '' })
let cy: Core | null = null
let tooltipTimeout: ReturnType<typeof setTimeout> | null = null
let currentPopper: any = null

const initGraph = async () => {
  if (!cyContainer.value || !props.docs || props.docs.length === 0) return

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
          'background-color': '#e74c3c',
          'border-width': 3,
          'border-color': '#c0392b'
        }
      }
    ],
    layout: {
      name: 'cose',
      animate: false,
      idealEdgeLength: 100,
      nodeOverlap: 20,
      refresh: 20,
      fit: true,
      padding: 30,
      randomize: false,
      componentSpacing: 100,
      nodeRepulsion: 400000,
      edgeElasticity: 100,
      nestingFactor: 5,
      gravity: 80,
      numIter: 1000,
      initialTemp: 200,
      coolingFactor: 0.95,
      minTemp: 1.0
    }
  })

  // Add click event listener
  cy.on('tap', 'node', (event) => {
    const node = event.target
    const docData = node.data('fullData')
    emit('nodeClick', docData)
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
</style>
