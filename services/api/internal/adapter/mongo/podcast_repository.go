package mongo

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type PodcastRepository struct{ collection *mongo.Collection }

func NewPodcastRepository(db *mongo.Database) *PodcastRepository {
	return &PodcastRepository{collection: db.Collection(CollPodcasts)}
}
func (r *PodcastRepository) FindByID(ctx context.Context, id shared.PodcastID) (media.Podcast, error) {
	var doc podcastDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return media.Podcast{}, ports.ErrNotFound
		}
		return media.Podcast{}, err
	}
	return podcastFromDoc(doc), nil
}
func (r *PodcastRepository) ListPublished(ctx context.Context, locale string, limit int) ([]media.Podcast, error) {
	filter := bson.M{"published": true}
	if locale != "" {
		filter["locale"] = locale
	}
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "_id", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []podcastDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]media.Podcast, len(docs))
	for i, doc := range docs {
		out[i] = podcastFromDoc(doc)
	}
	return out, nil
}
func (r *PodcastRepository) Save(ctx context.Context, item media.Podcast) error {
	doc := podcastToDoc(item)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *PodcastRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "locale", Value: 1}, {Key: "published", Value: 1}, {Key: "_id", Value: -1}},
		Options: options.Index().SetName("public_podcast_library"),
	})
	return err
}
func podcastToDoc(item media.Podcast) podcastDoc {
	s := item.State()
	return podcastDoc{ID: s.ID.String(), Title: s.Title, Slug: s.Slug, Locale: s.Locale, Summary: s.Summary, Author: s.Author, ArtworkAssetID: assetIDPointer(s.ArtworkAssetID), Published: s.Published, CreatedBy: s.CreatedBy.String()}
}
func podcastFromDoc(doc podcastDoc) media.Podcast {
	return media.ReconstitutePodcast(media.PodcastState{ID: shared.PodcastID(doc.ID), Title: doc.Title, Slug: doc.Slug, Locale: doc.Locale, Summary: doc.Summary, Author: doc.Author, ArtworkAssetID: assetIDFromPointer(doc.ArtworkAssetID), Published: doc.Published, CreatedBy: shared.UserID(doc.CreatedBy)})
}

type EpisodeRepository struct{ collection *mongo.Collection }

func NewEpisodeRepository(db *mongo.Database) *EpisodeRepository {
	return &EpisodeRepository{collection: db.Collection(CollEpisodes)}
}
func (r *EpisodeRepository) FindByID(ctx context.Context, id shared.EpisodeID) (media.Episode, error) {
	var doc episodeDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return media.Episode{}, ports.ErrNotFound
		}
		return media.Episode{}, err
	}
	return episodeFromDoc(doc), nil
}
func (r *EpisodeRepository) ListPublished(ctx context.Context, podcastID shared.PodcastID, limit int) ([]media.Episode, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"podcastId": podcastID.String(), "published": true}, options.Find().SetSort(bson.D{{Key: "publishedAt", Value: -1}, {Key: "_id", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []episodeDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]media.Episode, len(docs))
	for i, doc := range docs {
		out[i] = episodeFromDoc(doc)
	}
	return out, nil
}
func (r *EpisodeRepository) Save(ctx context.Context, item media.Episode) error {
	doc := episodeToDoc(item)
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return err
}
func (r *EpisodeRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "podcastId", Value: 1}, {Key: "published", Value: 1}, {Key: "publishedAt", Value: -1}, {Key: "_id", Value: -1}},
		Options: options.Index().SetName("public_episode_library"),
	})
	return err
}
func episodeToDoc(item media.Episode) episodeDoc {
	s := item.State()
	chapters := make([]episodeChapterDoc, len(s.Chapters))
	for i, chapter := range s.Chapters {
		chapters[i] = episodeChapterDoc(chapter)
	}
	return episodeDoc{ID: s.ID.String(), PodcastID: s.PodcastID.String(), Title: s.Title, Slug: s.Slug, Locale: s.Locale, Summary: s.Summary, AudioAssetID: assetIDPointer(s.AudioAssetID), TranscriptAssetID: assetIDPointer(s.TranscriptAssetID), ArtworkAssetID: assetIDPointer(s.ArtworkAssetID), Chapters: chapters, DurationSeconds: s.DurationSeconds, Published: s.Published, PublishedAt: s.PublishedAt, CreatedBy: s.CreatedBy.String()}
}
func episodeFromDoc(doc episodeDoc) media.Episode {
	chapters := make([]media.EpisodeChapter, len(doc.Chapters))
	for i, chapter := range doc.Chapters {
		chapters[i] = media.EpisodeChapter(chapter)
	}
	return media.ReconstituteEpisode(media.EpisodeState{ID: shared.EpisodeID(doc.ID), PodcastID: shared.PodcastID(doc.PodcastID), Title: doc.Title, Slug: doc.Slug, Locale: doc.Locale, Summary: doc.Summary, AudioAssetID: assetIDFromPointer(doc.AudioAssetID), TranscriptAssetID: assetIDFromPointer(doc.TranscriptAssetID), ArtworkAssetID: assetIDFromPointer(doc.ArtworkAssetID), Chapters: chapters, DurationSeconds: doc.DurationSeconds, Published: doc.Published, PublishedAt: doc.PublishedAt, CreatedBy: shared.UserID(doc.CreatedBy)})
}

func assetIDPointer(id *shared.AssetID) *string {
	if id == nil {
		return nil
	}
	value := id.String()
	return &value
}
func assetIDFromPointer(id *string) *shared.AssetID {
	if id == nil {
		return nil
	}
	value := shared.AssetID(*id)
	return &value
}
