// Annotation-kit hand-off adapter: pure functions, transpiled like
// config.test.mjs so no component mounting is needed.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'src', 'annotation.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
)

const { irResultsToAnnotationDocuments } = mod

const results = [
  {
    id: 'ECLI:NL:HR:2020:1176',
    title: 'Arrest A',
    score: 0.9,
    snippet: 'snippet fallback',
    segments: [
      { id: 'a_s1', text: 'seg one' },
      { id: 'a_s2', text: 'seg two' },
    ],
  },
  { id: 'no-title', score: 0.5, snippet: 'only snippet' },
]

test('each segment becomes its own annotation document', () => {
  const docs = irResultsToAnnotationDocuments(results)
  assert.equal(docs.length, 3)
  assert.equal(docs[0].name, 'Arrest A · a_s1')
  assert.equal(docs[0].key, 'a_s1')
  assert.equal(docs[0].full_text, 'seg one')
  assert.equal(docs[1].name, 'Arrest A · a_s2')
  assert.equal(docs[1].full_text, 'seg two')
})

test('honors the selected segment ids', () => {
  const docs = irResultsToAnnotationDocuments(results, new Set(['a_s2']))
  assert.equal(docs.length, 2)
  assert.equal(docs[0].key, 'a_s2')
  assert.equal(docs[0].full_text, 'seg two')
})

test('accepts an array of ids too', () => {
  const docs = irResultsToAnnotationDocuments(results, ['a_s1'])
  assert.equal(docs.length, 2)
  assert.equal(docs[0].full_text, 'seg one')
})

test('an empty selection falls back to whole documents on the snippet', () => {
  const docs = irResultsToAnnotationDocuments(results, new Set())
  assert.equal(docs.length, 2)
  assert.equal(docs[0].full_text, 'snippet fallback')
  assert.equal(docs[1].name, 'no-title')
  assert.equal(docs[1].full_text, 'only snippet')
  assert.ok(!('key' in docs[1]))
})

test('a selection missing every segment of a doc keeps the in-scope segment', () => {
  const docs = irResultsToAnnotationDocuments(results, new Set(['a_s1', 'missing']))
  assert.equal(docs.length, 2)
  assert.equal(docs[0].name, 'Arrest A · a_s1')
})

const { assignmentsToDocumentSet } = mod

const RESULTS = [
  {
    id: 'doc1', title: 'Doc One', score: 0.9,
    segments: [
      { id: 'doc1_s1', text: 'seg one' },
      { id: 'doc1_s2', text: 'seg two' },
    ],
  },
  {
    id: 'doc2', title: 'Doc Two', score: 0.7,
    segments: [{ id: 'doc2_s1', text: 'other seg' }],
  },
]

const ASSIGNMENTS = [
  {
    documentName: 'Doc One · doc1_s1',
    documentKey: 'doc1_s1',
    document_relations: [
      { to: 'doc2_s1', labels: ['Part of'] },
      { to: 'outside', labels: ['Is a'] },
    ],
    document_annotations: [{ label: 'Provision' }],
  },
  {
    documentName: 'Doc Two · doc2_s1',
    documentKey: 'doc2_s1',
    document_relations: [{ to: 'doc1_s1', labels: ['Is a', 'Related to'] }],
  },
]

test('assignments become segment nodes with parent info plus parent docs', () => {
  const set = assignmentsToDocumentSet(RESULTS, ASSIGNMENTS)
  assert.equal(set.nodes.length, 5) // 2 parents + 3 segments
  const seg = set.nodes.find((n) => n.id === 'doc1_s1')
  assert.equal(seg.data.parent, 'doc1')
  assert.equal(seg.data.parent_title, 'Doc One')
  assert.deepEqual(seg.data.document_tags, ['Provision'])
  assert.equal(seg.data.span_count, 1)
  const parent = set.nodes.find((n) => n.id === 'doc1')
  assert.equal(parent.data.type, 'document')
  assert.ok(!('document_tags' in parent.data))
})

test('document relations become edges; unknown targets are skipped', () => {
  const set = assignmentsToDocumentSet(RESULTS, ASSIGNMENTS)
  assert.equal(set.edges.length, 2)
  assert.deepEqual(set.edges[0], { id: 'doc1_s1->doc2_s1:Part of', source: 'doc1_s1', target: 'doc2_s1', relation_type: 'Part of' })
  assert.equal(set.edges[1].relation_type, 'Is a / Related to')
})

test('includeParentDocuments=false yields only segment nodes', () => {
  const set = assignmentsToDocumentSet(RESULTS, ASSIGNMENTS, { includeParentDocuments: false })
  assert.equal(set.nodes.length, 3)
  assert.ok(set.nodes.every((n) => n.data.type === 'segment'))
})

test('custom relation separator', () => {
  const set = assignmentsToDocumentSet(RESULTS, ASSIGNMENTS, { relationTypeSeparator: '+' })
  assert.equal(set.edges[1].relation_type, 'Is a+Related to')
})

test('no assignments yields nodes with no edges', () => {
  const set = assignmentsToDocumentSet(RESULTS, [])
  assert.equal(set.nodes.length, 5)
  assert.deepEqual(set.edges, [])
})
