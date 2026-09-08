/**
 * Remove the client-preview demo content from a live database.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  WHY THIS EXISTS INSTEAD OF `pnpm clear:demo`
 *
 *  apps/web/e2e/demo-clear.ts lists 'categories' in its COLLECTIONS array and
 *  deletes every document carrying the demoSeed tag. demo-seed.ts tagged
 *  ELEVEN REAL NAVIGATION CATEGORIES — cat_business, cat_politics,
 *  cat_education, cat_culture, cat_sports, cat_technology, cat_health,
 *  cat_entertainment, cat_lifestyle, cat_opinion, cat_editorial — and the
 *  later production navigation seed used an upsert (`$set`), which PRESERVED
 *  that field rather than clearing it.
 *
 *  So `pnpm clear:demo` against production would delete the site's taxonomy
 *  and 404 eleven section pages. This script strips the tag off categories
 *  instead of deleting them, which also disarms that trap permanently.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * What it will NEVER touch, per product rule 4 (append-only):
 *   audit_entries, page_views, article_engagements.
 * Orphaned audit rows pointing at deleted demo articles are CORRECT. The
 * record that a thing was published does not stop being true because the
 * thing was removed.
 *
 * Usage — surveys by default, changes nothing without --confirm:
 *
 *   MONGODB_URI="mongodb+srv://…" MONGODB_DB="kurasikapa" \
 *     node scripts/purge-demo-content.ts
 *
 *   … read the report, then re-run with --confirm to apply.
 */

import { MongoClient, type Db, type Filter } from 'mongodb'

/**
 * Ids in this database are application-generated strings ('demo_a1'), not
 * ObjectIds. Without this the driver types `_id` as ObjectId and every
 * `$regex` filter below fails to compile. Same shape demo-clear.ts uses.
 */
type Row = Record<string, unknown> & { _id: string }

const TAG = 'kurasikapa-client-preview-v1'
const APPLY = process.argv.includes('--confirm')

/** Demo editorial content. Safe to remove — none of it is real reporting. */
const PURGE: readonly { collection: string; filter: Filter<Row> }[] = [
  { collection: 'articles', filter: { $or: [{ demoSeed: TAG }, { _id: { $regex: '^demo_' } }] } },
  { collection: 'article_revisions', filter: { $or: [{ demoSeed: TAG }, { _id: { $regex: '^demo_rev_' } }] } },
  { collection: 'comments', filter: { $or: [{ demoSeed: TAG }, { _id: { $regex: '^demo_c' } }] } },
]

/** Rows keyed to a demo article that nothing else will ever clean up. */
const ORPHANS: readonly { collection: string; filter: Filter<Row> }[] = [
  { collection: 'bookmarks', filter: { articleId: { $regex: '^demo_' } } },
  { collection: 'likes', filter: { articleId: { $regex: '^demo_' } } },
  { collection: 'readings', filter: { articleId: { $regex: '^demo_' } } },
  { collection: 'social_posts', filter: { articleId: { $regex: '^demo_' } } },
  { collection: 'article_semantic_documents', filter: { _id: { $regex: '^demo_' } } },
]

function required(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} is required. Refusing to guess.`)

  return value
}

/** Rows that are neither demo- nor e2e-prefixed: real reporting, or RSS drafts. */
async function countReal(db: Db): Promise<number> {
  return db.collection<Row>('articles').countDocuments({ _id: { $not: /^(demo_|e2e_)/u } })
}

async function purge(db: Db): Promise<number> {
  let removed = 0

  for (const { collection, filter } of [...PURGE, ...ORPHANS]) {
    const rows = db.collection<Row>(collection)
    const count = await rows.countDocuments(filter)
    if (APPLY && count > 0) await rows.deleteMany(filter)
    removed += count
    console.log(`${APPLY ? 'deleted' : 'would delete'} ${String(count).padStart(4)}  ${collection}`)
  }

  return removed
}

/**
 * The trap, disarmed. Untag rather than delete — the taxonomy is real, and an
 * untagged category can never be caught by a tag-based delete again.
 */
async function untagCategories(db: Db): Promise<number> {
  const categories = db.collection<Row>('categories')
  const tagged = await categories.countDocuments({ demoSeed: TAG })
  if (APPLY && tagged > 0) await categories.updateMany({ demoSeed: TAG }, { $unset: { demoSeed: '' } })
  console.log(`${APPLY ? 'untagged' : 'would untag'} ${String(tagged).padStart(4)}  categories  (KEPT — real navigation)`)

  return tagged
}

async function main(): Promise<void> {
  const client = new MongoClient(required('MONGODB_URI'), { serverSelectionTimeoutMS: 15_000 })

  try {
    const db = client.db(required('MONGODB_DB'))
    console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN — nothing will be changed ===')
    console.log(`database: ${db.databaseName}\n`)

    // Printed first, because "0 real articles" is what makes this safe and
    // "12 real articles" means stop and look before deleting anything.
    const real = await countReal(db)
    console.log(`articles NOT demo/e2e prefixed: ${String(real)}`)
    console.log(real > 0 ? '  ^ real or RSS-ingested rows exist. Untouched by this script.\n' : '')

    const removed = await purge(db)
    const tagged = await untagCategories(db)

    console.log(`\n${APPLY ? 'removed' : 'would remove'} ${String(removed)} demo records; ${String(tagged)} categories preserved.`)
    console.log('untouched by design: audit_entries, page_views, article_engagements (append-only).')
    if (!APPLY) console.log('\nRe-run with --confirm to apply.')
  } finally {
    await client.close()
  }
}

await main()
