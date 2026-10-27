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

const TERM_CORPUS: Record<string, string[]> = {
  verbrandingsoven: ['ECLI:NL:HR:2020:1176'],
  overeenkomst: ['ECLI:NL:HR:2021:214'],
  milieuzonering: ['ECLI:NL:RBDHA:2019:7543'],
  data: ['ECLI:EU:C:2022:44'],
  'data retention': ['ECLI:EU:C:2022:44'],
  zorgverzekering: ['ECLI:NL:RBMNE:2022:1189'],
}

/** Stand-in for the retrieval endpoint. Mirrors what a server would return:
 * ranked IR results plus the document relations, so a host can build a
 * document-relation graph out of one search. */
export async function search(payload: { query?: string }): Promise<{
  query: string
  receivedAt: string
  results: IRResult[]
  relations: DemoRelation[]
}> {
  await delay(200)
  const query = payload?.query ?? ''
  const q = query.toLowerCase()
  const matched = q
    ? CORPUS.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.segments.some((s) => s.text.toLowerCase().includes(q)) ||
          (TERM_CORPUS[q] ?? []).includes(d.id),
      )
    : CORPUS

  const results: IRResult[] = matched.map((doc, index) => {
    // A deterministic pseudo-score: term hits rank first.
    const hit = q && doc.title.toLowerCase().includes(q) ? 0.9 : 0.55 + index * 0.05
    const hitSegment = doc.segments.find((s) => s.text.toLowerCase().includes(q))
    const snippet = hitSegment?.text ?? doc.segments[0]?.text ?? ''
    const start = q && snippet.toLowerCase().includes(q) ? snippet.toLowerCase().indexOf(q) : -1
    return {
      id: doc.id,
      title: doc.title,
      score: hit,
      snippet,
      highlights: start >= 0 ? [{ start, end: start + q.length }] : [],
      rank: index + 1,
      segments: doc.segments.map((s) => ({ id: s.id, text: s.text, score: 0.3 })),
      metadata: { date: doc.date, instance: doc.instance },
    }
  })

  const ids = new Set(results.map((r) => r.id))
  return {
    query,
    receivedAt: new ISO(),
    results,
    relations: RELATIONS.filter((r) => ids.has(r.source) && ids.has(r.target)),
  }
}

function ISO() {
  return new Date().toISOString()
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export const corpus = CORPUS
export const relations = RELATIONS
