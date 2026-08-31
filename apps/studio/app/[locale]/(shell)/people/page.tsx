import { NotPermitted } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { type Metric, MetricCards } from '@/components/metric-cards'
import { MemberRow } from '@/components/member-row'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { CollectionView } from '@/components/collection-view'
import { InvitationPanel } from '@/components/invitation-panel'
import { StudioEmptyState } from '@/components/empty-state'
import { invitationGraph } from '@kurasikapa/web-kit/composition/invitation-graph'

interface Person {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly roles: readonly string[]
}

/**
 * The design's stats row reads Total Members / Active Super Admins / Pending
 * Invitations. The first two are derivable from the directory; invitations are
 * not — there is no invitation flow, so counting them would mean reporting
 * zero forever and calling it a feature. Replaced with the count that actually
 * matters on this screen: how many people hold no role at all.
 */
const metricsFor = (people: readonly Person[], pending: number): readonly Metric[] => [
  { label: 'People', value: people.length, icon: '☰' },
  {
    label: 'Can assign roles',
    value: people.filter((p) => p.roles.includes('super_admin')).length,
    icon: '◈',
    emphasis: true,
  },
  { label: 'Pending invitations', value: pending, icon: '○' },
]

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
      // The page refuses anyone without role:assign and sends them back. The
      // domain already refused; this is how the UI stops shouting about it.
      if (error instanceof NotPermitted) redirect(`/${locale}`)
      throw error
    })

  const people: Person[] = page.items.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    roles: [...p.roles],
  }))
  const invitations = (await invitationGraph().invitations.list()).map((item) => ({ ...item, invitedBy: String(item.invitedBy), createdAt: item.createdAt.toISOString(), expiresAt: item.expiresAt.toISOString() }))
  const pendingInvitations = invitations.filter((item) => item.state === 'pending')

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* The top bar names the section; repeating it here would announce
              the same heading twice. */}
          <p className="text-on-surface-variant text-sm">
            Changes take effect on their next request — roles are read per request, never carried in
            a session token.
          </p>
        </div>
      </header>

      <MetricCards metrics={metricsFor(people, pendingInvitations.length)} />

      <InvitationPanel invitations={invitations} />

      <MembersTable people={people} selfId={actor.id} />
    </div>
  )
}

function MembersTable({
  people,
  selfId,
}: {
  people: readonly Person[]
  selfId: string
}): React.ReactElement {
  return (
    <div className="overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest">
      <div className="text-label-bold hidden border-b border-outline-variant bg-inverse-surface px-6 py-3 text-white/65 uppercase md:grid md:grid-cols-12 md:gap-4">
        <span className="md:col-span-4">Member</span>
        <span className="md:col-span-8">Roles</span>
      </div>

      {people.length === 0 ? (
        <StudioEmptyState eyebrow="Team directory" icon="people" title="The newsroom directory is ready." description="Invite the first editor, reporter or producer and assign only the roles they need. New members will appear here after accepting their secure invitation." compact />
      ) : (
        <CollectionView noun="people" filters={['super_admin', 'editor', 'journalist', 'unassigned']} entries={people.map((person) => ({ id: person.id, search: `${person.name} ${person.email} ${person.roles.join(' ')}`, filter: person.roles[0] ?? 'unassigned', content: <MemberRow person={person} isSelf={person.id === selfId} /> }))} />
      )}
    </div>
  )
}
