import { NotPermitted } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { RoleEditor } from '@/components/studio/role-editor'
import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await requireActor()

  const page = await container()
    .listUsers.execute({ actor })
    .catch((error: unknown) => {
      if (error instanceof NotPermitted) redirect(`/${locale}/studio`)
      throw error
    })

  return (
    <>
      <p className="text-on-surface-variant mb-[var(--spacing-sm)] text-sm">
        {page.items.length} people. Changes take effect on their next request — roles are read per
        request, never carried in a session.
      </p>

      <ul>
        {page.items.map((person) => (
          <RoleEditor
            key={person.id}
            isSelf={person.id === actor.id}
            person={{
              id: person.id,
              email: person.email,
              name: person.name,
              roles: [...person.roles],
            }}
          />
        ))}
      </ul>
    </>
  )
}
