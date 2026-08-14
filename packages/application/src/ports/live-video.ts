export interface ProvisionChannelInput {
  /** A human label on the provider side, for the AWS console. Not an identifier. */
  readonly name: string
}

/** Everything a provider hands back for a channel it has just created. */
export interface ProvisionedChannel {
  /** Opaque provider handle. The only thing that can find this channel again to tear it down. */
  readonly channelArn: string
  /** Where the studio encoder points. An RTMPS host — it carries no credential of its own. */
  readonly ingestEndpoint: string
  /**
   * **SECRET. Treat it exactly as a password.**
   *
   * Whoever holds this key can broadcast as Kurasikapa Media. There is no
   * second factor on an RTMPS ingest: the key *is* the authentication, so a
   * leaked one puts an arbitrary stream on the station's own air, live, under
   * the station's name, in front of its whole audience.
   *
   * It is therefore returned **once**, at provision time, and handed straight to
   * the operator. It is never persisted — not on the Broadcast aggregate, not in
   * Mongo, not in a cache — never written to a log, an error message or an audit
   * entry, and never returned by any read. If it is lost, the channel is torn
   * down and a new one provisioned; that is cheaper than a key of unknown reach.
   */
  readonly streamKey: string
  /** The public HLS URL. This one is meant to be shared — it is what the player loads. */
  readonly playbackUrl: string
}

/**
 * Live channel lifecycle at the provider (Amazon IVS — ADR-0010).
 *
 * The port speaks channels, not IVS: no SDK client, no AWS type and no region
 * crosses it. Swapping IVS for Mux is then an adapter, not a rewrite of the
 * media use cases.
 */
export interface LiveVideoPort {
  provision(input: ProvisionChannelInput): Promise<ProvisionedChannel>

  /**
   * Destroys the channel and stops it billing.
   *
   * Must be idempotent: EndBroadcast persists the ended state before calling
   * this, so a retry after a network failure will ask to tear down a channel
   * that is already gone. That is the safe case, and it must not throw.
   */
  teardown(channelArn: string): Promise<void>
}
