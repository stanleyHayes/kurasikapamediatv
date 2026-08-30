import { isAuthorisedCron } from '@kurasikapa/web-kit/composition/cron-auth'
import { env } from '@kurasikapa/web-kit/composition/env'
import { seedNavigationSections } from '@kurasikapa/web-kit/composition/seed-navigation-sections'

/** One-use, secret-protected taxonomy seed. Removed after production verification. */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request, env().TAXONOMY_SEED_SECRET)) {
    return new Response(null, { status: 404 })
  }

  const count = await seedNavigationSections()
  return Response.json({ seeded: count })
}
