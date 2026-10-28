// IR results helpers: score presentation and threshold selection, transpiled
// with the repo's own TypeScript so no component mounting is needed.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'src', 'ir-results.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
)

const {
  scoreColor,
  scoreWidth,
  formatScore,
  isBelowThreshold,
  preselectedSegmentIds,
  termRanges,
  queryTerms,
  sortedSegments,
  segmentPage,
  pageCount,
} = mod

test('score color bands: green above .5, ocean above .3, amber below', () => {
  assert.equal(scoreColor(0.9), '#2e7d5b')
  assert.equal(scoreColor(0.5), '#1b6b93')
  assert.equal(scoreColor(0.31), '#1b6b93')
  assert.equal(scoreColor(0.3), '#e8a838')
  assert.equal(scoreColor(0.1), '#e8a838')
})

test('score width floors at 2% so slivers stay visible', () => {
  assert.equal(scoreWidth(0), 2)
  assert.equal(scoreWidth(0.5), 50)
  assert.equal(scoreWidth(1), 100)
})

test('formatScore prints three decimals', () => {
  assert.equal(formatScore(0.5), '0.500')
  assert.equal(formatScore(1), '1.000')
})

test('isBelowThreshold: missing scores are never below', () => {
  assert.equal(isBelowThreshold(0.1, 0.2), true)
  assert.equal(isBelowThreshold(0.2, 0.2), false)
  assert.equal(isBelowThreshold(undefined, 0.2), false)
})

test('preselectedSegmentIds admits segments at or above the threshold, across results', () => {
  const results = [
    { id: 'd1', score: 0.9, segments: [{ id: 'a', text: '', score: 0.8 }, { id: 'b', text: '', score: 0.1 }] },
    { id: 'd2', score: 0.4, segments: [{ id: 'c', text: '', score: 0.2 }, { id: 'd', text: '' }] },
  ]
  assert.deepEqual(preselectedSegmentIds(results, 0.2), ['a', 'c'])
  assert.deepEqual(preselectedSegmentIds(results, 0.5), ['a'])
  assert.deepEqual(preselectedSegmentIds(results, 0.9), [])
  assert.deepEqual(preselectedSegmentIds(results, 0), ['a', 'b', 'c'])
})

const segments = [
  { id: 'low', text: 'x', score: 0.1 },
  { id: 'top', text: 'y', score: 0.9 },
  { id: 'mid', text: 'z', score: 0.5 },
  { id: 'unmeasured', text: 'w' },
]

test('sortedSegments ranks by score, unmeasured last, ties stable', () => {
  assert.deepEqual(sortedSegments(segments).map((s) => s.id), ['top', 'mid', 'low', 'unmeasured'])
})

test('termRanges marks every occurrence case-insensitively', () => {
  assert.deepEqual(termRanges('Data retention of data', ['data']), [
    { start: 0, end: 4 },
    { start: 18, end: 22 },
  ])
  assert.deepEqual(termRanges('nothing here', []), [])
  assert.deepEqual(termRanges('abc', ['  ']), [])
})

test('queryTerms keeps words of two characters or more, minus function words', () => {
  assert.deepEqual(queryTerms('data retention of AI'), ['data', 'retention', 'AI'])
  assert.deepEqual(queryTerms('the overeenkomst is gesloten'), ['overeenkomst', 'gesloten'])
  assert.deepEqual(queryTerms('   '), [])
})

// --- segment pagination (issue #16) ---------------------------------------------

const PAGE_SEGMENTS = Array.from({ length: 45 }, (_, i) => ({ id: `s${i + 1}`, text: `t${i + 1}` }))

test('segmentPage slices the sorted list; the last page may be partial', () => {
  assert.deepEqual(segmentPage(PAGE_SEGMENTS, 0, 20).map((s) => s.id), PAGE_SEGMENTS.slice(0, 20).map((s) => s.id))
  assert.deepEqual(segmentPage(PAGE_SEGMENTS, 2, 20).map((s) => s.id), ['s41', 's42', 's43', 's44', 's45'])
  assert.deepEqual(segmentPage(PAGE_SEGMENTS, 3, 20), [])
})

test('segmentPage tolerates a degenerate page size', () => {
  assert.equal(segmentPage(PAGE_SEGMENTS, 0, 0).length, 1)
  assert.equal(segmentPage(PAGE_SEGMENTS, 1, 0).length, 1)
  assert.deepEqual(segmentPage(PAGE_SEGMENTS, 0, 0)[0].id, 's1')
})

test('pageCount rounds up and never reports zero', () => {
  assert.equal(pageCount(45, 20), 3)
  assert.equal(pageCount(40, 20), 2)
  assert.equal(pageCount(0, 20), 1)
  assert.equal(pageCount(45, 0), 45)
})
