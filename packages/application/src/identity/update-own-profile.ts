import type { Actor } from '@kurasikapa/domain'
import type { UserDirectory } from '../ports/user-directory'
import type { UseCase } from '../ports/use-case'

export interface UpdateOwnProfileInput { readonly actor: Actor; readonly name: string }

export class UpdateOwnProfile implements UseCase<UpdateOwnProfileInput, void> {
  constructor(private readonly users: UserDirectory) {}

  async execute(input: UpdateOwnProfileInput): Promise<void> {
    const name = input.name.trim().replace(/\s+/gu, ' ')
    if (name.length < 2 || name.length > 80) throw new Error('Name must be between 2 and 80 characters.')
    await this.users.updateName(input.actor.id, name)
  }
}
