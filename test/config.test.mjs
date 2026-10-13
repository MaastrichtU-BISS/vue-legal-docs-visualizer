// Visualizer config: canonical document-set@1 input, presets and the
// case-law adapter. Pure functions only — transpiled with the repo's own
// TypeScript and evaluated, so no component mounting and no extra deps.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'src', 'config.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const url = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
const mod = await import(url)

const {
  caseLawConfig,
  echrConfig,
  provisionsConfig,
  visualizerPresets,
  resolveVisualizerConfig,
  mergeVisualizerConfig,
  documentSetFromLegalDocs,
} = mod

test('presets are registered', () => {
  assert.deepEqual(Object.keys(visualizerPresets).sort(), ['caseLaw', 'echr', 'provisions'])
})

test('case-law and ECHR share the graph shape but differ in columns', () => {
  assert.equal(caseLawConfig.grouping.mode, 'community')
  assert.equal(echrConfig.grouping.mode, 'community')
  assert.notDeepEqual(echrConfig.columns, caseLawConfig.columns)
  assert.equal(echrConfig.labels.entity, 'Document')
})

test('provisions is a parent-grouped, non-case-law config', () => {
  assert.equal(provisionsConfig.labels.entity, 'Provision')
  assert.equal(provisionsConfig.grouping.mode, 'parent')
  assert.equal(provisionsConfig.grouping.field, 'instrument')
  assert.equal(provisionsConfig.edges.types['Depends on'].direction, 'forward')
  assert.equal(provisionsConfig.analytics.includes('pageRank'), false)
})

test('resolveVisualizerConfig resolves ids, passthrough and undefined', () => {
  assert.equal(resolveVisualizerConfig('provisions'), provisionsConfig)
  assert.equal(resolveVisualizerConfig(undefined), undefined)
  const custom = { id: 'x', nodes: { label: 'name' }, edges: {}, grouping: { mode: 'none' }, columns: [] }
  assert.equal(resolveVisualizerConfig(custom), custom)
})

test('mergeVisualizerConfig overrides scalars, replaces columns, keeps the rest', () => {
  const merged = mergeVisualizerConfig(caseLawConfig, {
    columns: [{ field: 'id', header: 'ID' }],
    labels: { entity: 'Case' },
  })
  assert.equal(merged.labels.entity, 'Case')
  assert.equal(merged.labels.idLabel, 'ECLI')
  assert.deepEqual(merged.columns, [{ field: 'id', header: 'ID' }])
  assert.deepEqual(merged.analytics, caseLawConfig.analytics)
  assert.equal(merged.grouping.mode, 'community')
})

test('documentSetFromLegalDocs adapts docs and edges', () => {
  const set = documentSetFromLegalDocs(
    [{ id: 'ECLI:NL:1', data: { ecli: 'ECLI:NL:1', summary: 's' } }],
    [{ source: 'ECLI:NL:1', target: 'ECLI:NL:2', relation_type: 'cites' }],
  )
  assert.deepEqual(set.nodes, [{ id: 'ECLI:NL:1', data: { ecli: 'ECLI:NL:1', summary: 's' } }])
  assert.deepEqual(set.edges, [
    { id: 'e0', source: 'ECLI:NL:1', target: 'ECLI:NL:2', relation_type: 'cites' },
  ])
})
