// A stubbed backend for the demo.
//
// The real package never calls an API, and neither does the demo. The stub
// below stands in for the retrieval service legal-blocks would run: it returns
// search-engine-style IR results (score, snippet, highlights, segments) plus
// the relations between the retrieved documents, all in-memory, so the demo
// runs with no token and no network.
//
// Documents are segmented into provisions, mirroring what
// vue-legal-document-manager loads per document — the visualizer shows those
// segments in the details panel.

import type { IRResult } from '../src/config'

export interface DemoDocument {
  id: string
  title: string
  date: string
  instance: string
  segments: { id: string; text: string }[]
}

export interface DemoRelation {
  source: string
  target: string
  relation_type: 'cites' | 'related to'
}

const CORPUS: DemoDocument[] = [
  {
    id: 'ECLI:NL:HR:2020:1176',
    title: 'HR 2020 — verbrandingsoven',
    date: '2020-11-06',
    instance: 'Hoge Raad',
    segments: [
      { id: '1176_s1', text: 'De Hoge Raad overweegt dat de eis in reconventie ontvankelijk is.' },
      { id: '1176_s2', text: 'Artikel 6:74 BW is van toepassing op de onderhavige levering.' },
      { id: '1176_s3', text: 'Het middel faalt, het beroep wordt verworpen.' },
      { id: '1176_s4', text: 'De kosten van het geding worden verleend aan de eiser.' },
    ],
  },
  {
    id: 'ECLI:NL:HR:2021:214',
    title: 'HR 2021 — arbeidsovereenkomst',
    date: '2021-02-19',
    instance: 'Hoge Raad',
    segments: [
      { id: '214_s1', text: 'Vaststelling van de feiten en omstandigheden rond het dienstverband.' },
      { id: '214_s2', text: 'De redelijkheids- en billijkheidscorrectie past hier niet.' },
      { id: '214_s3', text: 'De Hoge Raad vernietigt het bestreden arrest.' },
    ],
  },
  {
    id: 'ECLI:NL:RBDHA:2019:7543',
    title: 'Rb Den Haag 2019 — milieuzonering',
    date: '2019-07-10',
    instance: 'Rechtbank Den Haag',
    segments: [
      { id: '7543_s1', text: 'De exploitatie veroorzaakt geen onaanvaardbare hinder in de woonzone.' },
      { id: '7543_s2', text: 'De vordering wordt afgewezen.' },
      { id: '7543_s3', text: 'Artikel 3:296 BW vormt de grondslag voor de gevorderde gemachtigde.' },
    ],
  },
  {
    id: 'ECLI:EU:C:2022:44',
    title: 'CJEU 2022 — data retention',
    date: '2022-01-18',
    instance: 'CJEU',
    segments: [
      { id: 'eu44_s1', text: 'Directive 2006/24/EC is invalid under Articles 7 and 8 of the Charter.' },
      { id: 'eu44_s2', text: 'Member States may not impose general data-retention obligations.' },
      { id: 'eu44_s3', text: 'Access to retained data must be limited to serious crime, subject to review.' },
    ],
  },
  {
    id: 'ECLI:NL:RBMNE:2022:1189',
    title: 'Rb Midden-Nederland 2022 — zorgverzekering',
    date: '2022-09-01',
    instance: 'Rechtbank Midden-Nederland',
    segments: [
      { id: '1189_s1', text: 'De zorgverzekeraar heeft de wettelijke rente onterecht verrekend.' },
      { id: '1189_s2', text: 'Artikel 6:234 BW bepaalt de inhoud van de overeenkomst.' },
      { id: '1189_s3', text: 'De eiser dient te doen hetgeen hem is opgelegd bij arrest.' },
      { id: '1189_s4', text: 'Nu de eis gegrond is, wordt de verweerder veroordeeld in de proceskosten.' },
    ],
  },
  {
    id: 'ECLI:EU:C:2023:541',
    title: 'CJEU 2023 — AI liability directive',
    date: '2023-07-05',
    instance: 'CJEU',
    segments: [
      { id: 'eu541_s1', text: 'The Court holds that the precautionary principle applies to automated decision systems.' },
      { id: 'eu541_s2', text: 'Article 82 of the GDPR establishes strict liability for controller fault.' },
      { id: 'eu541_s3', text: 'Burden of proof shifts to the controller where causation is plausible.' },
      { id: 'eu541_s4', text: 'National courts must guarantee effective judicial protection under Article 47.' },
      { id: 'eu541_s5', text: 'The directive does not preclude more favourable national provisions.' },
    ],
  },
  {
    id: 'ECLI:NL:HR:2023:987',
    title: 'HR 2023 — aansprakelijkheid AI-systeem',
    date: '2023-10-13',
    instance: 'Hoge Raad',
    segments: [
      { id: '987_s1', text: 'De Hoge Raad overweegt dat art. 6:162 BW ook op AI-handelingen van toepassing is.' },
      { id: '987_s2', text: 'De rechtbank heeft het verwijtbaarheidscriterium juist toegepast.' },
      { id: '987_s3', text: 'Er bestaat geen causaliteitsbreuk tussen de defecte output en de schade.' },
      { id: '987_s4', text: 'Het cassatiemiddel komt niet tot een andere beoordeling.' },
      { id: '987_s5', text: 'De Hoge Raad verwerpt het beroep en bevestigt de uitspraak.' },
      { id: '987_s6', text: 'Het arrest verwijst uitdrukkelijk naar het EU-kader voor AI-aansprakelijkheid.' },
    ],
  },
]

const RELATIONS: DemoRelation[] = [
  { source: 'ECLI:NL:HR:2021:214', target: 'ECLI:NL:HR:2020:1176', relation_type: 'cites' },
  { source: 'ECLI:NL:RBDHA:2019:7543', target: 'ECLI:EU:C:2022:44', relation_type: 'related to' },
  { source: 'ECLI:NL:RBMNE:2022:1189', target: 'ECLI:NL:HR:2021:214', relation_type: 'cites' },
  { source: 'ECLI:NL:HR:2023:987', target: 'ECLI:EU:C:2023:541', relation_type: 'cites' },
  { source: 'ECLI:NL:HR:2023:987', target: 'ECLI:NL:HR:2020:1176', relation_type: 'related to' },
]

// --- retrieval methods --------------------------------------------------------
// The service (bluelab/retrieval) ranks provisions and scores a document by
// its best provision — the demo mirrors that shape so the view is exercised
// the way production data hits it. BM25 and TF-IDF run for real over the
// in-memory corpus; SBERT cannot (no model in a browser), so it stands in as
// a deterministic hashed n-gram embedding approximation.

/** The demo's methods, in the shape the provision-retriever's picker takes. */
export const DEMO_METHODS = [
  { id: 'tfidf', label: 'TF-IDF' },
  { id: 'bm25', label: 'BM25' },
  { id: 'sbert', label: 'SBERT (approx.)' },
]

const STOPWORDS = new Set([
  'de', 'het', 'een', 'en', 'van', 'in', 'op', 'voor', 'met', 'dat', 'die', 'is', 'zijn', 'aan', 'te', 'onder', 'bij', 'door', 'uit', 'the', 'a', 'an', 'of', 'to', 'and', 'in', 'is', 'it', 'be', 'are',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9àáäâèéëêìíïîòóöôùúüûñç]+/i)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
}

interface IndexedSegment {
  doc: DemoDocument
  segment: { id: string; text: string }
  tokens: string[]
}

const INDEX: IndexedSegment[] = CORPUS.flatMap((doc) =>
  doc.segments.map((segment) => ({ doc, segment, tokens: tokenize(`${doc.title} ${segment.text}`) })),
)

/** Okapi BM25 (k1=1.5, b=0.75) over the segments, as the service's bm25.py does. */
function bm25Scores(query: string): Map<IndexedSegment, number> {
  const terms = tokenize(query)
  const scores = new Map<IndexedSegment, number>()
  if (!terms.length) return scores
  const k1 = 1.5
  const b = 0.75
  const avgLen = INDEX.reduce((sum, entry) => sum + entry.tokens.length, 0) / INDEX.length
  const docFreq = new Map<string, number>()
  for (const term of new Set(terms)) {
    docFreq.set(term, INDEX.filter((entry) => entry.tokens.includes(term)).length)
  }
  for (const entry of INDEX) {
    const len = entry.tokens.length
    const tf = new Map<string, number>()
    for (const token of entry.tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
    let score = 0
    for (const term of terms) {
      const df = docFreq.get(term) ?? 0
      if (!df) continue
      const idf = Math.log(1 + (INDEX.length - df + 0.5) / (df + 0.5))
      const freq = tf.get(term) ?? 0
      score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (len / avgLen))))
    }
    if (score > 0) scores.set(entry, score)
  }
  return scores
}

/** Cosine similarity of TF-IDF vectors, as the service's tfidf.py does. */
function tfidfScores(query: string): Map<IndexedSegment, number> {
  const terms = tokenize(query)
  const scores = new Map<IndexedSegment, number>()
  if (!terms.length) return scores
  const docFreq = new Map<string, number>()
  for (const term of new Set(terms)) {
    docFreq.set(term, INDEX.filter((entry) => entry.tokens.includes(term)).length)
  }
  const idf = (term: string): number => {
    const df = docFreq.get(term) ?? 0
    return Math.log((INDEX.length + 1) / (df + 1)) + 1
  }
  const queryTf = new Map<string, number>()
  for (const term of terms) queryTf.set(term, (queryTf.get(term) ?? 0) + 1)
  const queryVector = new Map<string, number>()
  let queryNorm = 0
  for (const [term, freq] of queryTf) {
    const weight = (1 + Math.log(freq)) * idf(term)
    queryVector.set(term, weight)
    queryNorm += weight * weight
  }
  queryNorm = Math.sqrt(queryNorm)
  for (const entry of INDEX) {
    const tf = new Map<string, number>()
    for (const token of entry.tokens) tf.set(token, (tf.get(token) ?? 0) + 1)
    let dot = 0
    let norm = 0
    for (const [token, freq] of tf) {
      const weight = (1 + Math.log(freq)) * (docFreq.has(token) ? idf(token) : Math.log((INDEX.length + 1) / 1) + 1)
      tf.set(token, weight)
      norm += weight * weight
    }
    for (const [term, weight] of queryVector) dot += weight * (tf.get(term) ?? 0)
    norm = Math.sqrt(norm)
    if (dot > 0 && norm > 0) scores.set(entry, dot / (norm * queryNorm))
  }
  return scores
}

/**
 * SBERT stand-in: cosine over hashed character-trigram embeddings, L2
 * normalized. It captures shared morphology (which lexical scoring misses)
 * without a model, and is only ever a demo approximation — the label says so.
 */
function sbertScores(query: string): Map<IndexedSegment, number> {
  const trigrams = (text: string): string[] => {
    const padded = `  ${text.toLowerCase()}  `
    const grams: string[] = []
    for (let i = 0; i < padded.length - 2; i++) grams.push(padded.slice(i, i + 3))
    return grams
  }
  const BUCKETS = 512
  const embed = (text: string): Map<number, number> => {
    const vector = new Map<number, number>()
    for (const gram of trigrams(text)) {
      let hash = 2166136261
      for (let i = 0; i < gram.length; i++) {
        hash ^= gram.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
      }
      const bucket = Math.abs(hash) % BUCKETS
      vector.set(bucket, (vector.get(bucket) ?? 0) + 1)
    }
    let norm = 0
    for (const value of vector.values()) norm += value * value
    norm = Math.sqrt(norm)
    for (const [bucket, value] of vector) vector.set(bucket, value / norm)
    return vector
  }
  const queryVector = embed(query)
  const scores = new Map<IndexedSegment, number>()
  if (!query.trim()) return scores
  for (const entry of INDEX) {
    const vector = embed(`${entry.doc.title} ${entry.segment.text}`)
    let dot = 0
    for (const [bucket, value] of queryVector) dot += value * (vector.get(bucket) ?? 0)
    if (dot > 0) scores.set(entry, dot)
  }
  return scores
}

function normalise(scores: Map<IndexedSegment, number>): Map<IndexedSegment, number> {
  let max = 0
  for (const value of scores.values()) max = Math.max(max, value)
  if (max > 0) for (const [entry, value] of scores) scores.set(entry, value / max)
  return scores
}

/** Stand-in for the retrieval endpoint. Mirrors what a server would return:
 * ranked IR results plus the document relations, so a host can build a
 * document-relation graph out of one search. A document's score is its best
 * provision's score, and its provisions arrive ranked under it. */
export async function search(payload: { query?: string; method?: string }): Promise<{
  query: string
  method: string
  receivedAt: string
  results: IRResult[]
  relations: DemoRelation[]
}> {
  await delay(200)
  const query = payload?.query ?? ''
  const method = payload?.method ?? 'bm25'

  // Every doc, no query: a flat ranking so the view still has something to show.
  const segmentScores =
    !query.trim()
      ? new Map(INDEX.map((entry) => [entry, 0.5]))
      : normalise(
          method === 'tfidf' ? tfidfScores(query) : method === 'sbert' ? sbertScores(query) : bm25Scores(query),
        )

  const byDoc = new Map<string, { doc: DemoDocument; segments: { id: string; text: string; score: number }[] }>()
  for (const [entry, score] of segmentScores) {
    const bucket = byDoc.get(entry.doc.id) ?? { doc: entry.doc, segments: [] }
    bucket.segments.push({ id: entry.segment.id, text: entry.segment.text, score })
    byDoc.set(entry.doc.id, bucket)
  }

  const ranked = Array.from(byDoc.values())
    .map(({ doc, segments }) => {
      segments.sort((a, b) => b.score - a.score)
      return { doc, segments }
    })
    .filter(({ segments }) => segments.length > 0)
    .sort((a, b) => b.segments[0].score - a.segments[0].score)

  const results: IRResult[] = ranked.map(({ doc, segments }, index) => {
    const top = segments[0]
    const snippet = top?.text ?? doc.segments[0]?.text ?? ''
    return {
      id: doc.id,
      title: doc.title,
      score: top?.score ?? 0,
      snippet,
      highlights: termRangesIn(snippet, query),
      rank: index + 1,
      segments,
      metadata: { date: doc.date, instance: doc.instance },
    }
  })

  const ids = new Set(results.map((r) => r.id))
  return {
    query,
    method,
    receivedAt: new ISO(),
    results,
    relations: RELATIONS.filter((r) => ids.has(r.source) && ids.has(r.target)),
  }
}

/** The query's own words, at their positions in the snippet, as highlight ranges. */
function termRangesIn(text: string, query: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = []
  const lowered = text.toLowerCase()
  for (const term of tokenize(query)) {
    let from = 0
    for (;;) {
      const at = lowered.indexOf(term, from)
      if (at < 0) break
      ranges.push({ start: at, end: at + term.length })
      from = at + term.length
    }
  }
  return ranges
}

function ISO() {
  return new Date().toISOString()
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export const corpus = CORPUS
export const relations = RELATIONS
