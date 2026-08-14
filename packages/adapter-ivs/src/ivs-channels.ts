import {
  Ivs,
  type CreateChannelCommandInput,
  type CreateChannelCommandOutput,
  type DeleteChannelCommandInput,
  type DeleteChannelCommandOutput,
} from '@aws-sdk/client-ivs'

/**
 * The two IVS calls this adapter makes, and nothing else.
 *
 * Narrowing the SDK to a two-method seam is what lets this package be tested
 * without an AWS account: the real `Ivs` client satisfies it structurally, and
 * a hand-written fake stands in for it. Nothing widens it casually — every
 * method added here is another call a fake has to stay honest about.
 */
export interface IvsChannels {
  createChannel(input: CreateChannelCommandInput): Promise<CreateChannelCommandOutput>
  deleteChannel(input: DeleteChannelCommandInput): Promise<DeleteChannelCommandOutput>
}

/**
 * The real client, and the only line in the repository that constructs one.
 *
 * Constructing it does no I/O and resolves no credentials — the SDK defers both
 * to the first call — so the composition root can build one whether or not AWS
 * is configured. `IvsLiveVideo` is what refuses when it is not.
 *
 * `region` is load-bearing and unvalidated here: IVS is a regional service that
 * does not exist in every region, and a wrong one fails at the first broadcast
 * rather than at start-up. Pass the region the channels were quota-approved in.
 */
export function ivsChannels(region: string): IvsChannels {
  return new Ivs({ region })
}
