'use client'

import { useState } from 'react'
import { completeSecondFactor, enrolSecondFactor } from '../../lib/auth-client'

const FIELD =
  'border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface rounded border px-3 py-2 outline-none transition-colors'

const FAILED_ENABLE = 'Could not start two-factor. Check your password.'
const FAILED_CODE = 'That code was not accepted.'

/**
 * Enable / verify TOTP on the signed-in account. The otpauth URI is shown as
 * text rather than a QR library — a new dependency for a barcode is not worth
 * the supply-chain review on an optional newsroom control.
 */
export function TwoFactorSettings(): React.ReactElement {
  const [password, setPassword] = useState('')
  const [totpURI, setTotpURI] = useState<string | null>(null)
  const [backup, setBackup] = useState<readonly string[]>([])
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-label-bold text-on-surface-variant uppercase">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
          }}
          autoComplete="current-password"
          className={FIELD}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          void enableTwoFactor(password, setTotpURI, setBackup, setMessage)
        }}
        className="bg-primary text-on-primary text-label-bold rounded px-3 py-2 uppercase"
      >
        Enable two-factor
      </button>
      {totpURI !== null && (
        <Setup totpURI={totpURI} backup={backup} code={code} onCode={setCode} onVerify={() => confirmTotp(code, setMessage)} />
      )}
      {message !== null && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  )
}

async function enableTwoFactor(
  password: string,
  setTotpURI: (uri: string) => void,
  setBackup: (codes: readonly string[]) => void,
  setMessage: (message: string | null) => void,
): Promise<void> {
  setMessage(null)

  const enrolled = await enrolSecondFactor(password)
  if (enrolled === null) {
    setMessage(FAILED_ENABLE)

    return
  }

  // The factor is live from here. The recovery codes are returned once and
  // never again — only their hashes are stored — so showing them IS the
  // safety net for someone who closes the page before scanning the QR.
  setTotpURI(enrolled.provisioningUri)
  setBackup(enrolled.recoveryCodes)
}

/**
 * Confirms the authenticator was set up correctly. NOT a gate — enrolment
 * already happened — so a wrong code here costs nothing but a retry, and the
 * recovery codes above remain the way back in either way.
 */
async function confirmTotp(code: string, setMessage: (message: string | null) => void): Promise<void> {
  setMessage(null)
  setMessage(
    (await completeSecondFactor('', code))
      ? 'Two-factor authentication is on.'
      : FAILED_CODE,
  )
}

function Setup({
  totpURI,
  backup,
  code,
  onCode,
  onVerify,
}: {
  totpURI: string
  backup: readonly string[]
  code: string
  onCode: (value: string) => void
  onVerify: () => Promise<void>
}): React.ReactElement {
  return (
    <>
      <p className="text-on-surface-variant text-sm">
        Add this URI in your authenticator, then enter a code to finish.
      </p>
      <code className="bg-surface-container block overflow-x-auto p-2 text-xs break-all">{totpURI}</code>
      {backup.length > 0 && (
        <p className="text-sm">
          Backup codes: {backup.join(' · ')}. Store these somewhere that is not this page.
        </p>
      )}
      <input
        value={code}
        onChange={(e) => {
          onCode(e.target.value)
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        className={FIELD}
      />
      <button
        type="button"
        onClick={() => {
          void onVerify()
        }}
        className="border-outline-variant text-label-bold rounded border px-3 py-2 uppercase"
      >
        Confirm code
      </button>
    </>
  )
}
