import type { CategoryId } from '../shared/ids'
import { Slug } from '../shared/slug'

export interface CategoryProps {
  readonly id: CategoryId
  readonly parentId: CategoryId | null
  /** Locale → slug. A category is reachable only in locales it has one for. */
  readonly slugs: Readonly<Record<string, string>>
  readonly names: Readonly<Record<string, string>>
  /**
   * Locale → standfirst shown under the section heading.
   *
   * Separate from `names` and independently translatable: a section can be
   * named in French long before someone writes its French description, and
   * showing an English paragraph under a French heading is worse than none.
   */
  readonly descriptions: Readonly<Record<string, string>>
  readonly order: number
}

export class LocaleNotCovered extends Error {
  constructor(
    readonly categoryId: CategoryId,
    readonly locale: string,
  ) {
    super(`Category ${categoryId} has no slug for locale "${locale}"`)
    this.name = 'LocaleNotCovered'
  }
}

/**
 * A section of the site.
 *
 * Slugs are per-locale for the same reason articles are: a French reader
 * should land on `/fr/rubriques/politique`, not on an English word. "Locale is
 * data" applies to navigation as much as to prose.
 *
 * A category with no slug in a locale is simply not reachable there — which is
 * how a section is rolled out to one language before another, without a flag.
 */
export class Category {
  private constructor(private readonly props: CategoryProps) {}

  static reconstitute(props: CategoryProps): Category {
    return new Category(props)
  }

  get id(): CategoryId { return this.props.id }
  get parentId(): CategoryId | null { return this.props.parentId }
  get order(): number { return this.props.order }

  isRootLevel(): boolean {
    return this.props.parentId === null
  }

  coversLocale(locale: string): boolean {
    return this.props.slugs[locale] !== undefined
  }

  slugIn(locale: string): Slug {
    const raw = this.props.slugs[locale]
    if (raw === undefined) throw new LocaleNotCovered(this.props.id, locale)

    return Slug.of(raw)
  }

  /**
   * The display name, falling back to any name it has.
   *
   * A missing translation shows the section in another language rather than an
   * empty heading — visibly imperfect beats invisibly broken, and it makes the
   * gap obvious to whoever can fix it.
   */
  nameIn(locale: string): string {
    return this.props.names[locale] ?? Object.values(this.props.names)[0] ?? ''
  }

  /**
   * The section standfirst, or null.
   *
   * Deliberately does NOT fall back to another locale, unlike `nameIn`. A
   * heading in the wrong language is a visible glitch someone will fix; a
   * whole paragraph in the wrong language reads as a broken translation.
   */
  descriptionIn(locale: string): string | null {
    return this.props.descriptions[locale] ?? null
  }

  snapshot(): CategoryProps {
    return this.props
  }
}
