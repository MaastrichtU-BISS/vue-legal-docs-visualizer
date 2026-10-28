// Graph tooltip content: pure mapping from node data + display config to the
// tooltip the graph view renders, so the policy is testable without cytoscape.
//
// Compatibility contract with the pre-config tooltip: with the case-law
// preset's config the rendered content is unchanged — node id as headline,
// the subtitle field as the bold line, and a single unlabeled summary line
// that falls back to 'No summary available' when missing.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const compiled = ['graph-tooltip.ts', 'config.ts'].map((name) => {
  const source = readFileSync(join(here, '..', 'src', name), 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText
})
// config.ts has no imports of its own beyond types, so both modules load
// standalone; graph-tooltip imports types from config only, which transpile
// erases.
const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled[0]).toString('base64')
)

const { buildTooltipView } = mod

const NODE = {
  id: 'ECLI:NL:HR:2020:1176',
  data: {
    ecli: 'ECLI:NL:HR:2020:1176',
    title: 'Arrest A',
    summary: 'The court held…',
    heading: 'Use of terms',
    article: 'Art. 1',
    paragraph: '2',
    text: '“Areas beyond national jurisdiction” means the high seas and the Area.',
  },
}

test('no config: the node id headlines and the old fallback shows', () => {
  const view = buildTooltipView(NODE, undefined)
  assert.equal(view.headline, 'ECLI:NL:HR:2020:1176')
  assert.equal(view.title, '')
  assert.equal(view.subtitle, '')
  assert.deepEqual(view.lines, [])
  assert.equal(view.fallback, 'No summary available')
})

test('case-law preset shape renders exactly as the old tooltip did', () => {
  const view = buildTooltipView(NODE, {
    title: 'ecli',
    subtitle: 'title',
    lines: [{ label: 'Summary', field: 'summary' }],
  })
  assert.equal(view.headline, 'ECLI:NL:HR:2020:1176')
  // title field === headline value → deduped, not rendered twice
  assert.equal(view.title, '')
  assert.equal(view.subtitle, 'Arrest A')
  assert.deepEqual(view.lines, [{ label: 'Summary', text: 'The court held…', clamp: false }])
  assert.equal(view.fallback, '')
})

test('headline field wins; a missing one falls back to the node id', () => {
  const withField = buildTooltipView(NODE, { headline: 'heading' })
  assert.equal(withField.headline, 'Use of terms')

  const missing = buildTooltipView(NODE, { headline: 'no_such_field' })
  assert.equal(missing.headline, 'ECLI:NL:HR:2020:1176')
})

test('every configured line renders; empty ones are skipped', () => {
  const view = buildTooltipView(NODE, {
    lines: [
      { label: 'Article', field: 'article' },
      { label: 'Paragraph', field: 'paragraph' },
      { label: 'Section', field: 'section' }, // absent in data
    ],
  })
  assert.deepEqual(view.lines, [
    { label: 'Article', text: 'Art. 1', clamp: false },
    { label: 'Paragraph', text: '2', clamp: false },
  ])
  assert.equal(view.fallback, '')
})

test('a line callback composes its value and wins over the field', () => {
  const view = buildTooltipView(NODE, {
    lines: [
      {
        label: 'Provision',
        field: 'article',
        value: (node) => `${node.data.article} · para ${node.data.paragraph}`,
      },
    ],
  })
  assert.deepEqual(view.lines, [{ label: 'Provision', text: 'Art. 1 · para 2', clamp: false }])
})

test('clamp passes through to the line view', () => {
  const view = buildTooltipView(NODE, {
    lines: [{ label: 'Text', field: 'text', clamp: true }],
  })
  assert.equal(view.lines[0].clamp, true)
})

test('declared lines that all come up empty keep the old fallback', () => {
  const view = buildTooltipView(NODE, {
    lines: [{ label: 'Summary', field: 'no_such_field' }],
  })
  assert.deepEqual(view.lines, [])
  assert.equal(view.fallback, 'No summary available')
})
