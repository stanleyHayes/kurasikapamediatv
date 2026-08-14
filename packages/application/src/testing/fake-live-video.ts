import type {
  LiveVideoPort,
  ProvisionChannelInput,
  ProvisionedChannel,
} from '../ports/live-video'
import { LiveVideoUnavailable } from '../media/errors'

/**
 * A provider that hands back predictable channels and remembers every teardown.
 *
 * The recorded ARNs are what lets a test ask the question that matters: did the
 * channel we created actually get released, on the success path and on the
 * failure path?
 */
export class FakeLiveVideo implements LiveVideoPort {
  readonly provisioned: ProvisionChannelInput[] = []
  readonly tornDown: string[] = []

  /**
   * `teardownFails` models the awkward middle case — the channel was created,
   * and the call to release it did not land. A compensating teardown must not
   * replace the failure it was compensating for.
   */
  constructor(private readonly teardownFails = false) {}

  provision(input: ProvisionChannelInput): Promise<ProvisionedChannel> {
    this.provisioned.push(input)
    const n = String(this.provisioned.length)

    return Promise.resolve({
      channelArn: `arn:aws:ivs:eu-west-3:000000000000:channel/ch_${n}`,
      ingestEndpoint: `rtmps://ch${n}.global-contribute.live-video.net:443/app/`,
      streamKey: `sk_test_${n}`,
      playbackUrl: `https://ch${n}.eu-west-3.playback.live-video.net/v1/master.m3u8`,
    })
  }

  teardown(channelArn: string): Promise<void> {
    this.tornDown.push(channelArn)

    return this.teardownFails
      ? Promise.reject(new Error(`teardown refused for ${channelArn}`))
      : Promise.resolve()
  }
}

/**
 * What the composition root wires when AWS credentials are absent — the same
 * shape as FailClosedEmail, for the same reason.
 *
 * An unconfigured provider must refuse to start a broadcast. Returning a
 * plausible-looking channel instead would put a playback URL on the front page
 * pointing at nothing, and the newsroom would find out from the audience.
 */
export class FailClosedLiveVideo implements LiveVideoPort {
  provision(): Promise<ProvisionedChannel> {
    return Promise.reject(this.unconfigured())
  }

  teardown(): Promise<void> {
    return Promise.reject(this.unconfigured())
  }

  /**
   * `LiveVideoUnavailable`, exactly as the IVS adapter's `unconfigured()`
   * raises it — not a bare `Error`.
   *
   * A fake that throws a weaker type than production is a fake that agrees with
   * a bug: the studio's error plumbing maps this class to a named message and
   * rethrows everything else as a 500, so a suite built on a bare `Error` would
   * stay green while an operator on a fresh checkout read "Something went
   * wrong" instead of the variable to set.
   */
  private unconfigured(): LiveVideoUnavailable {
    return new LiveVideoUnavailable('Live video is not configured: AWS_ACCESS_KEY_ID is unset')
  }
}
