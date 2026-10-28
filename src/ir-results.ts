// Pure IR results helpers: score presentation and threshold selection, shared
// by the ResultsView component and the hosts. Kept free of Vue so tests can
// pin the policy without mounting.

import type { IRResult, IRSegment } from './config'
import type { HighlightRange } from './table'

/** The score bar's color: green above 0.5, ocean above 0.3, amber below. */
export function scoreColor(score: number): string {
  if (score > 0.5) return '#2e7d5b'
  if (score > 0.3) return '#1b6b93'
  return '#e8a838'
}

/** The score bar's width in percent, floored so slivers stay visible. */
export function scoreWidth(score: number): number {
  return Math.max(score * 100, 2)
}

/** Three-decimal score readout, as the retriever and the manager print them. */
export function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(3) : String(score)
}

/** True when the score is a number that misses the threshold. */
export function isBelowThreshold(score: number | undefined, threshold: number): boolean {
  return typeof score === 'number' && score < threshold
}

/**
 * The segments a threshold pre-ticks: every segment whose own score reaches
 * the threshold, across all results, in result order. A segment without a
 * score is never pre-ticked — an unmeasured provision is not a relevant one.
 *
 * The host owns the selection set; it calls this when results load, when the
 * method changes and when the threshold slider moves, and passes the result
 * back through `selectedSegmentIds`. The component only renders the set and
 * reports toggles.
 */
export function preselectedSegmentIds(results: IRResult[] = [], threshold = 0): string[] {
  const ids: string[] = []
  for (const result of results) {
    for (const segment of result.segments ?? []) {
      if (typeof segment.score === 'number' && segment.score >= threshold) ids.push(segment.id)
    }
  }
  return ids
}

/** Every case-insensitive occurrence of each term, as highlight ranges. */
export function termRanges(text: string, terms: string[] = []): HighlightRange[] {
  const ranges: HighlightRange[] = []
  const lowered = text.toLowerCase()
  for (const term of terms) {
    const needle = term.toLowerCase().trim()
    if (!needle) continue
    let from = 0
    for (;;) {
      const at = lowered.indexOf(needle, from)
      if (at < 0) break
      ranges.push({ start: at, end: at + needle.length })
      from = at + needle.length
    }
  }
  return ranges
}

/** Function words that carry no retrieval meaning; marking them is noise. */
const STOP_TERMS = new Set([
  'de', 'het', 'een', 'en', 'van', 'in', 'op', 'voor', 'met', 'dat', 'die', 'is', 'zijn', 'aan', 'te', 'bij', 'door',
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'it', 'be', 'are', 'for', 'on', 'with', 'as', 'by', 'that', 'this',
])

/** The query as highlight terms: the words long enough to be worth marking. */
export function queryTerms(query: string): string[] {
  return (query ?? '')
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !STOP_TERMS.has(term.toLowerCase()))
}

/** The segments of one result, best score first (ties keep their order). */
export function sortedSegments(segments: IRSegment[] = []): IRSegment[] {
  return segments
    .map((segment, index) => ({ segment, index }))
    .sort((a, b) => {
      const left = typeof a.segment.score === 'number' ? a.segment.score : -Infinity
      const right = typeof b.segment.score === 'number' ? b.segment.score : -Infinity
      return right - left || a.index - b.index
    })
    .map(({ segment }) => segment)
}

/**
 * The tabs a result offers in the results view: provisions only when it has
 * segments — a result without them would only ever show an empty list — and
 * the full document only when the host can load one.
 */
export function visibleTabs(
  segmentCount: number,
  hasDocumentLoader: boolean,
): ('provisions' | 'document')[] {
  const tabs: ('provisions' | 'document')[] = []
  if (segmentCount > 0) tabs.push('provisions')
  if (hasDocumentLoader) tabs.push('document')
  return tabs
}
