/** Join a base URL and a path without doubling the slash. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/u, '')}${path}`
}
