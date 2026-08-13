import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { SaveButton } from '../save-button'

/**
 * Resolves whether THIS reader has already saved the article.
 *
 * Passing a hardcoded `false` would render "Save" on something already in the
 * reader's list, and the first tap would silently un-save it. So the session
 * is read here — inside its own boundary, per CLAUDE.md — and the button is
 * given the truth.
 *
 * A signed-out reader still gets the button: the action answers
 * `not_signed_in` and the button says so, which is a better prompt to sign in
 * than a control that isn't there.
 */
export async function SaveControl({ articleId }: { articleId: string }): Promise<React.ReactElement> {
  const actor = await currentActor()

  if (actor === null) return <SaveButton articleId={articleId} initiallySaved={false} />

  const saved = await container().listSavedArticles.execute({ actor })
  const already = saved.items.some(({ article }) => article.id === articleId)

  return <SaveButton articleId={articleId} initiallySaved={already} />
}
