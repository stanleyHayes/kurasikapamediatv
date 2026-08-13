import { type Db, MongoClient } from 'mongodb'
import { env } from './env'

/**
 * One MongoClient per process, reused across requests.
 *
 * Serverless invocations reuse the module scope between warm requests, so
 * creating a client per request would exhaust the connection pool under load.
 * The driver's own pooling is what we want; a new client per request defeats it.
 */
let client: MongoClient | undefined

export function mongoClient(): MongoClient {
  client ??= new MongoClient(env().MONGODB_URI, {
    // Fail fast rather than hanging a reader's request behind a dead primary.
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize: 10,
  })

  return client
}

export function mongoDb(): Db {
  return mongoClient().db(env().MONGODB_DB)
}

/** Test seam. Also used by the graceful-shutdown path. */
export async function closeMongo(): Promise<void> {
  await client?.close()
  client = undefined
}
