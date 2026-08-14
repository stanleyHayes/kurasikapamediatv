/**
 * Password hashing.
 *
 * A port because the algorithm and its cost parameters are an operational
 * decision that will be revisited — hardware gets faster, and a cost chosen in
 * 2026 is wrong by 2030. The domain must not know which algorithm won.
 *
 * `verify` takes the stored hash rather than returning one to compare, because
 * the comparison must be constant-time and the encoded hash carries its own
 * parameters. A caller doing `hash(plain) === stored` would both re-derive with
 * today's cost (failing for every older hash) and leak timing.
 */
export interface PasswordHasher {
  /**
   * Returns an encoded hash that carries its own salt and cost parameters, so
   * a future change of cost does not invalidate existing passwords.
   */
  hash(plain: string): Promise<string>

  /**
   * Constant-time verification.
   *
   * Must answer false rather than throwing for a malformed or unrecognised
   * stored hash: a corrupt row is a failed sign-in, not a 500 that tells an
   * attacker they found something interesting.
   */
  verify(plain: string, encoded: string): Promise<boolean>

  /**
   * Whether `encoded` was produced with parameters weaker than today's.
   *
   * Lets sign-in transparently upgrade a password's hash while it has the
   * plaintext in hand — the only moment it ever can. Without this, raising the
   * cost only ever protects accounts created after the change.
   */
  needsRehash(encoded: string): boolean
}
