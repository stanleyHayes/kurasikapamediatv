import { MongoClient } from 'mongodb'

const URI = process.env['MONGODB_URI'] ?? 'mongodb://127.0.0.1:37017/kurasikapa?directConnection=true'
const DB = process.env['MONGODB_DB'] ?? 'kurasikapa'
const DEMO_SEED = 'kurasikapa-client-preview-v1'
const COLLECTIONS = ['articles', 'article_revisions', 'categories', 'comments', 'site_pages', 'presenters', 'programmes', 'schedule_slots'] as const

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
