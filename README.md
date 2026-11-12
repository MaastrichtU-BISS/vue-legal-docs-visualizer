# Vue Legal Docs Visualizer

A Vue 3 component library for visualizing legal documents with interactive table and graph views.

## Installation

```bash
npm install vue-legal-docs-visualizer
# or
pnpm add vue-legal-docs-visualizer
# or
yarn add vue-legal-docs-visualizer
```

## Usage

```vue
<template>
  <LegalDocVisualizer :docs="legalDocs" />
</template>

<script setup lang="ts">
import { LegalDocVisualizer } from 'vue-legal-docs-visualizer'
import type { LegalDocument } from 'legal-docs-types'
import 'vue-legal-docs-visualizer/style.css'

// Fetched by your server — see node-legal-docs-client
const legalDocs: LegalDocument[] = [
  // Your legal documents here
]
</script>
```

### Global Installation (Optional)

If you want to use the components globally without importing them in each file:

```typescript
import { createApp } from 'vue'
import LegalDocsVisualizerPlugin from 'vue-legal-docs-visualizer'
import 'vue-legal-docs-visualizer/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(LegalDocsVisualizerPlugin)
app.mount('#app')
```

Then use it anywhere in your app:

```vue
<template>
  <LegalDocVisualizer :docs="legalDocs" />
</template>
```

## NetworkGraph: a generic graph

`LegalDocVisualizer` (above) takes legal documents and shows a table and a graph
of their citations. When all you have is *things that point at each other*, such
as the documents of one annotation task and the relations between them, you do
not have, or want to build, `LegalDocument` objects. `NetworkGraph` is the same
graph view for plain input:

```vue
<template>
  <NetworkGraph
    :nodes="nodes"
    :edges="edges"
    current-id="ruling-1"
    @node-click="(id) => open(id)"
  />
</template>

<script setup lang="ts">
import { NetworkGraph, type NetworkNode, type NetworkEdge } from 'vue-legal-docs-visualizer'
import 'vue-legal-docs-visualizer/style.css'

const nodes: NetworkNode[] = [
  { id: 'ruling-1', label: 'Ruling 1', title: 'Ruling 1', description: 'The Court held that...' },
  { id: 'ruling-2', label: 'Ruling 2' },
]
const edges: NetworkEdge[] = [{ source: 'ruling-1', target: 'ruling-2', label: 'Cites' }]
</script>
```

The input is two small interfaces with nothing legal in them. Everything except a
node's `id` and an edge's endpoints is optional:

| `NetworkNode` | | |
|---|---|---|
| `id` | `string` | Unique in the graph; edges refer to it. |
| `label` | `string?` | What the node shows. Defaults to `id`. |
| `title`, `description` | `string?` | The hover tooltip: a first line and a body. No tooltip when both are missing. |
| `group` | `string?` | Nodes of one group share a colour. |
| `color` | `string?` | An explicit CSS colour; wins over `group`. |

| `NetworkEdge` | | |
|---|---|---|
| `source`, `target` | `string` | The `id`s of the nodes the edge goes from and to (an arrow points at `target`). |
| `label` | `string?` | Shown along the edge, such as the kind of relation. |

Edges to unknown nodes are dropped, a node listed twice keeps its first
definition, and edges with the same ends are merged (their labels joined).

| Prop | Type | Notes |
|---|---|---|
| `nodes` | `NetworkNode[]` | Required. |
| `edges` | `NetworkEdge[]` | Default `[]`. |
| `currentId` | `string?` | The node in focus, drawn with a thick border. |
| `emptyText` | `string?` | Shown when there are no nodes. |

| Event / slot / method | |
|---|---|
| `node-click` | `(id: string)`: a node was clicked. What that does, such as opening a document, is up to the host. |
| `tooltip` slot | `{ node }`: replaces the default tooltip content. |
| `highlightNodeById(id)`, `fitToView()` | Exposed on the component instance. |

It keeps what makes the legal graph usable (search, zoom, fit to view, hover
tooltips, the same layout engine, so disconnected nodes are tidily packed) and
leaves out what is specific to citation networks: the table view, clusters,
multi-select, statistics and the document details panel. It needs the PrimeVue
setup the rest of the package needs (installing the plugin does it), and a
container with a height, since the graph fills its parent.

## Data Source

`LegalDocVisualizer` expects data in the format described by [`legal-docs-types`](https://www.npmjs.com/package/legal-docs-types), which provides structured legal document data with the following. (`NetworkGraph` does not use it.)

- Document metadata (ECLI, dates, instances, domains)
- Citations and cross-references
- Network statistics (degree centrality, PageRank, etc.)
- Full text links

## Features

### 📊 Table View
- Sortable and searchable data table
- Columns for ECLI, dates, statistics, and more
- CSV export functionality
- Click rows to view detailed document information

### 🕸️ Graph View
- Interactive network visualization of document citations
- Click nodes to explore relationships
- Search, Zooming and Fit into view
- Visual representation of citation networks

### 📄 Document Details Panel
- Comprehensive document information
- Citation navigation
- Statistics overview
- Direct links to full text

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `docs` | `LegalDocument[]` | No | Array of legal documents, shaped by `legal-docs-types` |

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build library
pnpm build
```

## License

MIT
