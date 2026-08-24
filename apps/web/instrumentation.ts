/**
 * Next requires this file per app; the wiring itself is shared, because the
 * site and the studio must boot-check identically. See
 * `web-kit/composition/instrumentation.ts`.
 */
export {
  registerApp as register,
  onRequestError,
} from '@kurasikapa/web-kit/composition/instrumentation'
