// The `.ts` extension is required: Node runs this file directly (type
// stripping), and ESM resolution does not add extensions.
import { seed } from './seed.ts'

/**
 * Runs the journey fixtures BEFORE `next build`, not just in `beforeAll`.
 *
 * The homepage is prerendered at build time with whatever the database then
 * holds ('use cache' + cacheLife('hours')), and the direct-to-Mongo reseed in
 * `beforeAll` never fires the publish-time `updateTag` — so a suite that seeds
 * only after the build watches its first homepage hit render "Nothing
 * published yet" until the cache entry expires.
 */
await seed()
