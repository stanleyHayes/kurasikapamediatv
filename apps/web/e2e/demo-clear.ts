import { MongoClient } from 'mongodb'

const URI = process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:37017/kurasikapa?directConnection=true'
const DB = process.env['MONGODB_DB'] ?? 'kurasikapa'
const DEMO_SEED = 'kurasikapa-client-preview-v1'
/**
 * `categories` is NOT in this list, and must never be added back.
 *
 * demo-seed.ts tags eleven REAL navigation categories (cat_business,
 * cat_politics, cat_education, cat_culture, cat_sports, cat_technology,
 * cat_health, cat_entertainment, cat_lifestyle, cat_opinion, cat_editorial)
 * with demoSeed. The production navigation seed that came later used an
 * upsert, which PRESERVED that field rather than clearing it — so those rows
 * still carry the tag today.
 *
 * With 'categories' in this array, one `pnpm clear:demo` against production
 * deletes the site's taxonomy and 404s eleven section pages. Verified against
 * a fixture: it removed 11 of 14 categories.
 *
 * Use scripts/purge-demo-content.ts for a live database. It strips the tag off
 * categories instead of deleting them, which disarms this permanently, and it
 * also clears the bookmark/like/reading orphans this script leaves behind.
 */
const COLLECTIONS = ['articles', 'article_revisions', 'comments', 'site_pages', 'presenters', 'programmes', 'schedule_slots'] as const

if (!process.argv.includes('--confirm')) {
  throw new Error('Refusing to clear demo data without --confirm')
}

const client = new MongoClient(URI)
await client.connect()
const db = client.db(DB)

let removed = 0
for (const name of COLLECTIONS) {
  const collection = db.collection<Record<string, unknown> & { _id: string }>(name)
  const result = await collection.deleteMany({ demoSeed: DEMO_SEED })
  removed += result.deletedCount
  const prefixed = await collection.deleteMany({ _id: { $regex: '^demo_' } })
  removed += prefixed.deletedCount
}

console.error(`removed ${String(removed)} Kurasikapa client-preview records`)
await client.close()
