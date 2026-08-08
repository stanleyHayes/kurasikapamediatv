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
 * The slug is only known at request time, so the article body cannot be part
 * of the prerendered shell. Wrapping it in Suspense lets the chrome ship from
 * the edge immediately while the article streams in behind it — which is the
 * whole point of Partial Prerendering on a news site.
 */
export default function ArticlePage({ params }: Params): React.ReactElement {
  // `params` is deliberately NOT awaited here. `slug` is request data, and
  // awaiting it in the page body would block the prerendered shell — the exact
  // thing Partial Prerendering exists to avoid. The promise is handed to the
  // Suspense child, which is allowed to block.
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <ArticleBody params={params} />
    </Suspense>
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
    <article className="py-[var(--spacing-lg)]">
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

function ArticleSkeleton(): React.ReactElement {
  return (
    <div className="py-[var(--spacing-lg)]" aria-hidden>
      <div className="bg-surface-container h-3 w-24 rounded-sm" />
      <div className="bg-surface-container mt-6 h-12 w-3/4 rounded-sm" />
      <div className="bg-surface-container mt-4 h-12 w-1/2 rounded-sm" />
    </div>
  )
}
