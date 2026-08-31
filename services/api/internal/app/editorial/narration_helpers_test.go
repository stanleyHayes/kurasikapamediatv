package editorial_test

import (
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func readyNarrationJob(actor identity.Actor, articleID shared.ArticleID, id shared.NarrationJobID, assetID shared.AssetID) (media.NarrationJob, error) {
	job, err := media.NewNarrationJob(actor, media.NarrationJobState{ID: id, ArticleID: articleID, RevisionID: "revision_1", Locale: "en", Voice: "Amy"}, now)
	if err == nil {
		job, err = job.Start(actor, "polly_1", now)
	}
	if err == nil {
		job, err = job.Complete(actor, assetID, now)
	}
	return job, err
}
