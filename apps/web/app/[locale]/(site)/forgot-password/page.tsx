import type { Metadata } from 'next'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { PasswordHelpForm } from '@/components/auth/password-help-form'

export const metadata: Metadata = {
  title: 'Forgot password | Kurasikapa Media TV',
  description: 'Get help recovering access to your Kurasikapa account.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage(): React.ReactElement {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Let’s get you back in."
      intro="Tell our account team which email you use. We will help you regain access without ever asking for your current password."
      footnote={<>Remembered it? <Link href="/sign-in" className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">Return to sign in</Link></>}
    >
      <PasswordHelpForm />
    </AuthShell>
  )
}
