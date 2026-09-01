import type { Db } from 'mongodb'

interface SeedContext {
  readonly demoSeed: string
  readonly now: Date
  readonly inDays: (days: number) => Date
}

const pageBody = (entries: readonly Record<string, string>[]): string =>
  JSON.stringify({ version: 1, entries })

const SITE_PAGES = [
  { _id: 'faq:en', key: 'faq', locale: 'en', title: 'Frequently asked questions', lead: '', body: pageBody([
    { id: 'editorial-independence', title: 'How does Kurasikapa protect editorial independence?', summary: 'The newsroom separates editorial judgement from commercial influence.', body: 'Editors decide what is reported and how it is presented. Advertising and sponsored work are labelled clearly, and commercial partners do not approve newsroom coverage.' },
    { id: 'corrections', title: 'How can I request a correction?', summary: 'Send the article link and the specific fact you believe needs review.', body: 'Use the contact page to reach the editorial desk. The team reviews supporting evidence, updates confirmed errors transparently and records material corrections on the article.' },
    { id: 'languages', title: 'Which languages does Kurasikapa publish in?', summary: 'English and French editions are available at launch.', body: 'Each edition is edited independently rather than translated automatically. Additional Ghanaian-language editions can be introduced when the newsroom has the editors required to maintain them.' },
  ]) },
  { _id: 'help:en', key: 'help', locale: 'en', title: 'Help centre', lead: '', body: pageBody([
    { id: 'save-story', title: 'Save a story for later', summary: 'Keep important reporting in your private reading list.', body: 'Sign in, open any published article and use Save. You can return to saved reporting from your profile and remove an item whenever it is no longer useful.' },
    { id: 'newsletter', title: 'Manage newsletter updates', summary: 'Choose the language and cadence that suit you.', body: 'Join the reader dispatch from the newsletter page. Every message includes an unsubscribe link, and breaking alerts are sent separately from scheduled briefings.' },
    { id: 'account-access', title: 'Recover access to your account', summary: 'Use the secure password recovery flow from the sign-in page.', body: 'Request a recovery link using the email attached to your account. Links expire and can only be used once. Contact support if you no longer control that inbox.' },
  ]) },
  { _id: 'careers:en', key: 'careers', locale: 'en', title: 'Careers', lead: '', body: pageBody([
    { id: 'multimedia-producer', title: 'Multimedia producer', summary: 'Accra · Full time · Editorial production', body: 'Shape field reporting into clear video, audio and digital packages. The role needs strong news judgement, confident editing skills and a portfolio that shows how you tell complex stories simply.' },
    { id: 'audience-editor', title: 'Audience editor', summary: 'Accra or remote in Ghana · Full time', body: 'Help the newsroom understand how readers find, use and respond to its journalism. You will work across newsletters, social distribution, analytics and community feedback without chasing empty reach.' },
  ]) },
] as const

const PRESENTERS = [
  { _id: 'demo_presenter_ama', name: 'Ama Nyarko — Preview profile', slug: 'ama-nyarko-preview', locale: 'en', role: 'Host, The Civic Desk', biography: 'Client-preview biography for a weekly public-affairs presenter. Replace with the verified team member, portrait and approved biography before launch.', portraitAssetId: null, published: true, createdBy: 'usr_demo_author' },
  { _id: 'demo_presenter_kojo', name: 'Kojo Mensah — Preview profile', slug: 'kojo-mensah-preview', locale: 'en', role: 'Anchor, Evening Bulletin', biography: 'Client-preview biography for the evening news anchor. Replace with verified newsroom information before launch.', portraitAssetId: null, published: true, createdBy: 'usr_demo_author' },
  { _id: 'demo_presenter_adwoa', name: 'Adwoa Sarpong — Preview profile', slug: 'adwoa-sarpong-preview', locale: 'en', role: 'Host, Culture Exchange', biography: 'Client-preview biography for an arts and culture host. Replace with verified presenter details before launch.', portraitAssetId: null, published: true, createdBy: 'usr_demo_author' },
] as const

const PROGRAMMES = [
  { _id: 'demo_programme_civic', title: 'The Civic Desk', slug: 'the-civic-desk', locale: 'en', summary: 'A weekly examination of public decisions, essential services and the people responsible for delivering them.', category: 'Current affairs', presenterIds: ['demo_presenter_ama'], artworkAssetId: null, published: true, createdBy: 'usr_demo_author' },
  { _id: 'demo_programme_evening', title: 'Evening Bulletin', slug: 'evening-bulletin', locale: 'en', summary: 'The day’s verified headlines, field reports and concise context from Ghana and across West Africa.', category: 'News', presenterIds: ['demo_presenter_kojo'], artworkAssetId: null, published: true, createdBy: 'usr_demo_author' },
  { _id: 'demo_programme_culture', title: 'Culture Exchange', slug: 'culture-exchange', locale: 'en', summary: 'Conversations with artists, makers and cultural organisers about the work shaping contemporary Ghana.', category: 'Arts & culture', presenterIds: ['demo_presenter_adwoa'], artworkAssetId: null, published: true, createdBy: 'usr_demo_author' },
] as const

function scheduleSlots(inDays: SeedContext['inDays']): readonly Record<string, unknown>[] {
  return [
    { _id: 'demo_slot_evening', programmeId: 'demo_programme_evening', locale: 'en', startsAt: inDays(1), endsAt: inDays(1.04), isLive: true, state: 'scheduled', replayAssetId: null, captionAssetId: null, createdBy: 'usr_demo_author' },
    { _id: 'demo_slot_civic', programmeId: 'demo_programme_civic', locale: 'en', startsAt: inDays(2), endsAt: inDays(2.04), isLive: true, state: 'scheduled', replayAssetId: null, captionAssetId: null, createdBy: 'usr_demo_author' },
    { _id: 'demo_slot_culture', programmeId: 'demo_programme_culture', locale: 'en', startsAt: inDays(3), endsAt: inDays(3.04), isLive: false, state: 'scheduled', replayAssetId: null, captionAssetId: null, createdBy: 'usr_demo_author' },
  ]
}

async function seedSitePages(db: Db, context: SeedContext): Promise<void> {
  const pages = db.collection<Record<string, unknown> & { _id: string }>('site_pages')
  for (const page of SITE_PAGES) {
    const existing = await pages.findOne({ _id: page._id })
    if (existing !== null && existing['demoSeed'] !== context.demoSeed) continue
    await pages.replaceOne(
      { _id: page._id },
      { ...page, updatedAt: context.now, demoSeed: context.demoSeed },
      { upsert: true },
    )
  }
}

async function seedTelevision(db: Db, context: SeedContext): Promise<void> {
  const tagged = (records: readonly Record<string, unknown>[]): Record<string, unknown>[] =>
    records.map((record) => ({ ...record, demoSeed: context.demoSeed }))
  await db.collection('presenters').insertMany(tagged(PRESENTERS))
  await db.collection('programmes').insertMany(tagged(PROGRAMMES))
  await db.collection('schedule_slots').insertMany(tagged(scheduleSlots(context.inDays)))
}

export const MANAGED_PAGE_COUNT = SITE_PAGES.length
export const PRESENTER_COUNT = PRESENTERS.length
export const PROGRAMME_COUNT = PROGRAMMES.length
export const SCHEDULE_SLOT_COUNT = 3

export async function seedManagedContent(db: Db, context: SeedContext): Promise<void> {
  await seedSitePages(db, context)
  await seedTelevision(db, context)
}
