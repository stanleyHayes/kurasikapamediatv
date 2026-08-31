import { AnthropicAiAdapter, anthropicModels } from '@kurasikapa/adapter-anthropic'
import { failClosedIvs, IvsLiveVideo, ivsChannels } from '@kurasikapa/adapter-ivs'
import { MongoAuditLog } from '@kurasikapa/adapter-mongo'
import { InProcessEventBus, cryptoIds, systemClock } from './ambient'
import { buildContainer, type Container } from './build-container'
import { env } from './env'
import { mongoDb } from './mongo'
import { siteUrl } from './origins'
import { metaSocial, resendMailer, rssFetcher, webPush } from './outbound'
import { registerSubscribers } from './subscribers'

export { buildContainer, type Infrastructure, type Container } from './build-container'

let instance: Container | undefined

/** The production graph. Built once per process, reused across requests. */
export function container(): Container {
  if (instance !== undefined) return instance

  const events = new InProcessEventBus()
  const db = mongoDb()

  // Subscribers are registered against the same database the use cases write
  // to, before anything can emit. An event published before the audit
  // subscriber exists is an action that happened and was never recorded.
  registerSubscribers(events, new MongoAuditLog(db), cryptoIds)

  instance = buildContainer({
    db,
    clock: systemClock,
    ids: cryptoIds,
    events,
    ai: new AnthropicAiAdapter(anthropicModels()),
    social: metaSocial(),
    email: resendMailer(),
    push: webPush(),
    feed: rssFetcher(),
    /*
     * The PUBLIC site's origin, not this deployment's.
     *
     * This feeds reader-facing links — breaking-news push, newsletter digests,
     * social posts. On the studio deployment `APP_URL` is the CMS origin, so
     * reading it here mailed subscribers links to `studio.…/en/articles/slug`,
     * which is behind authentication and 404s for a reader. ADR-0011.
     */
    siteUrl: siteUrl(env()),
    live: liveVideo(env()),
  })

  return instance
}

function liveVideo(config: ReturnType<typeof env>): IvsLiveVideo {
  if (config.AWS_ACCESS_KEY_ID === undefined || config.AWS_SECRET_ACCESS_KEY === undefined) {
    return failClosedIvs()
  }
  if (config.AWS_REGION === undefined) return failClosedIvs()
  return new IvsLiveVideo({
		accessKeyId: config.AWS_ACCESS_KEY_ID,
		secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
		recordingConfigurationArn: config.AWS_IVS_RECORDING_CONFIGURATION_ARN,
    channels: ivsChannels(config.AWS_REGION),
  })
}

/** Test seam. */
export function resetContainer(): void {
  instance = undefined
}
