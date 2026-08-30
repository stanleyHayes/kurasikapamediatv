import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ArticleBody } from '@/components/article/article-body'
import { CommentThread } from '@/components/article/comment-thread'
import { ArticleHeader } from '@/components/article/article-header'
import { ReadingPanel } from '@/components/article/reading-panel'
import { RelatedArticles } from '@/components/article/related-articles'
import { ShareButton } from '@/components/article/share-button'
import { LikeControl } from '@/components/article/like-control'
import { ReadingBeacon } from '@/components/article/reading-beacon'
import { SaveControl } from '@/components/article/save-control'
import { StoryBanner } from '@/components/story/story-banner'
import { ArticleSplash } from '@/components/article/article-splash'
import { env } from '@kurasikapa/web-kit/composition/env'
import { cachedArticle, type ReadableArticle } from '@kurasikapa/web-kit/read-model/queries'
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
      <Story params={params} />
    </Suspense>
  )
}

function ArticleSkeleton(): React.ReactElement {
  return <ArticleSplash />
}

async function Story({ params }: Params): Promise<React.ReactElement> {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const article = await cachedArticle(slug, locale)
  // The use case already refuses anything not published, so an unpublished
  // draft is indistinguishable from a missing one. That is deliberate: a 403
  // would confirm the article exists.
  if (article === null) notFound()

  const canonical = `${env().APP_URL}/${locale}/articles/${article.slug}`
  const jsonLd = newsArticleJsonLd(
    article,
    { name: 'Kurasikapa Media TV', url: env().APP_URL },
    canonical,
  )

  return (
    <article className="pb-20">
      {/* Structured data for Google News and Discover. Escaped so a headline
          cannot close the script block — see seo/json-ld.ts. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: asScriptContent(jsonLd) }}
      />

      <ArticleHeader article={article} />
      <div className="mx-auto max-w-[var(--container-page)] border-x-2 border-b-2 border-on-surface">
        <StoryBanner categoryId={article.categoryId} />
      </div>
      <div className="mx-auto max-w-[var(--container-page)] px-4 md:px-8">
        <div className="grid gap-12 py-14 lg:grid-cols-[15rem_minmax(0,46rem)] lg:justify-center lg:py-20">
          <ArticleRail article={article} />
          <StoryBody article={article} locale={locale} />
        </div>
        <div className="mx-auto max-w-5xl"><Suspense fallback={null}><RelatedArticles articleId={article.id} locale={locale} /></Suspense><Suspense fallback={null}><CommentThread articleId={article.id} /></Suspense></div>
      </div>
    </article>
  )
}

function ArticleRail({ article }: { article: ReadableArticle }): React.ReactElement {
  return (
    <aside className="h-fit border-t-2 border-on-surface pt-5 lg:sticky lg:top-28">
      <p className="text-[.65rem] font-bold uppercase tracking-[.2em] text-on-surface-variant">Reader tools</p>
      <div className="mt-5 flex flex-wrap items-start gap-3 lg:flex-col">
        <Suspense fallback={null}>
          <SaveControl articleId={article.id} />
        </Suspense>
        <Suspense fallback={null}>
          <LikeControl articleId={article.id} />
        </Suspense>
        <Suspense fallback={null}>
          <ReadingBeacon articleId={article.id} />
        </Suspense>
        <ShareButton title={article.title} />
      </div>
      <p className="mt-7 border-t border-outline-variant pt-5 text-sm leading-relaxed text-on-surface-variant">Save the story, respond to the reporting or share the original link.</p>
    </aside>
  )
}

function StoryBody({
  article,
  locale,
}: {
  article: ReadableArticle
  locale: string
}): React.ReactElement {
  return (
    <div className="article-prose">
      {article.body !== null && (
        <Suspense fallback={null}>
          <ReadingPanel
            articleId={article.id}
            title={article.title}
            body={article.body}
            locale={locale}
            slug={article.slug}
          />
        </Suspense>
      )}
      <ArticleBody body={article.body} />
    </div>
  )
}
