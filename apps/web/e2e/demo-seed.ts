import { MongoClient } from 'mongodb'

/**
 * Demo content for a local run.
 *
 * Separate from e2e/seed.ts: the journeys need the minimum that proves a rule,
 * a demo needs enough for the design to be judged. Headlines are plausible
 * newsroom copy for Kurasikapa's stated remit — nothing here claims to be a
 * real story or a real person.
 */
const URI = process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:37017/kurasikapa?directConnection=true'
const DB = process.env['MONGODB_DB'] ?? 'kurasikapa'

const SECTIONS = [
  { _id: 'cat_business', parentId: null, slugs: { en: 'business', fr: 'economie' }, names: { en: 'Business', fr: 'Économie' }, order: 1 },
  { _id: 'cat_politics', parentId: null, slugs: { en: 'politics', fr: 'politique' }, names: { en: 'Politics', fr: 'Politique' }, order: 2 },
  { _id: 'cat_education', parentId: null, slugs: { en: 'education', fr: 'education' }, names: { en: 'Education', fr: 'Éducation' }, order: 3 },
]

interface Story {
  id: string
  locale: string
  slug: string
  title: string
  category: string
  daysAgo: number
  status?: string
}

const STORIES: Story[] = [
  { id: 'a1', locale: 'en', slug: 'budget-2026-what-changes-for-households', title: 'Budget 2026: What Changes for Households', category: 'cat_business', daysAgo: 0 },
  { id: 'a2', locale: 'en', slug: 'teacher-training-programme-doubles-intake', title: 'Teacher Training Programme Doubles Its Intake', category: 'cat_education', daysAgo: 1 },
  { id: 'a3', locale: 'en', slug: 'parliament-debates-media-freedom-bill', title: 'Parliament Debates the Media Freedom Bill', category: 'cat_politics', daysAgo: 2 },
  { id: 'a4', locale: 'en', slug: 'small-traders-count-the-cost-of-new-tariffs', title: 'Small Traders Count the Cost of New Tariffs', category: 'cat_business', daysAgo: 3 },
  { id: 'a5', locale: 'en', slug: 'diaspora-remittances-reach-a-five-year-high', title: 'Diaspora Remittances Reach a Five-Year High', category: 'cat_business', daysAgo: 5 },
  { id: 'a6', locale: 'fr', slug: 'budget-2026-ce-qui-change-pour-les-menages', title: 'Budget 2026 : ce qui change pour les ménages', category: 'cat_business', daysAgo: 0 },
  { id: 'a7', locale: 'fr', slug: 'le-parlement-debat-de-la-loi-sur-les-medias', title: 'Le Parlement débat de la loi sur les médias', category: 'cat_politics', daysAgo: 2 },
  { id: 'd1', locale: 'en', slug: 'unpublished-draft-not-for-readers', title: 'Draft — Not Visible To Readers', category: 'cat_politics', daysAgo: 0, status: 'draft' },
]

// A demo seed's whole point is "relative to right now", and a script has no
// port to inject. The directive must sit on the line directly above the code —
// a two-line comment above it applies to the comment, not the statement.
// eslint-disable-next-line no-restricted-properties
const at = (daysAgo: number): Date => new Date(Date.now() - daysAgo * 86_400_000)

/**
 * Demo prose.
 *
 * Deliberately generic and clearly placeholder in substance — this is seed
 * data for a demo environment, and inventing plausible-looking reporting
 * attributed to a real newsroom would be a liability the moment a screenshot
 * escapes. Length is realistic so the layout and the reading-time estimate
 * are exercised honestly.
 */
function bodyFor(story: Story): string {
  const lead =
    story.locale === 'fr'
      ? `Contenu de démonstration pour « ${story.title} ». Ce texte occupe la place de l'article réel afin de valider la mise en page.`
      : `Demonstration copy for "${story.title}". This text stands in for the real article so the layout can be reviewed.`

  const paragraph =
    story.locale === 'fr'
      ? "Chaque paragraphe provient de la révision approuvée de l'article, et non d'un champ de l'article lui-même. Une correction en cours de rédaction reste donc invisible pour le lecteur jusqu'à son approbation."
      : 'Each paragraph comes from the article\'s approved revision rather than a field on the article itself. A correction still being drafted therefore stays invisible to readers until it is approved.'

  const close =
    story.locale === 'fr'
      ? "Remplacez ce contenu par la copie éditoriale réelle avant toute démonstration publique."
      : 'Replace this content with real editorial copy before any public demonstration.'

  return [lead, paragraph, paragraph, close].join('\n\n')
}

async function main(): Promise<void> {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db(DB)

  await db.collection('articles').deleteMany({})
  await db.collection('article_revisions').deleteMany({})
  await db.collection('categories').deleteMany({})

  await db.collection('categories').insertMany(SECTIONS as never[])

  const articles = STORIES.map((s) => ({
    _id: s.id,
    familyId: `fam_${s.id}`,
    locale: s.locale,
    slug: s.slug,
    title: s.title,
    authorId: 'usr_demo_author',
    categoryId: s.category,
    tagIds: [],
    status: s.status ?? 'published',
    approvedRevisionId: `rev_${s.id}`,
    scheduledAt: null,
    publishedAt: s.status === undefined ? at(s.daysAgo) : null,
    updatedAt: at(s.daysAgo),
  }))

  // Every article claims an approvedRevisionId, so the revision it names has
  // to exist — the reader's body text comes from the approved revision, not
  // from a field on the article. Seeding one without the other left the demo
  // showing "no text yet" on every story.
  await db.collection('article_revisions').insertMany(
    STORIES.map((s) => ({
      _id: `rev_${s.id}`,
      articleId: s.id,
      seq: 1,
      title: s.title,
      body: bodyFor(s),
      authorId: 'usr_demo_author',
      createdAt: at(s.daysAgo),
    })) as never[],
  )

  await db.collection('articles').insertMany(articles as never[])
  await db.collection('articles').createIndex(
    { title: 'text', slug: 'text' },
    { name: 'article_text', weights: { title: 10, slug: 2 }, default_language: 'english' },
  )

  const published = articles.filter((a) => a.status === 'published').length
  console.error(`seeded ${String(published)} published, 1 draft, ${String(SECTIONS.length)} sections`)

  await client.close()
}

await main()
