import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE_NAME, imageFileName } from './exportImage'

describe('imageFileName', () => {
  it('adds .png', () => {
    expect(imageFileName('document-relations')).toBe('document-relations.png')
  })

  it('does not double the extension, whatever its case', () => {
    expect(imageFileName('map.png')).toBe('map.png')
    expect(imageFileName('map.PNG')).toBe('map.png')
  })

  it('falls back to a default for a missing or blank name', () => {
    for (const name of [undefined, '', '   ', '///', '...']) {
      expect(imageFileName(name)).toBe(`${DEFAULT_IMAGE_NAME}.png`)
    }
  })

  it('replaces characters file systems reject, and spaces', () => {
    expect(imageFileName('Ruling 1: a/b?')).toBe('Ruling-1-a-b.png')
    expect(imageFileName('  two   words ')).toBe('two-words.png')
  })

  it('keeps letters, digits and dots inside the name', () => {
    expect(imageFileName('v1.2 graph')).toBe('v1.2-graph.png')
  })
})
