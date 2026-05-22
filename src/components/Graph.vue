<template>
    <div class="graph-container">
        <div ref="cyContainer" class="cy-container"></div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import cytoscape, { Core } from 'cytoscape'

export interface Props {
  docs?: any[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  nodeClick: [doc: any]
}>()

const cyContainer = ref<HTMLElement | null>(null)
let cy: Core | null = null

const initGraph = () => {
  if (!cyContainer.value || !props.docs || props.docs.length === 0) return

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
          'label': 'data(label)',
          'color': '#2c3e50',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'width': '40px',
          'height': '40px'
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
}

const destroyGraph = () => {
  if (cy) {
    cy.destroy()
    cy = null
  }
}

onMounted(() => {
  initGraph()
})

watch(() => props.docs, () => {
  destroyGraph()
  initGraph()
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
}

.cy-container {
  flex: 1;
  width: 100%;
  min-height: 600px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}
</style>
