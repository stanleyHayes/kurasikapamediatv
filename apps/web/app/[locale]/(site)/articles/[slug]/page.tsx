import type { Metadata } from 'next'
import Image from 'next/image'
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
import { ArticleViewBeacon } from '@/analytics/article-view-beacon'
import { AdPlacement } from '@/components/advertising/ad-placement'
import { env } from '@kurasikapa/web-kit/composition/env'
import { cachedArticle, type ReadableArticle } from '@kurasikapa/web-kit/read-model/queries'
import { asScriptContent, newsArticleJsonLd } from '@/seo/json-ld'
import { loadStaffProfileByUser } from '@kurasikapa/web-kit/bff/staff-profiles'
import { ArticleNarrationPlayer } from '@/components/article/article-narration-player'

interface Params {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const article = await cachedArticle(slug, locale)

  if (article === null) return { title: 'Not found', robots: { index: false } }

  const social = socialCard(article)

  return {
    title: article.title,
    alternates: { canonical: `/${locale}/articles/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      locale,
      images: [social],
      ...(article.publishedAt !== null ? { publishedTime: article.publishedAt } : {}),
    },
    twitter: { card: 'summary_large_image', title: article.title, images: [social.url] },
  }
}

function socialCard(article: ReadableArticle): { url: string; width: number; height: number; alt: string } {
  if (article.hero === null) {
    return { url: `/og-image?title=${encodeURIComponent(article.title)}`, width: 1200, height: 630, alt: article.title }
  }
  return { url: article.hero.secureUrl, width: article.hero.width, height: article.hero.height, alt: article.hero.altText }
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

  const authorProfile = await loadStaffProfileByUser(locale, article.authorId)

  const canonical = `${env().APP_URL}/${locale}/articles/${article.slug}`
  const socialImage = article.hero?.secureUrl ?? `${env().APP_URL}/og-image?title=${encodeURIComponent(article.title)}`
  const jsonLd = newsArticleJsonLd(
    article,
    { name: 'Kurasikapa Media TV', url: env().APP_URL },
    canonical,
    { image: socialImage, ...(authorProfile === null ? {} : { authorUrl: `${env().APP_URL}/${locale}/team/${authorProfile.slug}` }) },
  )

  return (
    <article className="pb-20">
      <ArticleViewBeacon articleId={article.id} locale={locale} />
      {/* Structured data for Google News and Discover. Escaped so a headline
          cannot close the script block — see seo/json-ld.ts. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: asScriptContent(jsonLd) }}
      />

      <ArticleHeader article={article} author={authorProfile} />
      {article.hero !== null && <ArticleHero hero={article.hero} />}
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

function ArticleHero({ hero }: { hero: NonNullable<ReadableArticle['hero']> }): React.ReactElement {
  return <figure className="mx-auto max-w-[var(--container-page)] border-x-2 border-on-surface bg-inverse-surface"><div className="relative aspect-[16/9] overflow-hidden"><Image src={hero.secureUrl} alt={hero.altText} fill priority sizes="(min-width:1280px) 1200px, 100vw" className="object-cover" /></div><figcaption className="flex flex-wrap justify-between gap-2 border-t border-white/20 px-4 py-3 text-xs text-white/75 md:px-8"><span>{hero.caption}</span><strong className="text-white">{hero.credit}</strong></figcaption></figure>
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
      {article.narration !== null && <ArticleNarrationPlayer narration={article.narration} />}
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
      <div id="article-transcript"><ArticleBody body={article.body} /></div>
      <Suspense fallback={null}><AdPlacement locale={locale} slot="article_inline" /></Suspense>
    </div>
  )
}
