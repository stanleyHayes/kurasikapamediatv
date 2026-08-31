package mongo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const CollRecordingImports = "recording_imports"

type recordingImportDoc struct {
	ID              string                      `bson:"_id"`
	AssetID         string                      `bson:"assetId"`
	SourceRef       string                      `bson:"sourceRef"`
	Bucket          string                      `bson:"bucket"`
	Prefix          string                      `bson:"prefix"`
	ChannelName     string                      `bson:"channelName"`
	Locale          string                      `bson:"locale"`
	ProviderTaskID  string                      `bson:"providerTaskId,omitempty"`
	OutputRef       string                      `bson:"outputRef,omitempty"`
	FailureReason   string                      `bson:"failureReason,omitempty"`
	DurationSeconds float64                     `bson:"durationSeconds"`
	Status          media.RecordingImportStatus `bson:"status"`
	RequestedBy     string                      `bson:"requestedBy"`
	CreatedAt       time.Time                   `bson:"createdAt"`
	UpdatedAt       time.Time                   `bson:"updatedAt"`
}

type RecordingImportRepository struct{ rows *mongo.Collection }

func NewRecordingImportRepository(db *mongo.Database) *RecordingImportRepository {
	return &RecordingImportRepository{rows: db.Collection(CollRecordingImports)}
}

func (r *RecordingImportRepository) FindByID(ctx context.Context, id shared.RecordingImportID) (media.RecordingImport, error) {
	return r.one(ctx, bson.M{"_id": id.String()})
}

func (r *RecordingImportRepository) FindBySourceRef(ctx context.Context, source string) (media.RecordingImport, error) {
	return r.one(ctx, bson.M{"sourceRef": source})
}

func (r *RecordingImportRepository) ListProcessing(ctx context.Context, limit int) ([]media.RecordingImport, error) {
	cursor, err := r.rows.Find(ctx, bson.M{"status": media.RecordingImportProcessing}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, fmt.Errorf("listing recording imports: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []recordingImportDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding recording imports: %w", err)
	}
	rows := make([]media.RecordingImport, len(docs))
	for index, doc := range docs {
		rows[index] = recordingImportToDomain(doc)
	}
	return rows, nil
}

func (r *RecordingImportRepository) Save(ctx context.Context, row media.RecordingImport) error {
	doc := recordingImportToDoc(row)
	_, err := r.rows.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return wrapSave("recording import", err)
}

func (r *RecordingImportRepository) EnsureIndexes(ctx context.Context) error {
	models := []mongo.IndexModel{
		{Keys: bson.D{{Key: "sourceRef", Value: 1}}, Options: options.Index().SetUnique(true).SetName("recording_source_unique")},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "createdAt", Value: 1}}, Options: options.Index().SetName("processing_recordings")},
	}
	if _, err := r.rows.Indexes().CreateMany(ctx, models); err != nil {
		return fmt.Errorf("creating recording import indexes: %w", err)
	}
	return nil
}

func (r *RecordingImportRepository) one(ctx context.Context, filter bson.M) (media.RecordingImport, error) {
	var doc recordingImportDoc
	if err := r.rows.FindOne(ctx, filter).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return media.RecordingImport{}, ports.ErrNotFound
		}
		return media.RecordingImport{}, fmt.Errorf("finding recording import: %w", err)
	}
	return recordingImportToDomain(doc), nil
}

func recordingImportToDomain(doc recordingImportDoc) media.RecordingImport {
	return media.ReconstituteRecordingImport(media.RecordingImportState{
		ID: shared.RecordingImportID(doc.ID), AssetID: shared.AssetID(doc.AssetID),
		SourceRef: doc.SourceRef, Bucket: doc.Bucket, Prefix: doc.Prefix,
		ChannelName: doc.ChannelName, Locale: doc.Locale, ProviderTaskID: doc.ProviderTaskID,
		OutputRef: doc.OutputRef, FailureReason: doc.FailureReason, DurationSeconds: doc.DurationSeconds,
		Status: doc.Status, RequestedBy: shared.UserID(doc.RequestedBy), CreatedAt: doc.CreatedAt, UpdatedAt: doc.UpdatedAt,
	})
}

func recordingImportToDoc(row media.RecordingImport) recordingImportDoc {
	s := row.State()
	return recordingImportDoc{
		ID: s.ID.String(), AssetID: s.AssetID.String(), SourceRef: s.SourceRef, Bucket: s.Bucket,
		Prefix: s.Prefix, ChannelName: s.ChannelName, Locale: s.Locale, ProviderTaskID: s.ProviderTaskID,
		OutputRef: s.OutputRef, FailureReason: s.FailureReason, DurationSeconds: s.DurationSeconds,
		Status: s.Status, RequestedBy: s.RequestedBy.String(), CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt,
	}
}
