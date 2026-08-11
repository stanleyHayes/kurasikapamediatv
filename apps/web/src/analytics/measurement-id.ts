/** GA4 ids are `G-` plus alphanumerics. Anything else must not enter a script. */
export function isGaMeasurementId(value: string): boolean {
  return /^G-[A-Z0-9]+$/u.test(value)
}
