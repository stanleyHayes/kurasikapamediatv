'use client'

import { useFormStatus } from 'react-dom'

export function FormSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  readonly children: React.ReactNode
  readonly pendingLabel: string
  readonly className: string
}): React.ReactElement {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? pendingLabel : children}
        {pending && <LoadingDots />}
      </span>
    </button>
  )
}

function LoadingDots(): React.ReactElement {
  return (
    <span aria-hidden className="inline-flex items-end gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1 rounded-full bg-current motion-safe:animate-bounce"
          style={{ animationDelay: `${String(index * 120)}ms` }}
        />
      ))}
    </span>
  )
}
