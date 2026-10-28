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
  resolveFactoryConfig,
  caseLawConfig,
  echrConfig,
  provisionsConfig,
  visualizerPresets,
  resolveVisualizerConfig,
  mergeVisualizerConfig,
  documentSetFromLegalDocs,
} = mod

test('presets are registered', () => {
  assert.deepEqual(Object.keys(visualizerPresets).sort(), ['caseLaw', 'echr', 'ir', 'provisions'])
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

test('presets declare details, summary, date field and breakdowns', () => {
  const casePublication = caseLawConfig.details.find((d) => d.type === 'link')
  assert.equal(casePublication.field, 'url_publication')
  assert.equal(caseLawConfig.summaryField, 'summary')
  assert.equal(caseLawConfig.dateField, 'date_decision')
  assert.ok(caseLawConfig.breakdowns.some((b) => b.field === 'legal_provisions' && b.multi))

  assert.equal(echrConfig.summaryField, 'conclusion')
  assert.equal(echrConfig.dateField, 'date_judgment')
  assert.ok(echrConfig.breakdowns.some((b) => b.field === 'article_violated' && b.multi))

  assert.equal(provisionsConfig.labels.idLabel, 'Provision ID')
  assert.equal(provisionsConfig.breakdowns[0].field, 'instrument')
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

test('ir preset carries views and relevance config', () => {
  const { irConfig, irResultsToDocumentSet } = mod
  assert.deepEqual(irConfig.views, ['documents'])
  assert.equal(irConfig.documentsView, 'results')
  assert.equal(irConfig.threshold, 0.2)
  assert.equal(irConfig.relevanceField, 'score')
  assert.equal(irConfig.snippetField, 'snippet')
  const set = irResultsToDocumentSet([
    { id: 'r1', score: 0.9, title: 'T', snippet: 'S', rank: 1, segments: [{ id: 's1', text: 'seg', score: 0.5 }] },
  ])
  assert.equal(set.nodes[0].id, 'r1')
  assert.equal(set.nodes[0].data.score, 0.9)
  assert.deepEqual(set.nodes[0].data.segments, [{ id: 's1', text: 'seg', score: 0.5 }])
})

test('merge keeps views and IR fields', () => {
  const { irConfig, mergeVisualizerConfig } = mod
  const merged = mergeVisualizerConfig(irConfig, { views: ['graph'], minRelevance: 0.5 })
  assert.deepEqual(merged.views, ['graph'])
  assert.equal(merged.minRelevance, 0.5)
  assert.equal(merged.documentsView, 'results')
  assert.equal(merged.threshold, 0.2)
  assert.equal(merged.relevanceField, 'score')
})

test('factory resolution: empty options fall back to the ir preset', () => {
  const { config } = resolveFactoryConfig()
  assert.equal(config.id, 'ir')
  assert.deepEqual(config.views, ['documents'])
})

test('factory resolution: preset id resolves with its own views', () => {
  const { config } = resolveFactoryConfig({ config: 'ir' })
  assert.equal(config.id, 'ir')
  assert.deepEqual(config.views, ['documents'])
})

test('factory resolution: explicit views override the config views', () => {
  const fromPreset = resolveFactoryConfig({ config: 'ir', views: ['graph'] })
  assert.deepEqual(fromPreset.config.views, ['graph'])
  const fromObject = resolveFactoryConfig({
    config: { id: 'x', nodes: { label: 't' }, edges: {}, grouping: { mode: 'none' }, columns: [], views: ['documents'] },
    views: ['documents', 'graph'],
  })
  assert.deepEqual(fromObject.config.views, ['documents', 'graph'])
})

test('factory resolution: full config passes through unchanged without views', () => {
  const full = { id: 'x', nodes: { label: 't' }, edges: {}, grouping: { mode: 'none' }, columns: [], views: ['documents'] }
  const { config } = resolveFactoryConfig({ config: full })
  assert.equal(config, full)
})
