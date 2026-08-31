import { type Actor, requirePermission } from '../identity/actor'
import type { AssetId, PresenterId, UserId } from '../shared/ids'

export interface PresenterProps {
  readonly id: PresenterId
  readonly name: string
  readonly slug: string
  readonly locale: string
  readonly role: string
  readonly biography: string
  readonly portraitAssetId: AssetId | null
  readonly published: boolean
  readonly createdBy: UserId
}

export type NewPresenter = Omit<PresenterProps, 'published' | 'createdBy'>

export class EmptyPresenterName extends Error {
  constructor() {
    super('Presenter name cannot be empty')
    this.name = 'EmptyPresenterName'
  }
}

/** A station-owned public identity used by programmes, schedules and bylines. */
export class Presenter {
  private constructor(private readonly props: PresenterProps) {}

  static create(actor: Actor, input: NewPresenter): Presenter {
    requirePermission(actor, 'stream:manage')
    if (input.name.trim() === '') throw new EmptyPresenterName()

    return new Presenter({ ...input, name: input.name.trim(), published: false, createdBy: actor.id })
  }

  static reconstitute(props: PresenterProps): Presenter {
    return new Presenter(props)
  }

  get id(): PresenterId { return this.props.id }
  get name(): string { return this.props.name }
  get slug(): string { return this.props.slug }
  get locale(): string { return this.props.locale }
  get role(): string { return this.props.role }
  get biography(): string { return this.props.biography }
  get portraitAssetId(): AssetId | null { return this.props.portraitAssetId }
  get published(): boolean { return this.props.published }

  publish(actor: Actor): Presenter {
    requirePermission(actor, 'stream:manage')
    return new Presenter({ ...this.props, published: true })
  }

  snapshot(): PresenterProps {
    return this.props
  }
}
