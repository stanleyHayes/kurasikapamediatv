import type { UserId } from '@kurasikapa/domain'
import type { Cursor, Page } from '../ports/pagination'
import type { DirectoryUser, UserDirectory } from '../ports/user-directory'

export class InMemoryUserDirectory implements UserDirectory {
  readonly calls: Cursor[] = []

  constructor(private readonly users: DirectoryUser[] = []) {}

  create(user: Omit<DirectoryUser, 'roles'>): Promise<void> {
    this.users.push({ ...user, roles: [] })
    return Promise.resolve()
  }

  list(cursor: Cursor): Promise<Page<DirectoryUser>> {
    this.calls.push(cursor)
    return Promise.resolve({ items: this.users.slice(0, cursor.limit), nextCursor: null })
  }

  findById(id: UserId): Promise<DirectoryUser | null> {
    return Promise.resolve(this.users.find((row) => row.id === id) ?? null)
  }

  updateName(id: UserId, name: string): Promise<void> {
    const index = this.users.findIndex((row) => row.id === id)
    const current = this.users[index]
    if (current !== undefined) this.users[index] = { ...current, name }
    return Promise.resolve()
  }
}
