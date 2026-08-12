import { userId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { InMemoryUserDirectory } from '../testing/in-memory-user-directory'
import { ResolvePublicByline } from './resolve-public-byline'

const AUTHOR = userId('usr_author')

const directory = (name: string, email = 'editor@kurasikapa.tv'): InMemoryUserDirectory =>
  new InMemoryUserDirectory([{ id: AUTHOR, email, name, roles: ['editor'] }])

describe('ResolvePublicByline', () => {
  it('returns the directory display name', async () => {
    const name = await new ResolvePublicByline(directory('Ama Mensah')).execute({
      userId: AUTHOR,
    })

    expect(name).toBe('Ama Mensah')
  })

  it('returns null when the account is missing', async () => {
    expect(
      await new ResolvePublicByline(new InMemoryUserDirectory()).execute({ userId: AUTHOR }),
    ).toBeNull()
  })

  it('does not print an email as a byline', async () => {
    const name = await new ResolvePublicByline(directory('editor@kurasikapa.tv')).execute({
      userId: AUTHOR,
    })

    expect(name).toBeNull()
  })

  it('treats a blank name as missing', async () => {
    expect(await new ResolvePublicByline(directory('   ')).execute({ userId: AUTHOR })).toBeNull()
  })
})
