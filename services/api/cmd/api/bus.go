package main

import (
	"context"
	"log/slog"

	"github.com/kurasikapa/api/internal/app/ports"
)

/*
loggingBus is the R1 event bus for this service.

Deliberately not a queue. The only subscriber that matters today is cache
invalidation, and that lives in Next.js beside the cache it invalidates — this
service has nothing local to notify. Emitting to the log keeps the events
visible and honest until media-svc's real queue exists.

EventBusPort is best-effort by contract, and implementations are required to
report their own delivery failures. This one cannot fail to log, which makes
that contract trivially satisfied rather than quietly ignored.
*/
type loggingBus struct {
	log *slog.Logger
}

func (b loggingBus) Publish(_ context.Context, event ports.Event) error {
	b.log.Info("domain event",
		slog.String("event", event.Name),
		slog.String("articleId", event.ArticleID.String()),
		slog.String("locale", event.Locale),
		slog.Time("occurredAt", event.OccurredAt))

	return nil
}
