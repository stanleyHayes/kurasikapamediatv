import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * A Server Component may hold a REFERENCE to a client component, but it cannot
 * read a plain value out of a 'use client' module: on the server those exports
 * are opaque client references, and touching one throws
 *
 *   "Cannot access X.Y on the server. You cannot dot into a client module
 *    from a server component."
 *
 * The Studio events list did exactly that — it is a Server Component and it
 * read TYPE_LABELS[event.type] out of event-fields.tsx — and the whole page
 * crashed with "This screen failed to load". Nothing in typecheck, lint or the
 * build catches it, because it is only wrong at render time.
 */

const ROOT = join(import.meta.dirname, '../..')
const LOCAL_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'(?:\.\/|@\/components\/)([\w-]+)'/gu

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (path.endsWith('.tsx') && !path.endsWith('.test.tsx')) out.push(path)
  }

  return out
}

const isClientModule = (source: string): boolean => /^\s*('use client'|"use client")/u.test(source)

/** Lower-case is a function or value; an `export const` is one even SHOUTED. */
function crossesBoundary(name: string, clientSource: string): boolean {
  return !/^[A-Z]/u.test(name) || new RegExp(`export const ${name}\\b`, 'u').test(clientSource)
}

function offencesIn(path: string, clientModules: ReadonlyMap<string, string>): string[] {
  const source = readFileSync(path, 'utf8')
  if (isClientModule(source)) return []

  return [...source.matchAll(LOCAL_IMPORT)].flatMap((match) => {
    const clientSource = clientModules.get(match[2] ?? '')
    if (clientSource === undefined) return []

    return (match[1] ?? '').split(',')
      .map((raw) => raw.trim().replace(/^type\s+/u, ''))
      .filter((name) => name !== '' && crossesBoundary(name, clientSource))
      .map((name) => `${path.replace(ROOT, '')} imports ${name} from ${String(match[2])} ('use client')`)
  })
}

describe('server/client module boundary', () => {
  it('never reads a plain value out of a client module from a Server Component', () => {
    const files = [...sources(join(ROOT, 'src')), ...sources(join(ROOT, 'app'))]
    const clientModules = new Map(
      files.filter((path) => isClientModule(readFileSync(path, 'utf8')))
        .map((path) => [path.replace(/^.*\/([\w-]+)\.tsx$/u, '$1'), readFileSync(path, 'utf8')]),
    )

    expect(files.flatMap((path) => offencesIn(path, clientModules))).toEqual([])
  })
})
