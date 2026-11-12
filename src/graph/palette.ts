// Colours for nodes. Kept apart from the component so the choice of colour is
// a plain, testable function.

/** The colour of a node that has neither a colour nor a group. */
export const DEFAULT_NODE_COLOR = '#3498db'

const GROUP_COLORS = [
  '#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#e74c3c', '#1abc9c',
  '#f1c40f', '#34495e', '#fd79a8', '#00b894', '#6c5ce7', '#fab1a0'
]

/**
 * A colour for each distinct group, in order of first appearance, reusing the
 * palette when there are more groups than colours.
 */
export function colorsForGroups(groups: Iterable<string>): Map<string, string> {
  const colors = new Map<string, string>()
  for (const group of groups) {
    if (!colors.has(group)) colors.set(group, GROUP_COLORS[colors.size % GROUP_COLORS.length])
  }
  return colors
}
