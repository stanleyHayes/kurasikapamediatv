import { describe, expect, it } from 'vitest'
import type { ArticleView } from '../read-model/article-view'
import { asScriptContent, newsArticleJsonLd, organisationJsonLd } from './json-ld'

const publisher = { name: 'Kurasikapa Media TV', url: 'https://kurasikapa.tv' }
const canonical = 'https://kurasikapa.tv/en/articles/budget-2026'

const article: ArticleView = {
  id: 'art_1',
  slug: 'budget-2026',
  locale: 'en',
  title: 'Budget 2026 Explained',
  categoryId: 'cat_business',
  publishedAt: '2026-08-08T10:00:00.000Z',
}

describe('newsArticleJsonLd', () => {
  it('declares NewsArticle, which is what Google News consumes', () => {
    // The generic Article type is not eligible for the news surfaces that are
    // the point of doing this for a media house.
    expect(newsArticleJsonLd(article, publisher, canonical)['@type']).toBe('NewsArticle')
  })

  it('carries the headline, language and canonical URL', () => {
    const json = newsArticleJsonLd(article, publisher, canonical)

    expect(json['headline']).toBe('Budget 2026 Explained')
    expect(json['inLanguage']).toBe('en')
    expect(json['url']).toBe(canonical)
  })

  it('states the publisher as a NewsMediaOrganization', () => {
    const json = newsArticleJsonLd(article, publisher, canonical)

    expect(json['publisher']).toMatchObject({ '@type': 'NewsMediaOrganization', name: publisher.name })
  })

  it('emits the publish date when the article is live', () => {
    expect(newsArticleJsonLd(article, publisher, canonical)['datePublished']).toBe(
      '2026-08-08T10:00:00.000Z',
    )
  })

  it('omits the date entirely rather than inventing one', () => {
    // A publish date on an unpublished article is a lie told to a crawler,
    // and crawlers act on it.
    const json = newsArticleJsonLd({ ...article, publishedAt: null }, publisher, canonical)

    expect(json).not.toHaveProperty('datePublished')
    expect(json).not.toHaveProperty('dateModified')
  })

  it('reflects the French locale on a translation', () => {
    const fr = newsArticleJsonLd({ ...article, locale: 'fr' }, publisher, canonical)

    expect(fr['inLanguage']).toBe('fr')
  })
})

describe('asScriptContent', () => {
  it('produces valid JSON', () => {
    const content = asScriptContent(newsArticleJsonLd(article, publisher, canonical))

    expect(JSON.parse(content.replace(/\\u003c/gu, '<'))).toMatchObject({ '@type': 'NewsArticle' })
  })

  it('escapes < so a headline cannot close the script block', () => {
    // A real XSS route on a site that accepts contributed copy: a headline
    // containing </script> would otherwise end the block and inject markup.
    const hostile = { ...article, title: 'Budget </script><img src=x onerror=alert(1)>' }

    const content = asScriptContent(newsArticleJsonLd(hostile, publisher, canonical))

    expect(content).not.toContain('</script>')
    expect(content).toContain('\\u003c')
  })
})

describe('organisationJsonLd', () => {
  it('describes the publisher for the site root', () => {
    expect(organisationJsonLd(publisher)).toMatchObject({
      '@type': 'NewsMediaOrganization',
      name: 'Kurasikapa Media TV',
    })
  })
})
