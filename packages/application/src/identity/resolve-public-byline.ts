import type { UserId } from '@kurasikapa/domain'
import type { UseCase } from '../ports/use-case'
import type { UserDirectory } from '../ports/user-directory'

export interface ResolvePublicBylineInput {
  readonly userId: UserId
}

/**
 * Display name only. Email, roles and empty names stay off the article page —
 * a byline that reprints the login is a PII leak dressed as journalism.
 */
export const publicBylineName = (name: string): string | null => {
  const trimmed = name.trim()
  if (trimmed === '' || trimmed.includes('@')) return null
  return trimmed
}

export class ResolvePublicByline implements UseCase<ResolvePublicBylineInput, string | null> {
  constructor(private readonly users: UserDirectory) {}

  async execute(input: ResolvePublicBylineInput): Promise<string | null> {
    const user = await this.users.findById(input.userId)
    return user === null ? null : publicBylineName(user.name)
  }
}
