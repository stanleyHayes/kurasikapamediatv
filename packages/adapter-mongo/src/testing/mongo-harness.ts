import { MongoDBContainer, type StartedMongoDBContainer } from '@testcontainers/mongodb'
import { type Db, MongoClient } from 'mongodb'
import { ensureIndexes } from '../indexes'

export interface MongoHarness {
  readonly db: Db
  reset(): Promise<void>
  stop(): Promise<void>
}

/**
 * A real MongoDB, not a mocked driver.
 *
 * An adapter test against a mock proves only that the mock was configured to
 * agree with the code. The bugs live in the query, the index and the sort —
 * none of which a mock can be wrong about.
 *
 * The container runs a single-node replica set, which is what makes
 * transactions available. A standalone mongod passes most tests and then fails
 * on publish, which is the worst possible place to discover the difference.
 */
export async function startMongo(): Promise<MongoHarness> {
  // KURA_TEST_MONGO_URI runs the suite against an already-running MongoDB
  // instead of spawning a container per file — the escape hatch for a Docker
  // host too loaded to start containers (it must still be a replica set:
  // the transaction tests need one). Unset, nothing changes.
  const external = process.env['KURA_TEST_MONGO_URI']
  const container: StartedMongoDBContainer | undefined =
    external === undefined ? await new MongoDBContainer('mongo:8').start() : undefined
  const uri = external ?? container?.getConnectionString()
  if (uri === undefined) throw new Error('no MongoDB to connect to')
  const client = new MongoClient(uri, { directConnection: true })

  await client.connect()
  const db = client.db('kurasikapa_test')
  await ensureIndexes(db)

  return {
    db,
    async reset(): Promise<void> {
      const collections = await db.collections()
      await Promise.all(collections.map((c) => c.deleteMany({})))
    },
    async stop(): Promise<void> {
      await client.close()
      await container?.stop()
    },
  }
}
