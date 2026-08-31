package revenue

import (
	"time"

	"github.com/kurasikapa/api/internal/domain/shared"
)

type ArticleAccess struct {
	ArticleID shared.ArticleID
	Premium   bool
}

type ReaderEntitlement struct {
	SubscriptionActiveUntil *time.Time
}

func (a ArticleAccess) Allows(reader ReaderEntitlement, at time.Time) bool {
	if !a.Premium {
		return true
	}
	return reader.SubscriptionActiveUntil != nil && at.Before(*reader.SubscriptionActiveUntil)
}
