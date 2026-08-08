import { MongoClient } from 'mongodb'

/**
 * Local shapes, not the adapter's.
 *
 * The seed writes documents directly, so it needs the on-disk shape — but
 * importing `@kurasikapa/adapter-mongo` here would let a test reach past the
 * ports, which is the boundary the whole design rests on. Declaring the two
 * fields it touches is cheaper than an exception to that rule.
 */
interface SeedArticle {
  _id: string
  familyId: string
  locale: string
  slug: string
  title: string
  authorId: string
  categoryId: string
  tagIds: string[]
  status: string
  approvedRevisionId: string | null
  scheduledAt: Date | null
  publishedAt: Date | null
  updatedAt: Date
}

interface SeedCategory {
  _id: string
  parentId: string | null
  slugs: Record<string, string>
  names: Record<string, string>
  order: number
}

/**
 * Seeds the fixtures the public journeys read.
 *
 * Written directly to MongoDB rather than through the app: a journey that
 * depends on the CMS to create its own fixtures cannot tell "reading is
 * broken" apart from "writing is broken".
 */
const URI =
  process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:37017/kurasikapa_e2e?directConnection=true'
const DB = process.env['MONGODB_DB'] ?? 'kurasikapa_e2e'

export const PUBLISHED: SeedArticle = {
  _id: 'e2e_published',
  familyId: 'e2e_fam',
  locale: 'en',
  slug: 'budget-2026-explained',
  title: 'Budget 2026 Explained',
  authorId: 'e2e_author',
  categoryId: 'cat_business',
  tagIds: [],
  status: 'published',
  approvedRevisionId: 'e2e_rev',
  scheduledAt: null,
  publishedAt: new Date('2026-08-05T09:00:00Z'),
  updatedAt: new Date('2026-08-05T09:00:00Z'),
}

/** Present to prove a reader can never reach it. */
export const DRAFT: SeedArticle = {
  ...PUBLISHED,
  _id: 'e2e_draft',
  familyId: 'e2e_fam_draft',
  slug: 'secret-unpublished-scoop',
  title: 'Secret Unpublished Scoop',
  status: 'draft',
  publishedAt: null,
}

export const SECTION: SeedCategory = {
  _id: 'cat_business',
  parentId: null,
  slugs: { en: 'business', fr: 'economie' },
  names: { en: 'Business', fr: 'Économie' },
  order: 1,
}

export const EDITOR = {
  email: 'editor@kurasikapa.test',
  password: 'e2e-editor-password-9271',
  name: 'E2E Editor',
}

/**
 * Creates the editor through Better Auth's own sign-up endpoint rather than by
 * inserting a user document.
 *
 * Password hashing is the library's business. A hand-rolled row would either
 * hash it differently and never authenticate, or pin the test to an internal
 * format that is not ours to depend on.
 */
export async function seedEditor(baseUrl: string): Promise<void> {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db(DB)

  await db.collection('user').deleteMany({})
  await db.collection('account').deleteMany({})
  await db.collection('session').deleteMany({})
  await db.collection('role_assignments').deleteMany({})

  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    // Origin is required: Better Auth rejects originless requests with
    // MISSING_OR_NULL_ORIGIN, which is CSRF protection doing its job. The seed
    // presents one the way a browser would rather than disabling the guard.
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify(EDITOR),
  })

  // Report the body, not just the status. "sign-up failed: 422" sends the next
  // person to read the auth library's source; the body says which field.
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`sign-up failed (${String(response.status)}) at ${baseUrl}: ${body}`)
  }

  const created = await db
    .collection<{ _id: string; email: string }>('user')
    .findOne({ email: EDITOR.email })
  if (created === null) throw new Error('editor was not created')

  // Roles are ours, not the library's — see ADR-0004.
  await db
    .collection('role_assignments')
    .insertOne({ _id: created._id, roles: ['editor'] } as never)

  await client.close()
}

export async function seed(): Promise<void> {
  const client = new MongoClient(URI)
  await client.connect()
  const db = client.db(DB)

  await db.collection<SeedArticle>('articles').deleteMany({})
  await db.collection<SeedCategory>('categories').deleteMany({})
  await db.collection<SeedArticle>('articles').insertMany([PUBLISHED, DRAFT])
  await db.collection<SeedCategory>('categories').insertOne(SECTION)
  await db.collection<SeedArticle>('articles').createIndex(
    { title: 'text', slug: 'text' },
    { name: 'article_text', weights: { title: 10, slug: 2 }, default_language: 'english' },
  )

  await client.close()
}
