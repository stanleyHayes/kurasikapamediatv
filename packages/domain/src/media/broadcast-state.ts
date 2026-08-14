/**
 * A broadcast's life, as three states.
 *
 *   scheduled ──goLive──▶ live ──end──▶ ended
 *
 * Its own file, small as it is, because `errors.ts` names the state it refused
 * and `broadcast.ts` imports `errors.ts`. Declaring the union on the aggregate
 * would make those two modules a cycle, which `pnpm boundaries` fails on
 * (`no-circular`) — type-only imports included, since dependency-cruiser reads
 * the pre-compilation graph.
 */
export const BROADCAST_STATES = ['scheduled', 'live', 'ended'] as const

export type BroadcastState = (typeof BROADCAST_STATES)[number]
