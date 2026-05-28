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
import type { LegalDocument } from 'legal-docs-client'
import 'vue-legal-docs-visualizer/style.css'

// Fetch legal documents from legal-docs-client
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

## Data Source

This library expects data in the format provided by [`legal-docs-client`](https://www.npmjs.com/package/legal-docs-client), which provides structured legal document data with:

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
| `docs` | `LegalDocument[]` | No | Array of legal documents from legal-docs-client |

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
