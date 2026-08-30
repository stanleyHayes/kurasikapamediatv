export interface LocalePaths {
  readonly en: string
  readonly fr: string
}

export function localizedHref(paths: LocalePaths, locale: string): string {
  return locale === 'fr' ? paths.fr : paths.en
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/news' && pathname.startsWith(`${href}/`))
}
