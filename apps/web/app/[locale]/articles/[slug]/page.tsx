import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Link } from '@/i18n/navigation'
import { env } from '@/composition/env'
import { cachedArticle } from '@/read-model/queries'
import { asScriptContent, newsArticleJsonLd } from '@/seo/json-ld'

interface Params {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const article = await cachedArticle(slug, locale)

  if (article === null) return { title: 'Not found', robots: { index: false } }

  return {
    title: article.title,
    alternates: { canonical: `/${locale}/articles/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      locale,
      ...(article.publishedAt !== null ? { publishedTime: article.publishedAt } : {}),
    },
  }
}

/**
 * NOT partially prerendered, deliberately.
 *
 * A missing article must answer 404, and a status cannot be changed once the
 * prerendered shell has flushed — under PPR the boundary resolves after the
 * headers are already sent, so `notFound()` produced a 200 with not-found
 * markup. That is a soft 404: crawlers index it, and for a news site whose
 * whole SEO story is section 17 of the questionnaire, that is a real defect.
 *
 * `connection()` defers the render to request time, so the existence check
 * happens before the first byte. The cost is the prerendered shell on this
 * route; the alternative is lying to Google about what exists.
 */
/**
 * A missing article renders the not-found UI with HTTP 200, not 404.
 *
 * Not a choice we would make freely. Under Cache Components the prerendered
 * shell flushes before the Suspense child can call `notFound()`, and the
 * status is already sent. The two escapes both fail: `connection()` does not
 * stop the prerender pass, and `export const dynamic` is rejected outright as
 * incompatible with `cacheComponents`.
 *
 * The harm from a soft 404 is crawlers indexing "not found" pages, so that is
 * what we defend against directly: `generateMetadata` returns
 * `robots: { index: false }` when the article does not resolve, and the
 * sitemap never advertises a URL that is missing. Readers see the right page;
 * crawlers are told not to keep it.
 *
 * Revisit when Next offers a per-route prerender opt-out that coexists with
 * Cache Components. See docs/03-architecture.md § 5.
 */
export default function ArticlePage({ params }: Params): React.ReactElement {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <ArticleBody params={params} />
    </Suspense>
  )
}

function ArticleSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]" aria-hidden>
      <div className="bg-surface-container h-3 w-24 rounded-sm" />
      <div className="bg-surface-container mt-6 h-12 w-3/4 rounded-sm" />
    </div>
  )
}

async function ArticleBody({ params }: Params): Promise<React.ReactElement> {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const article = await cachedArticle(slug, locale)
  // The use case already refuses anything not published, so an unpublished
  // draft is indistinguishable from a missing one. That is deliberate: a 403
  // would confirm the article exists.
  if (article === null) notFound()

  const t = await getTranslations('article')

  const canonical = `${env().APP_URL}/${locale}/articles/${article.slug}`
  const jsonLd = newsArticleJsonLd(
    article,
    { name: 'Kurasikapa Media TV', url: env().APP_URL },
    canonical,
  )

  return (
    <article className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]">
      {/* Structured data for Google News and Discover. Escaped so a headline
          cannot close the script block — see seo/json-ld.ts. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: asScriptContent(jsonLd) }}
      />

      <div className="text-label-bold text-secondary mb-4 uppercase">
        {article.categoryId.replace(/^cat_/u, '')}
      </div>

      <h1 className="font-display text-on-surface max-w-3xl text-[length:var(--text-display-lg)] leading-[1.1] font-bold tracking-[-0.02em]">
        {article.title}
      </h1>

      {article.publishedAt !== null && (
        <p className="text-on-surface-variant mt-6 text-sm">
          {t('published')}{' '}
          <time dateTime={article.publishedAt}>
            {new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
              new Date(article.publishedAt),
            )}
          </time>
        </p>
      )}

      <hr className="border-outline-variant my-[var(--spacing-lg)]" />

      {/*
        Body rendering lands with the markdown editor in the CMS slice — the
        approved revision holds the prose, not a field on the article.
      */}

      <Link
        href="/"
        className="text-primary text-label-bold uppercase underline-offset-4 hover:underline"
      >
        {t('backToHome')}
      </Link>
    </article>
  )
}

