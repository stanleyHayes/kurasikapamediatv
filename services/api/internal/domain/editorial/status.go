// Package editorial holds the publishing rules: what an article is, what may
// happen to it, and who may make it happen.
//
// Nothing here knows about MongoDB, HTTP or Anthropic. A rule that can only be
// checked by talking to a database is not a rule, it is a query.
package editorial

import "github.com/kurasikapa/api/internal/domain/identity"

// Status is where an article sits in the editorial workflow.
//
//	Draft ──submit──▶ In Review ──approve──▶ Approved ──schedule──▶ Scheduled ──▶ Published
//	  ▲                   │                                                          │
//	  └──────reject───────┘                                              unpublish───┘
type Status string

// The six states an article can occupy.
const (
	StatusDraft       Status = "draft"
	StatusInReview    Status = "in_review"
	StatusApproved    Status = "approved"
	StatusScheduled   Status = "scheduled"
	StatusPublished   Status = "published"
	StatusUnpublished Status = "unpublished"
)

// Transition is a named move between statuses.
type Transition string

// The six legal moves.
const (
	TransitionSubmit    Transition = "submit"
	TransitionApprove   Transition = "approve"
	TransitionReject    Transition = "reject"
	TransitionSchedule  Transition = "schedule"
	TransitionPublish   Transition = "publish"
	TransitionUnpublish Transition = "unpublish"
)

// TransitionRule is the complete answer to "may this happen, and by whom".
//
// Both the legal source states and the permission demanded live in one table,
// so neither can be answered by reading a route handler.
type TransitionRule struct {
	From       []Status
	To         Status
	Permission identity.Permission
	// AuthorOnly requires the actor to own the article, unless they hold a
	// broader edit permission. Submitting your own draft is normal; submitting
	// a colleague's is not.
	AuthorOnly bool
}

var rules = map[Transition]TransitionRule{
	TransitionSubmit: {
		From:       []Status{StatusDraft},
		To:         StatusInReview,
		Permission: identity.PermArticleSubmit,
		AuthorOnly: true,
	},
	TransitionApprove: {
		From:       []Status{StatusInReview},
		To:         StatusApproved,
		Permission: identity.PermArticleApprove,
	},
	TransitionReject: {
		From:       []Status{StatusInReview},
		To:         StatusDraft,
		Permission: identity.PermArticleApprove,
	},
	TransitionSchedule: {
		From:       []Status{StatusApproved},
		To:         StatusScheduled,
		Permission: identity.PermArticlePublish,
	},
	TransitionPublish: {
		// Unpublished is included so a story pulled for correction can go back
		// up without being re-approved. Approval survives unpublication.
		From:       []Status{StatusApproved, StatusScheduled, StatusUnpublished},
		To:         StatusPublished,
		Permission: identity.PermArticlePublish,
	},
	TransitionUnpublish: {
		From:       []Status{StatusPublished},
		To:         StatusUnpublished,
		Permission: identity.PermArticleUnpublish,
	},
}

// RuleFor returns the rule governing a transition, and whether it is known.
func RuleFor(t Transition) (TransitionRule, bool) {
	rule, ok := rules[t]

	return rule, ok
}

// AllowedFrom reports whether a transition may start from a given status.
func AllowedFrom(t Transition, status Status) bool {
	rule, ok := rules[t]
	if !ok {
		return false
	}

	for _, from := range rule.From {
		if from == status {
			return true
		}
	}

	return false
}

// IsPubliclyVisible reports whether a reader may see an article in this state.
//
// Exactly one status qualifies. Written as an explicit equality rather than a
// "not in this list" check: adding a new status must default to invisible, and
// a negative check would default it to public.
func IsPubliclyVisible(status Status) bool {
	return status == StatusPublished
}
