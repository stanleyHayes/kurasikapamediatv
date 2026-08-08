'use client'

import { useRouter } from '../../i18n/navigation'
import { signOut } from '../../lib/auth-client'

export function SignOutButton(): React.ReactElement {
  const router = useRouter()

  const leave = async (): Promise<void> => {
    await signOut()
    // refresh() as well as push(): the studio is server-rendered per request,
    // so without it the cached RSC payload would still show the signed-in view.
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={() => void leave()}
      className="text-label-bold text-on-surface-variant hover:text-primary uppercase transition-colors"
    >
      Sign out
    </button>
  )
}
