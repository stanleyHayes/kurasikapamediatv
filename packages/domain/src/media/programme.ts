import { type Actor, requirePermission } from '../identity/actor'
import type { AssetId, PresenterId, ProgrammeId, UserId } from '../shared/ids'

export interface ProgrammeProps {
  readonly id: ProgrammeId
  readonly title: string
  readonly slug: string
  readonly locale: string
  readonly summary: string
  readonly category: string
  readonly presenterIds: readonly PresenterId[]
  readonly artworkAssetId: AssetId | null
  readonly published: boolean
  readonly createdBy: UserId
}

export type NewProgramme = Omit<ProgrammeProps, 'published' | 'createdBy'>

export class EmptyProgrammeTitle extends Error {
  constructor() {
    super('Programme title cannot be empty')
    this.name = 'EmptyProgrammeTitle'
  }
}

export class ProgrammeNeedsPresenter extends Error {
  constructor() {
    super('Programme requires at least one presenter')
    this.name = 'ProgrammeNeedsPresenter'
  }
}

/** A recurring station format, independent from any single transmission. */
export class Programme {
  private constructor(private readonly props: ProgrammeProps) {}

  static create(actor: Actor, input: NewProgramme): Programme {
    requirePermission(actor, 'stream:manage')
    if (input.title.trim() === '') throw new EmptyProgrammeTitle()
    if (input.presenterIds.length === 0) throw new ProgrammeNeedsPresenter()

    return new Programme({ ...input, title: input.title.trim(), published: false, createdBy: actor.id })
  }

  static reconstitute(props: ProgrammeProps): Programme {
    return new Programme(props)
  }

  get id(): ProgrammeId { return this.props.id }
  get title(): string { return this.props.title }
  get slug(): string { return this.props.slug }
  get locale(): string { return this.props.locale }
  get summary(): string { return this.props.summary }
  get category(): string { return this.props.category }
  get presenterIds(): readonly PresenterId[] { return this.props.presenterIds }
  get artworkAssetId(): AssetId | null { return this.props.artworkAssetId }
  get published(): boolean { return this.props.published }

  publish(actor: Actor): Programme {
    requirePermission(actor, 'stream:manage')
    return new Programme({ ...this.props, published: true })
  }

  snapshot(): ProgrammeProps {
    return this.props
  }
}
