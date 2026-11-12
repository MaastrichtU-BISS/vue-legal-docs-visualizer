import type { Core } from 'cytoscape'

// Saving a graph as a picture, for every graph in this package. The file name is
// a pure function (tested); drawing the image is cytoscape's, and handing it to
// the browser as a download is the only DOM work.

/** The name given to a download when the host does not choose one. */
export const DEFAULT_IMAGE_NAME = 'graph'

/**
 * A safe file name ending in `.png`: characters operating systems reject are
 * replaced by dashes, spaces become dashes (never two in a row), and an empty or missing
 * name falls back to `graph`.
 */
export function imageFileName(name?: string): string {
  const base = (name ?? '')
    .trim()
    .replace(/\.png$/i, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
  return `${base || DEFAULT_IMAGE_NAME}.png`
}

// A canvas has a size limit; past it the picture comes out blank. The whole
// graph is drawn twice as large as it is on screen, up to this many pixels.
const SCALE = 2
const MAX_SIDE = 8000

/**
 * Downloads the whole graph (not only the part zoomed into) as a PNG on a white
 * background. Nodes hidden by a search or inside collapsed clusters are left out,
 * as they are not drawn. Does nothing for an empty graph.
 */
export async function downloadGraphImage(cy: Core | null, name?: string): Promise<void> {
  if (!cy || cy.elements().empty()) return

  const blob = (await (cy as any).png({
    output: 'blob-promise',
    full: true,
    scale: SCALE,
    bg: '#ffffff',
    maxWidth: MAX_SIDE,
    maxHeight: MAX_SIDE
  })) as Blob

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = imageFileName(name)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
