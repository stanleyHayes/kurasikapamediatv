import { describe, expect, it } from 'vitest'
import type { Env } from './env'
import { assertProductionReady, productionGaps } from './production-readiness'

/** A real deployment: APP_URL explicitly set to a public address. */
const PUBLIC = { rawAppUrl: 'https://kurasikapa.tv' }

const production = (overrides: Partial<Env> = {}): Env => ({
  MONGODB_URI: 'mongodb://localhost:27017/x',
  MONGODB_DB: 'kurasikapa',
  DEFAULT_LOCALE: 'en',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  APP_URL: 'https://kurasikapa.tv',
  LIVE_VIDEO_PROVIDER: 'ovenmedia',
  OVENMEDIA_KEY_LIFETIME_SECONDS: 900,
  OVENMEDIA_MAX_BROADCAST_SECONDS: 14_400,
  CRON_SECRET: 'c'.repeat(32),
  REVALIDATE_SECRET: 'r'.repeat(32),
  NODE_ENV: 'production',
  ...overrides,
})

describe('productionGaps', () => {
  it('finds nothing wrong with a fully configured production environment', () => {
    expect(productionGaps(production(), PUBLIC)).toEqual([])
  })

  it('says nothing outside production, where localhost and no crons are correct', () => {
    // The whole point of the development default is that it works unattended.
    const dev = production({ NODE_ENV: 'development', APP_URL: 'http://localhost:3000' })
    expect(productionGaps({ ...dev, CRON_SECRET: undefined, REVALIDATE_SECRET: undefined }, PUBLIC)).toEqual(
      [],
    )
  })

  it('stays quiet during the production BUILD, which has no secrets and serves nobody', () => {
    // `next build` sets NODE_ENV=production and prerenders against the
    // database with nothing else configured. Failing here would turn a
    // deployment-config gap into a red build, which is a different problem
    // reported in the wrong place.
    const gaps = productionGaps(
      production({ CRON_SECRET: undefined, REVALIDATE_SECRET: undefined }),
      { ...PUBLIC, phase: 'phase-production-build' },
    )
    expect(gaps).toEqual([])
  })

  it('catches a missing CRON_SECRET, which silently kills every schedule', () => {
    // Without it the cron routes 404 by design — so scheduled publication,
    // RSS ingest and both digests do nothing, and nothing says so.
    const gaps = productionGaps(production({ CRON_SECRET: undefined }), PUBLIC)
    expect(gaps.map((g) => g.key)).toContain('CRON_SECRET')
  })

  it('catches a missing REVALIDATE_SECRET, which strands the public cache', () => {
    const gaps = productionGaps(production({ REVALIDATE_SECRET: undefined }), PUBLIC)
    expect(gaps.map((g) => g.key)).toContain('REVALIDATE_SECRET')
  })

  it('catches an APP_URL nobody set, where the schema default is showing', () => {
    // Canonicals, OpenGraph, e-mail links and every cross-deployment redirect
    // are built from this. A deployment that kept the default emits a site
    // whose links point at whoever built it.
    for (const rawAppUrl of [undefined, '', '   ']) {
      const gaps = productionGaps(production({ APP_URL: 'http://localhost:3000' }), { rawAppUrl })
      expect(gaps.map((g) => g.key)).toEqual(['APP_URL'])
    }
  })

  it('stays quiet for a production server deliberately bound to loopback', () => {
    // The Playwright suite serves production builds of BOTH apps on 127.0.0.1,
    // because Cache Components, PPR and Server Action serialisation all behave
    // differently under `next dev`. That server reaches no reader, fires no
    // schedule and strands no cache. Demanding deployment secrets of it turned
    // the whole E2E gate red, which is how this case was found.
    const underTest = production({ CRON_SECRET: undefined, REVALIDATE_SECRET: undefined })
    expect(productionGaps(underTest, { rawAppUrl: 'http://127.0.0.1:31742' })).toEqual([])
  })

  it('supports independent hosts because each deployment owns its sign-in session', () => {
    // Vercel project domains have different registrable parents and cannot
    // share a cookie. Studio therefore signs in on its own host and issues the
    // same signed token into a host-scoped cookie backed by the shared store.
    const split = production({
      SITE_URL: 'https://kurasikapa.tv',
      STUDIO_URL: 'https://kurasikapa-studio.vercel.app/studio',
    })
    expect(productionGaps(split, PUBLIC)).toEqual([])
  })

  it('does not ask for COOKIE_DOMAIN when only the PORT differs', () => {
    // Cookies are scoped by host and ignore the port — which is why `pnpm dev`
    // signs an editor into :3000 and :3001 with nothing configured. Comparing
    // `host` instead of `hostname` here reported a split origin for every
    // local run, and a check that cries wolf is a check people switch off.
    const ports = production({
      SITE_URL: 'https://kurasikapa.tv:3002',
      STUDIO_URL: 'https://kurasikapa.tv:3001',
    })
    expect(productionGaps(ports, PUBLIC)).toEqual([])
  })

  it('does not ask for COOKIE_DOMAIN in the same-origin shape', () => {
    // The studio rewritten onto /studio of the public domain shares a host, so
    // a host-scoped cookie already reaches both. Widening it is the stricter
    // setting given away for nothing.
    const sameOrigin = production({
      SITE_URL: 'https://kurasikapa.tv',
      STUDIO_URL: 'https://kurasikapa.tv/studio',
    })
    expect(productionGaps(sameOrigin, PUBLIC)).toEqual([])
  })

  it('reports every gap at once, so one deploy closes them all', () => {
    const gaps = productionGaps(
      production({ CRON_SECRET: undefined, REVALIDATE_SECRET: undefined }),
      PUBLIC,
    )
    expect(gaps.map((g) => g.key).sort()).toEqual(['CRON_SECRET', 'REVALIDATE_SECRET'])
  })

  it('explains each gap, because a bare key name is not an instruction', () => {
    const [gap] = productionGaps(production({ CRON_SECRET: undefined }), PUBLIC)
    expect(gap?.why).toMatch(/schedule/iu)
  })
})

describe('assertProductionReady', () => {
  it('returns quietly when the environment is complete', () => {
    expect(() => {
      assertProductionReady(production(), PUBLIC)
    }).not.toThrow()
  })

  it('throws naming every missing key, not just the first', () => {
    expect(() => {
      assertProductionReady(
        production({ CRON_SECRET: undefined, REVALIDATE_SECRET: undefined }),
        PUBLIC,
      )
    }).toThrow(/CRON_SECRET[\s\S]*REVALIDATE_SECRET/u)
  })

  it('points at the file that documents the keys', () => {
    expect(() => {
      assertProductionReady(production({ CRON_SECRET: undefined }), PUBLIC)
    }).toThrow(/\.env\.example/u)
  })
})
