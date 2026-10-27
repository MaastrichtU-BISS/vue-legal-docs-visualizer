// Table model: document-set@1 + VisualizerConfig -> columns and rows.
// Pure functions only — transpiled and evaluated, no mounting, no extra deps.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))

async function loadTs(relPath) {
  const source = readFileSync(join(here, '..', 'src', relPath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
}

const config = await loadTs('config.ts')
const table = await loadTs('table.ts')

const caseLawGraph = {
  nodes: [
    { id: 'ECLI:1', data: { summary: 's', date_decision: '2020-01-01', statistics: { pageRank: 0.5 } } },
    { id: 'ECLI:2', data: {} },
  ],
  edges: [{ source: 'ECLI:1', target: 'ECLI:2', relation_type: 'cites' }],
}

test('case-law model derives content and analytics columns', () => {
  const model = table.buildTableModel(caseLawGraph, config.caseLawConfig)
  const fields = model.columns.map((c) => c.field)
  assert.ok(fields.includes('ecli'))
  assert.ok(fields.includes('timesCited'))
  assert.ok(fields.includes('metric_pageRank'))
  assert.ok(fields.includes('metric_inDegree'))

  const row0 = model.rows[0]
  assert.equal(row0.__id, 'ECLI:1')
  assert.equal(row0.ecli, 'ECLI:1')
  assert.equal(row0.date, '2020-01-01')
  assert.equal(row0.timesCited, 0)
  assert.equal(row0.metric_pageRank, 0.5)

  const row1 = model.rows[1]
  assert.equal(row1.timesCited, 1)
  assert.equal(row1.metric_inDegree, 1)
})

test('provisions model uses declared columns and degree metrics', () => {
  const graph = {
    nodes: [{ id: 'p1', data: { title: 'T', instrument: 'BBNJ' } }],
    edges: [{ source: 'p1', target: 'p2' }],
  }
  const model = table.buildTableModel(graph, config.provisionsConfig)
  assert.deepEqual(
    model.columns.map((c) => c.field),
    ['id', 'title', 'instrument', 'metric_degree', 'metric_inDegree', 'metric_outDegree'],
  )
  const row = model.rows[0]
  assert.equal(row.id, 'p1')
  assert.equal(row.title, 'T')
  assert.equal(row.instrument, 'BBNJ')
  assert.equal(row.metric_degree, 1)
  assert.equal(row.metric_outDegree, 1)
  assert.equal(row.metric_inDegree, 0)
})

test('an overridden column value accessor wins', () => {
  const cfg = config.mergeVisualizerConfig(config.provisionsConfig, {
    columns: [{ field: 'label', header: 'Label', value: (n) => `${n.id}!` }],
  })
  const model = table.buildTableModel({ nodes: [{ id: 'p1', data: {} }], edges: [] }, cfg)
  assert.equal(model.rows[0].label, 'p1!')
})

test('formatCell formats numbers and missing values', () => {
  const col = { field: 'x', header: 'X', type: 'number', sortable: true }
  assert.equal(table.formatCell(undefined, col, {}), '-')
  assert.equal(table.formatCell('', col, {}), '-')
  assert.equal(table.formatCell(2, col, {}), '2')
  assert.equal(table.formatCell(0.123456, col, {}), '0.1235')
  assert.equal(table.formatCell(0.001, col, {}), '1.0000e-3')
  assert.equal(table.formatCell('text', col, {}), 'text')
})

test('formatCell prefers a column formatter', () => {
  const col = { field: 'x', header: 'X', type: 'default', sortable: false, formatter: () => 'F' }
  assert.equal(table.formatCell('anything', col, {}), 'F')
})

test('splitHighlights marks the reported ranges', async () => {
  const { splitHighlights } = table
  const chunks = splitHighlights('de fetch blijft', [{ start: 3, end: 8 }])
  assert.deepEqual(chunks, [
    { text: 'de ', marked: false },
    { text: 'fetch', marked: true },
    { text: ' blijft', marked: false },
  ])
})

test('splitHighlights clamps out-of-range and merges overlaps', () => {
  const { splitHighlights } = table
  assert.deepEqual(splitHighlights('abcd', [{ start: 1, end: 3 }, { start: 2, end: 9 }, { start: -5, end: 0 }]), [
    { text: 'a', marked: false },
    { text: 'bcd', marked: true },
  ])
  assert.deepEqual(splitHighlights('', [{ start: 0, end: 5 }]), [])
})
