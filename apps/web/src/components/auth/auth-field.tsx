'use client'

import { useId, useState } from 'react'

type AuthFieldIcon = 'email' | 'lock' | 'user'

interface AuthFieldProps {
  readonly label: string
  readonly name: string
  readonly type: 'email' | 'password' | 'text'
  readonly autoComplete: string
  readonly placeholder: string
  readonly icon: AuthFieldIcon
  readonly minLength?: number | undefined
}

export function AuthField(props: AuthFieldProps): React.ReactElement {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = props.type === 'password'
  const inputType = isPassword && revealed ? 'text' : props.type

  return (
    <label htmlFor={id} className="flex w-full flex-col gap-2">
      <span className="text-sm font-semibold text-on-surface">{props.label}</span>
      <span className="border-outline-variant bg-surface-container-lowest focus-within:border-primary focus-within:ring-primary/15 flex h-13 items-center rounded-xl border transition-[border-color,box-shadow] focus-within:ring-4">
        <FieldIcon name={props.icon} />
        <input
          id={id}
          type={inputType}
          name={props.name}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          required
          {...(props.minLength === undefined ? {} : { minLength: props.minLength })}
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-on-surface outline-none placeholder:text-on-surface-variant/55"
        />
        {isPassword && (
          <button
            type="button"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            onClick={() => {
              setRevealed((visible) => !visible)
            }}
            className="text-on-surface-variant hover:text-primary focus-visible:ring-primary mr-2 grid size-10 place-items-center rounded-lg outline-none transition-colors focus-visible:ring-2"
          >
            <EyeIcon crossed={revealed} />
          </button>
        )}
      </span>
    </label>
  )
}

function FieldIcon({ name }: { name: AuthFieldIcon }): React.ReactElement {
  const path = {
    email: <path d="m3 6 9 6 9-6M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />,
    lock: <path d="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" />,
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  }[name]

  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary-ink ml-4 mr-3 size-5 shrink-0">{path}</svg>
}

function EyeIcon({ crossed }: { crossed: boolean }): React.ReactElement {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {crossed && <path d="m4 4 16 16" />}
    </svg>
  )
}
