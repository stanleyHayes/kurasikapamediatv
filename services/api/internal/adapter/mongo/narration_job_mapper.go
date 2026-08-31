package mongo

import (
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func narrationJobToDomain(doc narrationJobDoc) media.NarrationJob {
	var assetID *shared.AssetID
	if doc.AssetID != nil {
		id := shared.AssetID(*doc.AssetID)
		assetID = &id
	}
	return media.ReconstituteNarrationJob(media.NarrationJobState{
		ID: shared.NarrationJobID(doc.ID), ArticleID: shared.ArticleID(doc.ArticleID),
		RevisionID: shared.RevisionID(doc.RevisionID), AssetID: assetID,
		Locale: doc.Locale, Voice: doc.Voice, ProviderTaskID: doc.ProviderTaskID,
		Status: doc.Status, FailureReason: doc.FailureReason, RequestedBy: shared.UserID(doc.RequestedBy),
		CreatedAt: doc.CreatedAt, UpdatedAt: doc.UpdatedAt,
	})
}

func narrationJobToDoc(job media.NarrationJob) narrationJobDoc {
	state := job.State()
	var assetID *string
	if state.AssetID != nil {
		id := state.AssetID.String()
		assetID = &id
	}
	return narrationJobDoc{
		ID: state.ID.String(), ArticleID: state.ArticleID.String(), RevisionID: state.RevisionID.String(),
		AssetID: assetID, Locale: state.Locale, Voice: state.Voice, ProviderTaskID: state.ProviderTaskID,
		Status: state.Status, FailureReason: state.FailureReason, RequestedBy: state.RequestedBy.String(),
		CreatedAt: state.CreatedAt, UpdatedAt: state.UpdatedAt,
	}
}
