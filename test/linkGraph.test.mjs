// Annotation -> document-set@1 adapter. Pure functions only.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'src', 'linkGraph.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { documentSetFromAnnotations } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
)

const docs = [
  { name: 'Art 1', relations: [{ to: 'a2', labels: ['Depends on'] }, { to: 'Missing', labels: ['Is a'] }] },
  { name: 'Art 2', key: 'a2', relations: [{ to: 'a2', labels: ['Related to'] }] },
  { name: 'Lonely', relations: [] },
]

test('builds one node per document and one edge per resolvable relation', () => {
  const set = documentSetFromAnnotations(docs)
  assert.deepEqual(set.nodes.map((n) => n.id), ['Art 1', 'a2', 'Lonely'])
  assert.deepEqual(set.edges, [
    { id: 'Art 1->a2', source: 'Art 1', target: 'a2', relation_type: 'Depends on' },
    { id: 'a2->a2', source: 'a2', target: 'a2', relation_type: 'Related to' },
  ])
})

test('drops relations to unknown targets and dedupes edges', () => {
  const set = documentSetFromAnnotations([
    { name: 'A', relations: [{ to: 'B', labels: ['x'] }, { to: 'B', labels: ['y'] }, { to: 'Z', labels: ['x'] }] },
    { name: 'B' },
  ])
  assert.equal(set.edges.length, 1)
  assert.equal(set.edges[0].relation_type, 'x')
})

test('includeUnlinked:false drops isolated nodes', () => {
  const set = documentSetFromAnnotations(docs, { includeUnlinked: false })
  assert.deepEqual(set.nodes.map((n) => n.id), ['Art 1', 'a2'])
})

test('groupBy sets the compound parent key', () => {
  const set = documentSetFromAnnotations(docs, { groupBy: (d) => (d.name === 'Lonely' ? undefined : 'BBNJ') })
  assert.equal(set.nodes.find((n) => n.id === 'Art 1').data.parent, 'BBNJ')
  assert.equal('parent' in set.nodes.find((n) => n.id === 'Lonely').data, false)
})

test('relationType can pick a different label', () => {
  const set = documentSetFromAnnotations(
    [{ name: 'A', relations: [{ to: 'B', labels: ['Is a', 'Has a'] }] }, { name: 'B' }],
    { relationType: (r) => r.labels[1] },
  )
  assert.equal(set.edges[0].relation_type, 'Has a')
})
