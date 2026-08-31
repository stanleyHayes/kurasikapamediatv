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
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type TelevisionRepositories struct{ presenters, programmes, schedule *mongo.Collection }

func NewTelevisionRepositories(db *mongo.Database) *TelevisionRepositories {
	return &TelevisionRepositories{db.Collection(CollPresenters), db.Collection(CollProgrammes), db.Collection(CollScheduleSlots)}
}

type PresenterRepository struct{ store *TelevisionRepositories }
type ProgrammeRepository struct{ store *TelevisionRepositories }
type ScheduleRepository struct{ store *TelevisionRepositories }

func NewPresenterRepository(store *TelevisionRepositories) *PresenterRepository {
	return &PresenterRepository{store}
}
func NewProgrammeRepository(store *TelevisionRepositories) *ProgrammeRepository {
	return &ProgrammeRepository{store}
}
func NewScheduleRepository(store *TelevisionRepositories) *ScheduleRepository {
	return &ScheduleRepository{store}
}
func (r *ScheduleRepository) FindByID(ctx context.Context, id shared.ScheduleSlotID) (domainmedia.ScheduleSlot, error) {
	return r.store.FindScheduleByID(ctx, id)
}
func (r *PresenterRepository) FindByID(ctx context.Context, id shared.PresenterID) (domainmedia.Presenter, error) {
	return r.store.FindPresenterByID(ctx, id)
}
func (r *PresenterRepository) ListPublished(ctx context.Context, locale string) ([]domainmedia.Presenter, error) {
	return r.store.ListPublishedPresenters(ctx, locale)
}
func (r *PresenterRepository) Save(ctx context.Context, value domainmedia.Presenter) error {
	return r.store.SavePresenter(ctx, value)
}
func (r *ProgrammeRepository) FindByID(ctx context.Context, id shared.ProgrammeID) (domainmedia.Programme, error) {
	return r.store.FindProgrammeByID(ctx, id)
}
func (r *ProgrammeRepository) ListPublished(ctx context.Context, locale string) ([]domainmedia.Programme, error) {
	return r.store.ListPublishedProgrammes(ctx, locale)
}
func (r *ProgrammeRepository) Save(ctx context.Context, value domainmedia.Programme) error {
	return r.store.SaveProgramme(ctx, value)
}
func (r *ScheduleRepository) ListUpcoming(ctx context.Context, locale string, from time.Time, limit int) ([]domainmedia.ScheduleSlot, error) {
	return r.store.ListUpcoming(ctx, locale, from, limit)
}
func (r *ScheduleRepository) ListAwaitingReplay(ctx context.Context, locale string, now time.Time, limit int) ([]domainmedia.ScheduleSlot, error) {
	return r.store.ListAwaitingReplay(ctx, locale, now, limit)
}
func (r *ScheduleRepository) ListReplays(ctx context.Context, locale string, limit int) ([]domainmedia.ScheduleSlot, error) {
	return r.store.ListReplays(ctx, locale, limit)
}
func (r *ScheduleRepository) Save(ctx context.Context, value domainmedia.ScheduleSlot) error {
	return r.store.SaveSchedule(ctx, value)
}
func (r *TelevisionRepositories) FindPresenterByID(ctx context.Context, id shared.PresenterID) (domainmedia.Presenter, error) {
	var doc presenterDoc
	if err := r.presenters.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return domainmedia.Presenter{}, ports.ErrNotFound
		}
		return domainmedia.Presenter{}, fmt.Errorf("finding presenter: %w", err)
	}
	return presenterToDomain(doc), nil
}
func (r *TelevisionRepositories) ListPublishedPresenters(ctx context.Context, locale string) ([]domainmedia.Presenter, error) {
	cursor, err := r.presenters.Find(ctx, bson.M{"locale": locale, "published": true}, options.Find().SetSort(bson.D{{Key: "name", Value: 1}}))
	if err != nil {
		return nil, fmt.Errorf("listing presenters: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []presenterDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding presenters: %w", err)
	}
	out := make([]domainmedia.Presenter, len(docs))
	for i, doc := range docs {
		out[i] = presenterToDomain(doc)
	}
	return out, nil
}
func (r *TelevisionRepositories) SavePresenter(ctx context.Context, presenter domainmedia.Presenter) error {
	doc := presenterToDoc(presenter)
	_, err := r.presenters.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return wrapSave("presenter", err)
}
func (r *TelevisionRepositories) FindProgrammeByID(ctx context.Context, id shared.ProgrammeID) (domainmedia.Programme, error) {
	var doc programmeDoc
	if err := r.programmes.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return domainmedia.Programme{}, ports.ErrNotFound
		}
		return domainmedia.Programme{}, fmt.Errorf("finding programme: %w", err)
	}
	return programmeToDomain(doc), nil
}
func (r *TelevisionRepositories) ListPublishedProgrammes(ctx context.Context, locale string) ([]domainmedia.Programme, error) {
	cursor, err := r.programmes.Find(ctx, bson.M{"locale": locale, "published": true}, options.Find().SetSort(bson.D{{Key: "title", Value: 1}}))
	if err != nil {
		return nil, fmt.Errorf("listing programmes: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []programmeDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding programmes: %w", err)
	}
	out := make([]domainmedia.Programme, len(docs))
	for i, doc := range docs {
		out[i] = programmeToDomain(doc)
	}
	return out, nil
}
func (r *TelevisionRepositories) SaveProgramme(ctx context.Context, programme domainmedia.Programme) error {
	doc := programmeToDoc(programme)
	_, err := r.programmes.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return wrapSave("programme", err)
}
func (r *TelevisionRepositories) FindScheduleByID(ctx context.Context, id shared.ScheduleSlotID) (domainmedia.ScheduleSlot, error) {
	var doc scheduleSlotDoc
	if err := r.schedule.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return domainmedia.ScheduleSlot{}, ports.ErrNotFound
		}
		return domainmedia.ScheduleSlot{}, fmt.Errorf("finding schedule slot: %w", err)
	}
	return scheduleToDomain(doc), nil
}
func (r *TelevisionRepositories) ListUpcoming(ctx context.Context, locale string, from time.Time, limit int) ([]domainmedia.ScheduleSlot, error) {
	filter := bson.M{"locale": locale, "state": string(domainmedia.ScheduleScheduled), "endsAt": bson.M{"$gt": from}}
	return r.listSchedule(ctx, filter, bson.D{{Key: "startsAt", Value: 1}}, limit)
}
func (r *TelevisionRepositories) ListAwaitingReplay(ctx context.Context, locale string, now time.Time, limit int) ([]domainmedia.ScheduleSlot, error) {
	filter := bson.M{"locale": locale, "state": string(domainmedia.ScheduleScheduled), "isLive": true, "endsAt": bson.M{"$lte": now}}
	return r.listSchedule(ctx, filter, bson.D{{Key: "endsAt", Value: -1}}, limit)
}
func (r *TelevisionRepositories) ListReplays(ctx context.Context, locale string, limit int) ([]domainmedia.ScheduleSlot, error) {
	filter := bson.M{"locale": locale, "state": string(domainmedia.ScheduleCompleted), "replayAssetId": bson.M{"$ne": nil}, "captionAssetId": bson.M{"$ne": nil}}
	return r.listSchedule(ctx, filter, bson.D{{Key: "endsAt", Value: -1}}, limit)
}
func (r *TelevisionRepositories) listSchedule(ctx context.Context, filter bson.M, sort bson.D, limit int) ([]domainmedia.ScheduleSlot, error) {
	cursor, err := r.schedule.Find(ctx, filter, options.Find().SetSort(sort).SetLimit(int64(limit)))
	if err != nil {
		return nil, fmt.Errorf("listing schedule: %w", err)
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []scheduleSlotDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("decoding schedule: %w", err)
	}
	out := make([]domainmedia.ScheduleSlot, len(docs))
	for i, doc := range docs {
		out[i] = scheduleToDomain(doc)
	}
	return out, nil
}
func (r *TelevisionRepositories) SaveSchedule(ctx context.Context, slot domainmedia.ScheduleSlot) error {
	doc := scheduleToDoc(slot)
	_, err := r.schedule.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
	return wrapSave("schedule slot", err)
}
func wrapSave(kind string, err error) error {
	if err != nil {
		return fmt.Errorf("saving %s: %w", kind, err)
	}
	return nil
}
