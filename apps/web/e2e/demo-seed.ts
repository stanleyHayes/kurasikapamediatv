import { MongoClient, type Db } from 'mongodb'

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
  // Descriptions are per-locale and do NOT fall back — cat_education has only
  // an English one on purpose, so the French section exercises the null path.
  { _id: 'cat_business', parentId: null, slugs: { en: 'business', fr: 'economie' }, names: { en: 'Business', fr: 'Économie' }, descriptions: { en: 'Markets, trade and the money moving through West Africa and beyond.', fr: "Marchés, commerce et les capitaux qui traversent l'Afrique de l'Ouest." }, order: 1 },
  { _id: 'cat_politics', parentId: null, slugs: { en: 'politics', fr: 'politique' }, names: { en: 'Politics', fr: 'Politique' }, descriptions: { en: 'Power, policy and the people who wield both.', fr: 'Le pouvoir, les politiques publiques et ceux qui les exercent.' }, order: 2 },
  { _id: 'cat_education', parentId: null, slugs: { en: 'education', fr: 'education' }, names: { en: 'Education', fr: 'Éducation' }, descriptions: { en: 'Schools, training and the shape of the next generation.' }, order: 3 },
  { _id: 'cat_culture', parentId: null, slugs: { en: 'culture', fr: 'culture' }, names: { en: 'Culture', fr: 'Culture' }, descriptions: { en: 'Arts, festivals and the stories a country tells about itself.', fr: "Les arts, les festivals et les récits qu'un pays se raconte." }, order: 4 },
  { _id: 'cat_sports', parentId: null, slugs: { en: 'sports', fr: 'sports' }, names: { en: 'Sports', fr: 'Sports' }, descriptions: { en: 'Results, athletes and the business of the game.', fr: 'Résultats, athlètes et la face commerciale du sport.' }, order: 5 },
  { _id: 'cat_technology', parentId: null, slugs: { en: 'technology', fr: 'technologie' }, names: { en: 'Technology', fr: 'Technologie' }, descriptions: { en: 'Connectivity, startups and the tools changing daily life.', fr: 'Connectivité, startups et les outils qui changent le quotidien.' }, order: 6 },
  { _id: 'cat_health', parentId: null, slugs: { en: 'health', fr: 'sante' }, names: { en: 'Health', fr: 'Santé' }, descriptions: { en: 'Clinics, campaigns and the state of public health.', fr: 'Cliniques, campagnes et l’état de la santé publique.' }, order: 7 },
]

interface Story {
  id: string
  locale: string
  slug: string
  title: string
  category: string
  daysAgo: number
  /** Absent means published; the three non-public states appear once each so
   * the studio's queues have something in them and the reader never does. */
  status?: 'draft' | 'in_review' | 'scheduled'
  /** Only for status 'scheduled': days from now the story goes live. */
  inDays?: number
}

const STORIES: Story[] = [
  { id: 'a1', locale: 'en', slug: 'budget-2026-what-changes-for-households', title: 'Budget 2026: What Changes for Households', category: 'cat_business', daysAgo: 0 },
  { id: 'a2', locale: 'en', slug: 'teacher-training-programme-doubles-intake', title: 'Teacher Training Programme Doubles Its Intake', category: 'cat_education', daysAgo: 1 },
  { id: 'a3', locale: 'en', slug: 'parliament-debates-media-freedom-bill', title: 'Parliament Debates the Media Freedom Bill', category: 'cat_politics', daysAgo: 2 },
  { id: 'a4', locale: 'en', slug: 'small-traders-count-the-cost-of-new-tariffs', title: 'Small Traders Count the Cost of New Tariffs', category: 'cat_business', daysAgo: 3 },
  { id: 'a5', locale: 'en', slug: 'diaspora-remittances-reach-a-five-year-high', title: 'Diaspora Remittances Reach a Five-Year High', category: 'cat_business', daysAgo: 5 },
  { id: 'a8', locale: 'en', slug: 'national-theatre-announces-anniversary-season', title: 'National Theatre Announces Its Anniversary Season', category: 'cat_culture', daysAgo: 1 },
  { id: 'a9', locale: 'en', slug: 'athletics-team-returns-with-three-medals', title: 'Athletics Team Returns With Three Medals', category: 'cat_sports', daysAgo: 0 },
  { id: 'a10', locale: 'en', slug: 'startups-pilot-drone-deliveries-to-remote-clinics', title: 'Startups Pilot Drone Deliveries to Remote Clinics', category: 'cat_technology', daysAgo: 2 },
  { id: 'a11', locale: 'en', slug: 'vaccination-drive-reaches-half-its-target', title: 'Vaccination Drive Reaches Half Its Target in Two Weeks', category: 'cat_health', daysAgo: 4 },
  { id: 'a12', locale: 'en', slug: 'local-assemblies-publish-first-open-budgets', title: 'Local Assemblies Publish Their First Open Budgets', category: 'cat_politics', daysAgo: 6 },
  { id: 'a13', locale: 'en', slug: 'football-season-opens-with-a-derby-draw', title: 'Football Season Opens With a Derby Draw', category: 'cat_sports', daysAgo: 3 },
  { id: 'a14', locale: 'en', slug: 'street-art-festival-turns-old-harbour-into-gallery', title: 'Street Art Festival Turns the Old Harbour Into a Gallery', category: 'cat_culture', daysAgo: 7 },
  { id: 'a15', locale: 'en', slug: 'rural-broadband-connects-hundredth-village', title: 'Rural Broadband Project Connects Its Hundredth Village', category: 'cat_technology', daysAgo: 8 },
  { id: 'a16', locale: 'en', slug: 'midwife-training-scheme-expands-to-four-regions', title: 'Midwife Training Scheme Expands to Four Regions', category: 'cat_health', daysAgo: 9 },
  { id: 'a17', locale: 'en', slug: 'exam-results-show-narrowing-urban-rural-gap', title: 'Exam Results Show a Narrowing Urban–Rural Gap', category: 'cat_education', daysAgo: 10 },
  { id: 'a18', locale: 'en', slug: 'cocoa-prices-steady-after-volatile-quarter', title: 'Cocoa Prices Steady After a Volatile Quarter', category: 'cat_business', daysAgo: 12 },
  { id: 'a6', locale: 'fr', slug: 'budget-2026-ce-qui-change-pour-les-menages', title: 'Budget 2026 : ce qui change pour les ménages', category: 'cat_business', daysAgo: 0 },
  { id: 'a7', locale: 'fr', slug: 'le-parlement-debat-de-la-loi-sur-les-medias', title: 'Le Parlement débat de la loi sur les médias', category: 'cat_politics', daysAgo: 2 },
  { id: 'a19', locale: 'fr', slug: 'le-theatre-national-annonce-sa-saison-anniversaire', title: 'Le Théâtre national annonce sa saison anniversaire', category: 'cat_culture', daysAgo: 1 },
  { id: 'a20', locale: 'fr', slug: 'equipe-athletisme-revient-avec-trois-medailles', title: "L'équipe d'athlétisme revient avec trois médailles", category: 'cat_sports', daysAgo: 4 },
  { id: 'a21', locale: 'fr', slug: 'formation-des-enseignants-la-promotion-double', title: "Formation des enseignants : la promotion double d'effectif", category: 'cat_education', daysAgo: 6 },
  { id: 'a22', locale: 'fr', slug: 'la-vaccination-atteint-la-moitie-de-son-objectif', title: "La campagne de vaccination atteint la moitié de son objectif", category: 'cat_health', daysAgo: 8 },
  { id: 'a23', locale: 'fr', slug: 'le-haut-debit-rural-relie-son-centieme-village', title: 'Le haut débit rural relie son centième village', category: 'cat_technology', daysAgo: 11 },
  { id: 'd1', locale: 'en', slug: 'unpublished-draft-not-for-readers', title: 'Draft — Not Visible To Readers', category: 'cat_politics', daysAgo: 0, status: 'draft' },
  { id: 'r1', locale: 'en', slug: 'awaiting-an-editors-approval', title: "In Review — Awaiting an Editor's Approval", category: 'cat_business', daysAgo: 0, status: 'in_review' },
  { id: 's1', locale: 'en', slug: 'scheduled-goes-live-friday-morning', title: 'Scheduled — Goes Live on Friday Morning', category: 'cat_technology', daysAgo: 0, status: 'scheduled', inDays: 2 },
]

// A handful of visible comments on the lead story, so the discussion block on
// the article page has something to render. Reader ids are demo users; the
// byline resolver falls back honestly when a directory name is missing.
const COMMENTS = [
  { _id: 'c1', articleId: 'a1', readerId: 'usr_demo_reader_1', body: 'Demo comment — the household breakdown is the part I was looking for.', state: 'visible', hoursAgo: 5 },
  { _id: 'c2', articleId: 'a1', readerId: 'usr_demo_reader_2', body: 'Demo comment — would like to see the same analysis for small businesses.', state: 'visible', hoursAgo: 3 },
  { _id: 'c3', articleId: 'a1', readerId: 'usr_demo_reader_1', body: 'Demo comment — following up, the tariff story links well from here.', state: 'visible', hoursAgo: 1 },
]

// A demo seed's whole point is "relative to right now", and a script has no
// port to inject. The directive must sit on the line directly above the code —
// a two-line comment above it applies to the comment, not the statement.
// eslint-disable-next-line no-restricted-properties
const at = (daysAgo: number): Date => new Date(Date.now() - daysAgo * 86_400_000)
// eslint-disable-next-line no-restricted-properties
const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 3_600_000)
// eslint-disable-next-line no-restricted-properties
const inDays = (days: number): Date => new Date(Date.now() + days * 86_400_000)

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

async function seedStories(
  db: Db,
  articles: Record<string, unknown>[],
): Promise<void> {
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

  await db.collection('articles').insertMany(articles)
  await db.collection('articles').createIndex(
    { title: 'text', slug: 'text' },
    { name: 'article_text', weights: { title: 10, slug: 2 }, default_language: 'english' },
  )
}

async function seedComments(db: Db): Promise<void> {
  await db.collection('comments').insertMany(
    COMMENTS.map((c) => ({
      _id: c._id,
      articleId: c.articleId,
      readerId: c.readerId,
      body: c.body,
      state: c.state,
      createdAt: hoursAgo(c.hoursAgo),
    })) as never[],
  )
}

async function main(): Promise<void> {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db(DB)

  await db.collection('articles').deleteMany({})
  await db.collection('article_revisions').deleteMany({})
  await db.collection('categories').deleteMany({})
  await db.collection('comments').deleteMany({})

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
    scheduledAt: s.status === 'scheduled' ? inDays(s.inDays ?? 1) : null,
    publishedAt: s.status === undefined ? at(s.daysAgo) : null,
    updatedAt: at(s.daysAgo),
  }))

  await seedStories(db, articles)
  await seedComments(db)

  const published = articles.filter((a) => a.status === 'published').length
  console.error(
    `seeded ${String(published)} published, 1 draft, 1 in review, 1 scheduled, ` +
      `${String(SECTIONS.length)} sections, ${String(COMMENTS.length)} comments`,
  )

  await client.close()
}

await main()
