import type { PresenterId, ProgrammeId } from '@kurasikapa/domain'

export class PresenterNotFound extends Error {
  constructor(id: PresenterId) {
    super(`Presenter "${id}" was not found`)
    this.name = 'PresenterNotFound'
  }
}

export class ProgrammeNotFound extends Error {
  constructor(id: ProgrammeId) {
    super(`Programme "${id}" was not found`)
    this.name = 'ProgrammeNotFound'
  }
}

export class UnpublishedPresenter extends Error {
  constructor(id: PresenterId) {
    super(`Presenter "${id}" is not published`)
    this.name = 'UnpublishedPresenter'
  }
}

export class UnpublishedProgramme extends Error {
  constructor(id: ProgrammeId) {
    super(`Programme "${id}" is not published`)
    this.name = 'UnpublishedProgramme'
  }
}
