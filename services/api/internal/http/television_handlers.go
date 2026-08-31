package http

import (
	"net/http"
	"time"

	appmedia "github.com/kurasikapa/api/internal/app/media"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type presenterRequest struct{ Name, Slug, Locale, Role, Biography string }
type programmeRequest struct {
	Title, Slug, Locale, Summary, Category string
	PresenterIDs                           []string `json:"presenterIds"`
}
type scheduleRequest struct {
	ProgrammeID, Locale string
	StartsAt, EndsAt    time.Time
	IsLive              bool
}
type replayRequest struct{ ReplayAssetID, CaptionAssetID string }

func (d Deps) handleCreatePresenter(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input presenterRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	presenter, err := d.CreatePresenter.Execute(r.Context(), actor, domainmedia.PresenterState{
		Name: input.Name, Slug: input.Slug, Locale: input.Locale, Role: input.Role, Biography: input.Biography,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, presenterView(presenter))
}
func (d Deps) handlePublishPresenter(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	presenter, err := d.PublishPresenter.Execute(r.Context(), actor, shared.PresenterID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, presenterView(presenter))
}
func (d Deps) handleCreateProgramme(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input programmeRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	hosts := make([]shared.PresenterID, len(input.PresenterIDs))
	for i, id := range input.PresenterIDs {
		hosts[i] = shared.PresenterID(id)
	}
	programme, err := d.CreateProgramme.Execute(r.Context(), actor, domainmedia.ProgrammeState{
		Title: input.Title, Slug: input.Slug, Locale: input.Locale, Summary: input.Summary,
		Category: input.Category, PresenterIDs: hosts,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, programmeView(programme))
}
func (d Deps) handlePublishProgramme(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	programme, err := d.PublishProgramme.Execute(r.Context(), actor, shared.ProgrammeID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, programmeView(programme))
}
func (d Deps) handleScheduleProgramme(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input scheduleRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	slot, err := d.ScheduleProgramme.Execute(r.Context(), actor, domainmedia.ScheduleSlotState{
		ProgrammeID: shared.ProgrammeID(input.ProgrammeID), Locale: input.Locale,
		StartsAt: input.StartsAt, EndsAt: input.EndsAt, IsLive: input.IsLive,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, scheduleView(slot))
}
func (d Deps) handlePublishReplay(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input replayRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	slot, err := d.PublishReplay.Execute(r.Context(), actor, appmedia.PublishReplayInput{
		SlotID: shared.ScheduleSlotID(r.PathValue("id")), ReplayAssetID: shared.AssetID(input.ReplayAssetID),
		CaptionAssetID: shared.AssetID(input.CaptionAssetID),
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, scheduleView(slot))
}
func (d Deps) handleReplayCandidates(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	items, err := d.ListReplayCandidates.Execute(r.Context(), actor, r.URL.Query().Get("locale"))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	rows := make([]any, len(items))
	for i, item := range items {
		rows[i] = map[string]any{"slot": scheduleView(item.Slot), "programme": programmeView(item.Programme)}
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": rows})
}
func (d Deps) handleTelevisionGuide(w http.ResponseWriter, r *http.Request) {
	guide, err := d.ListTelevisionGuide.Execute(r.Context(), r.PathValue("locale"))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, guideView(guide))
}

func presenterView(p domainmedia.Presenter) map[string]any {
	s := p.State()
	return map[string]any{"id": s.ID.String(), "name": s.Name, "slug": s.Slug, "locale": s.Locale, "role": s.Role, "biography": s.Biography, "portraitAssetId": s.PortraitAssetID, "published": s.Published}
}
func programmeView(p domainmedia.Programme) map[string]any {
	s := p.State()
	hosts := make([]string, len(s.PresenterIDs))
	for i, id := range s.PresenterIDs {
		hosts[i] = id.String()
	}
	return map[string]any{"id": s.ID.String(), "title": s.Title, "slug": s.Slug, "locale": s.Locale, "summary": s.Summary, "category": s.Category, "presenterIds": hosts, "artworkAssetId": s.ArtworkAssetID, "published": s.Published}
}
func scheduleView(slot domainmedia.ScheduleSlot) map[string]any {
	s := slot.State()
	return map[string]any{"id": s.ID.String(), "programmeId": s.ProgrammeID.String(), "locale": s.Locale, "startsAt": s.StartsAt, "endsAt": s.EndsAt, "isLive": s.IsLive, "state": s.State, "replayAssetId": s.ReplayAssetID, "captionAssetId": s.CaptionAssetID}
}
func guideView(guide appmedia.TelevisionGuide) map[string]any {
	presenters := make([]any, len(guide.Presenters))
	for i, item := range guide.Presenters {
		presenters[i] = presenterView(item)
	}
	programmes := make([]any, len(guide.Programmes))
	for i, item := range guide.Programmes {
		hosts := make([]any, len(item.Presenters))
		for j, host := range item.Presenters {
			hosts[j] = presenterView(host)
		}
		programmes[i] = map[string]any{"programme": programmeView(item.Programme), "presenters": hosts}
	}
	slots := func(items []appmedia.SlotView) []any {
		out := make([]any, len(items))
		for i, item := range items {
			out[i] = map[string]any{"slot": scheduleView(item.Slot), "programme": programmeView(item.Programme), "replay": item.Replay}
		}
		return out
	}
	return map[string]any{"presenters": presenters, "programmes": programmes, "upcoming": slots(guide.Upcoming), "replays": slots(guide.Replays)}
}
