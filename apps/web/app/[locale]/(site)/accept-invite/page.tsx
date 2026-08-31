import { AcceptInvitationForm } from '@/components/auth/accept-invitation-form'
import { AuthShell } from '@/components/auth/auth-shell'

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }): Promise<React.ReactElement> {
  const { token = '' } = await searchParams
  return <AuthShell eyebrow="Studio invitation" title="Join the newsroom" intro="Choose your password to activate the roles assigned by your administrator.">
    {token === '' ? <p className="text-error">This invitation link is incomplete.</p> : <AcceptInvitationForm token={token} />}
  </AuthShell>
}
