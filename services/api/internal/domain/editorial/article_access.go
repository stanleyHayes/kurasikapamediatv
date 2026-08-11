package editorial

import "github.com/kurasikapa/api/internal/domain/identity"

// AssertReadable refuses an actor who may not see this article's unpublished text.
//
// Distinct from ReadableBy: the CMS GetDraft path requires editorial permission
// even for a live article. A subscriber reading the public site is a different
// use case, and mixing the two is how an unpublished draft leaks through a GET.
func (a Article) AssertReadable(actor identity.Actor) error {
	if err := actor.Require(identity.PermArticleEditOwn); err != nil {
		return err
	}

	return a.guardOwnership(actor)
}

// AssertEditable refuses an actor who may not change the article's text now.
//
// Restore is an edit. Calling Retitle with the existing title purely to run
// this guard is how the guard stops being called the moment someone tidies up.
func (a Article) AssertEditable(actor identity.Actor) error {
	return a.guardEditable(actor)
}
