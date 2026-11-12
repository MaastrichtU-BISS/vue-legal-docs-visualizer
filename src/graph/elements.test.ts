import { describe, expect, it } from 'vitest'
import { buildElements, nodeMatches } from './elements'
import { colorsForGroups, DEFAULT_NODE_COLOR } from './palette'

describe('buildElements', () => {
  it('defaults a node label to its id and colour to the default', () => {
    const { nodes } = buildElements([{ id: 'a' }], [])
    expect(nodes).toEqual([{ data: { id: 'a', label: 'a', color: DEFAULT_NODE_COLOR } }])
  })

  it('keeps the first definition of a node listed twice', () => {
    const { nodes } = buildElements([{ id: 'a', label: 'First' }, { id: 'a', label: 'Second' }], [])
    expect(nodes).toHaveLength(1)
    expect(nodes[0].data.label).toBe('First')
  })

  it('gives nodes of one group one colour, and an explicit colour wins', () => {
    const { nodes } = buildElements(
      [
        { id: 'a', group: 'x' },
        { id: 'b', group: 'x' },
        { id: 'c', group: 'y' },
        { id: 'd', group: 'x', color: '#123456' }
      ],
      []
    )
    const color = (id: string) => nodes.find((n) => n.data.id === id)!.data.color
    expect(color('a')).toBe(color('b'))
    expect(color('a')).not.toBe(color('c'))
    expect(color('d')).toBe('#123456')
  })

  it('drops edges whose ends are not nodes', () => {
    const { edges } = buildElements([{ id: 'a' }, { id: 'b' }], [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'ghost' },
      { source: 'ghost', target: 'b' }
    ])
    expect(edges.map((e) => e.data.id)).toEqual(['a->b'])
  })

  it('merges edges with the same ends into one, joining distinct labels', () => {
    const { edges } = buildElements([{ id: 'a' }, { id: 'b' }], [
      { source: 'a', target: 'b', label: 'Cites' },
      { source: 'a', target: 'b', label: 'Implies' },
      { source: 'a', target: 'b', label: 'Cites' }
    ])
    expect(edges).toHaveLength(1)
    expect(edges[0].data.label).toBe('Cites, Implies')
  })

  it('treats a-to-b and b-to-a as different edges', () => {
    const { edges } = buildElements([{ id: 'a' }, { id: 'b' }], [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }
    ])
    expect(edges).toHaveLength(2)
  })

  it('gives an unlabelled edge an empty label', () => {
    const { edges } = buildElements([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }])
    expect(edges[0].data.label).toBe('')
  })
})

describe('nodeMatches', () => {
  const node = { id: 'doc-7', label: 'Ruling', title: 'The Seller', description: 'Must deliver the goods' }

  it('matches everything for an empty search', () => {
    expect(nodeMatches(node, '')).toBe(true)
    expect(nodeMatches(node, '  ')).toBe(true)
  })

  it('matches id, label, title and description in any case', () => {
    for (const q of ['DOC-7', 'ruling', 'seller', 'GOODS']) expect(nodeMatches(node, q)).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(nodeMatches(node, 'zzz')).toBe(false)
  })
})

describe('colorsForGroups', () => {
  it('assigns colours in order of first appearance and reuses the palette when it runs out', () => {
    const groups = Array.from({ length: 30 }, (_, i) => `g${i}`)
    const colors = colorsForGroups(groups)
    expect(colors.size).toBe(30)
    expect(colors.get('g0')).toBe(colorsForGroups(['g0']).get('g0'))
  })
})
