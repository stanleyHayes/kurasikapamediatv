/**
 * The "distinct byline treatment" the PRD promises Opinion and Editorial.
 *
 * docs/02-prd.md lists both pages on the same category template as the other
 * sections — the only difference it asks for is the byline. So the difference
 * lives here, in presentation, and nowhere else: no domain flag, no article
 * field, no extra template.
 *
 * The match is on category id, not name. Names are translated (an Éditorial
 * is still an editorial), slugs are per-locale; the id is the one value that
 * means the same thing in every locale and environment. Demo and E2E seeds
 * mint category ids as `cat_<en-slug>`, and this set is the whole contract —
 * add an id here and its articles render with the opinion byline.
 */
export const OPINION_CATEGORY_IDS: ReadonlySet<string> = new Set([
  'cat_opinion',
  'cat_editorial',
])

export const isOpinionArticle = (categoryId: string): boolean =>
  OPINION_CATEGORY_IDS.has(categoryId)

/**
 * The standing disclaimer an opinion byline carries. This is the sentence
 * that keeps an argued view from being read as the newsroom's reporting —
 * the entire point of the PRD's "distinct byline treatment".
 *
 * Hardcoded per locale, as the neighbouring components do; the message
 * catalogues are owned elsewhere.
 */
export const opinionDisclaimer = (locale: string): string =>
  locale === 'fr'
    ? "Les opinions exprimées sont celles de l'auteur et ne reflètent pas nécessairement la position éditoriale de Kurasikapa Media TV."
    : "The views expressed are the author's own and do not necessarily reflect the editorial position of Kurasikapa Media TV."
