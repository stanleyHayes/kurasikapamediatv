/** Infrastructure routes are stable, locale-free URLs consumed by crawlers. */
export function isLocaleFreePath(pathname: string): boolean {
  return pathname === '/og-image'
}
