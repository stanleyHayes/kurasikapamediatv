import { describe, expect, it } from 'vitest'
import {
  PASSWORD_RULES,
  PasswordContainsIdentity,
  PasswordTooLong,
  PasswordTooShort,
  assertAcceptablePassword,
} from './password-policy'

const ok = 'correct horse battery staple'

describe('password policy', () => {
  it('accepts a long passphrase with no symbols or digits at all', () => {
    // The point of dropping composition rules: this is a genuinely strong
    // password that the familiar "one uppercase, one digit" rule rejects.
    expect(() => assertAcceptablePassword(ok)).not.toThrow()
  })

  it('refuses anything under the length floor', () => {
    expect(() => assertAcceptablePassword('a'.repeat(PASSWORD_RULES.minLength - 1))).toThrow(
      PasswordTooShort,
    )
  })

  it('accepts exactly the floor', () => {
    expect(() => assertAcceptablePassword('a'.repeat(PASSWORD_RULES.minLength))).not.toThrow()
  })

  it('refuses anything over the ceiling', () => {
    // Not a security rule. Every password goes through a deliberately slow
    // hash, so unbounded input is a denial-of-service against our own CPU.
    expect(() => assertAcceptablePassword('a'.repeat(PASSWORD_RULES.maxLength + 1))).toThrow(
      PasswordTooLong,
    )
  })

  it('measures length in code points, not UTF-16 units', () => {
    // 12 emoji is 24 UTF-16 units. Counting units would accept a 6-emoji
    // password as if it were 12 characters long.
    const sixEmoji = '😀'.repeat(6)

    expect(() => assertAcceptablePassword(sixEmoji)).toThrow(PasswordTooShort)
    expect(() => assertAcceptablePassword('😀'.repeat(PASSWORD_RULES.minLength))).not.toThrow()
  })

  describe('identity in the password', () => {
    it('refuses a password containing the email local part', () => {
      expect(() => assertAcceptablePassword('kwameiskwame123', 'kwame')).toThrow(
        PasswordContainsIdentity,
      )
    })

    it('is case-insensitive about it', () => {
      expect(() => assertAcceptablePassword('myKWAMEpassword!', 'kwame')).toThrow(
        PasswordContainsIdentity,
      )
    })

    it('allows a password that merely shares some letters', () => {
      expect(() => assertAcceptablePassword('makeshift wardrobe', 'kwame')).not.toThrow()
    })

    it('skips the check when no local part is supplied', () => {
      // Password changes reach this without the address to hand; a check that
      // silently passes is better than one that silently compares to "".
      expect(() => assertAcceptablePassword(ok)).not.toThrow()
      expect(() => assertAcceptablePassword(ok, '')).not.toThrow()
    })

    it('checks length BEFORE identity, so the reader gets the fixable reason', () => {
      // Both rules are broken here. Telling someone their 4-character password
      // "must not contain your email" sends them to fix the wrong thing.
      expect(() => assertAcceptablePassword('kwame', 'kwame')).toThrow(PasswordTooShort)
    })
  })
})
