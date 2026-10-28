// Relevance-metric helpers: pure functions over nodes/config, transpiled with
// the repo's own TypeScript so no component mounting is needed.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'src', 'relevance.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
)

const {
  resolveMetricField,
  nodeMetric,
  metricRange,
  metricToSize,
  metricToColor,
  passesMinRelevance,
} = mod

const baseConfig = { id: 'x', nodes: {}, edges: {}, grouping: { mode: 'none' }, columns: [] }
const node = (score) => ({ id: 'n', data: { score } })

test('metric field: relevanceField wins, then nodes.size', () => {
  assert.equal(resolveMetricField({ ...baseConfig, relevanceField: 'score', nodes: { label: 't', size: 'rank' } }), 'score')
  assert.equal(resolveMetricField({ ...baseConfig, nodes: { label: 't', size: 'score' } }), 'score')
  assert.equal(resolveMetricField(baseConfig), undefined)
})

test('nodeMetric reads only finite numbers', () => {
  assert.equal(nodeMetric(node(0.5), 'score'), 0.5)
  assert.equal(nodeMetric(node('high'), 'score'), undefined)
  assert.equal(nodeMetric({ id: 'n', data: {} }, 'score'), undefined)
  assert.equal(nodeMetric(node(1), undefined), undefined)
})

test('metricRange spans the values; undefined when no node has one', () => {
  assert.deepEqual(metricRange([node(0.2), node(0.9)], 'score'), { min: 0.2, max: 0.9 })
  assert.equal(metricRange([node('x')], 'score'), undefined)
})

test('minRelevance drops measurable low scores, keeps metric-less nodes', () => {
  assert.equal(passesMinRelevance(node(0.3), 'score', 0.5), false)
  assert.equal(passesMinRelevance(node(0.7), 'score', 0.5), true)
  assert.equal(passesMinRelevance({ id: 'n', data: {} }, 'score', 0.5), true)
  assert.equal(passesMinRelevance(node(0.1), 'score', undefined), true)
})

test('size maps the range onto 20-80px', () => {
  const range = { min: 0, max: 1 }
  assert.equal(metricToSize(0, range), 20)
  assert.equal(metricToSize(1, range), 80)
  assert.equal(metricToSize(0.5, range), 50)
  assert.ok(metricToSize(0.5, { min: 0.5, max: 0.5 }) >= 20)
})

test('color ramps from low to high and clamps', () => {
  const range = { min: 0, max: 1 }
  assert.equal(metricToColor(1, range), metricToColor(5, range))
  assert.equal(metricToColor(0, range), metricToColor(-1, range))
  assert.notEqual(metricToColor(0, range), metricToColor(1, range))
})
