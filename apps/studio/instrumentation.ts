/**
 * Next requires this file per app; the wiring itself is shared, because the
 * site and the studio must boot-check identically. It matters most here — the
 * studio owns the three cron routes, so an unset CRON_SECRET means scheduled
 * publication and RSS ingest silently never run while the CMS looks healthy.
 * See `web-kit/composition/instrumentation.ts`.
 */
export {
  registerApp as register,
  onRequestError,
} from '@kurasikapa/web-kit/composition/instrumentation'
