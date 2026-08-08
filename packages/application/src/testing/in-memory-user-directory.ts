import type { Cursor, Page } from '../ports/pagination'
import type { DirectoryUser, UserDirectory } from '../ports/user-directory'

export class InMemoryUserDirectory implements UserDirectory {
  readonly calls: Cursor[] = []

  constructor(private readonly users: readonly DirectoryUser[] = []) {}

  list(cursor: Cursor): Promise<Page<DirectoryUser>> {
    this.calls.push(cursor)
    return Promise.resolve({ items: this.users.slice(0, cursor.limit), nextCursor: null })
  }
}
