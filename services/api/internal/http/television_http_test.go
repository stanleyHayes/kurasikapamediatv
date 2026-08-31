package http_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func emptyEditorial() appeditorial.Deps {
	return appeditorial.Deps{
		Articles: faketesting.NewArticleStore(), Revisions: faketesting.NewRevisionStore(),
		Categories: faketesting.NewCategoryStore(), Clock: faketesting.FixedClock{At: now},
		IDs: &faketesting.SequentialIDs{}, Events: &faketesting.RecordingEventBus{},
	}
}
func televisionServer() http.Handler {
	return routed(emptyEditorial(), map[shared.UserID][]identity.Role{"manager": {identity.RoleVideoEditor}})
}
func request(handler http.Handler, method, path, body string, auth bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if auth {
		req.Header.Set("X-Kurasikapa-User", "manager")
	}
	return do(handler, req)
}

func TestTelevisionEndpointsWorkflow(t *testing.T) {
	handler := televisionServer()
	presenter := request(handler, http.MethodPost, "/television/presenters", `{"name":"Ama Mensah","slug":"ama-mensah","locale":"en","role":"Host","biography":"A newsroom presenter."}`, true)
	if presenter.Code != http.StatusCreated {
		t.Fatalf("presenter: %d %s", presenter.Code, presenter.Body.String())
	}
	publishedPresenter := request(handler, http.MethodPost, "/television/presenters/id_1/publish", "", true)
	if publishedPresenter.Code != http.StatusOK {
		t.Fatalf("publish presenter: %d %s", publishedPresenter.Code, publishedPresenter.Body.String())
	}
	programme := request(handler, http.MethodPost, "/television/programmes", `{"title":"Morning Desk","slug":"morning-desk","locale":"en","summary":"The day's essential agenda.","category":"News","presenterIds":["id_1"]}`, true)
	if programme.Code != http.StatusCreated {
		t.Fatalf("programme: %d %s", programme.Code, programme.Body.String())
	}
	publishedProgramme := request(handler, http.MethodPost, "/television/programmes/id_2/publish", "", true)
	if publishedProgramme.Code != http.StatusOK {
		t.Fatalf("publish programme: %d %s", publishedProgramme.Code, publishedProgramme.Body.String())
	}
	schedule := request(handler, http.MethodPost, "/television/schedule", `{"programmeId":"id_2","locale":"en","startsAt":"2026-08-31T13:00:00Z","endsAt":"2026-08-31T14:00:00Z","isLive":true}`, true)
	if schedule.Code != http.StatusCreated {
		t.Fatalf("schedule: %d %s", schedule.Code, schedule.Body.String())
	}
	guide := request(handler, http.MethodGet, "/public/en/television", "", false)
	if guide.Code != http.StatusOK || !bytes.Contains(guide.Body.Bytes(), []byte("Morning Desk")) {
		t.Fatalf("guide: %d %s", guide.Code, guide.Body.String())
	}
}

func TestTelevisionEndpointsRejectUnauthorisedAndInvalidInput(t *testing.T) {
	handler := televisionServer()
	if rec := request(handler, http.MethodPost, "/television/presenters", `{}`, false); rec.Code != http.StatusForbidden {
		t.Fatalf("unauthorised = %d", rec.Code)
	}
	if rec := request(handler, http.MethodPost, "/television/presenters", `{`, true); rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid = %d", rec.Code)
	}
}

func TestReplayPublishingEndpoints(t *testing.T) {
	grants := map[shared.UserID][]identity.Role{"manager": {identity.RoleVideoEditor}}
	deps := httpDeps(emptyEditorial(), grants)
	programme := domainmedia.ReconstituteProgramme(domainmedia.ProgrammeState{ID: "programme", Title: "Morning Desk", Locale: "en", Published: true})
	slot := domainmedia.ReconstituteScheduleSlot(domainmedia.ScheduleSlotState{
		ID: "slot", ProgrammeID: programme.ID(), Locale: "en", IsLive: true,
		StartsAt: now.Add(-2 * time.Hour), EndsAt: now.Add(-time.Hour), State: domainmedia.ScheduleScheduled,
	})
	schedule := faketesting.NewScheduleStore(slot)
	assets := faketesting.NewAssetStore(
		domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: "video", Kind: domainmedia.AssetVideo, Status: domainmedia.AssetReady, SecureURL: "https://cdn.test/report.mp4"}),
		domainmedia.ReconstituteAsset(domainmedia.AssetState{ID: "captions", Kind: domainmedia.AssetCaption, MIMEType: "text/vtt", Status: domainmedia.AssetReady, SecureURL: "https://cdn.test/report.vtt"}),
	)
	mediaDeps := appmedia.Deps{Presenters: faketesting.NewPresenterStore(), Programmes: faketesting.NewProgrammeStore(programme), Schedule: schedule, Assets: assets, Clock: faketesting.FixedClock{At: now}}
	deps.PublishReplay = appmedia.NewPublishReplay(mediaDeps)
	deps.ListReplayCandidates = appmedia.NewListReplayCandidates(mediaDeps)
	deps.ListTelevisionGuide = appmedia.NewListTelevisionGuide(mediaDeps, faketesting.VideoDeliveryFake{Delivery: ports.VideoDelivery{PlaybackURL: "https://cdn.test/report.m3u8", PosterURL: "https://cdn.test/poster.jpg", MIMEType: "application/vnd.apple.mpegurl"}})
	handler := kurahttp.NewRouter(deps)
	if rec := request(handler, http.MethodGet, "/television/replay-candidates?locale=en", "", true); rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte("Morning Desk")) {
		t.Fatalf("candidates: %d %s", rec.Code, rec.Body.String())
	}
	replay := request(handler, http.MethodPost, "/television/schedule/slot/replay", `{"replayAssetId":"video","captionAssetId":"captions"}`, true)
	if replay.Code != http.StatusOK || !bytes.Contains(replay.Body.Bytes(), []byte("completed")) {
		t.Fatalf("publish replay: %d %s", replay.Code, replay.Body.String())
	}
	guide := request(handler, http.MethodGet, "/public/en/television", "", false)
	if guide.Code != http.StatusOK || !bytes.Contains(guide.Body.Bytes(), []byte(`"captionUrl":"https://cdn.test/report.vtt"`)) {
		t.Fatalf("public replay: %d %s", guide.Code, guide.Body.String())
	}
	if rec := request(handler, http.MethodPost, "/television/schedule/slot/replay", `{}`, false); rec.Code != http.StatusForbidden {
		t.Fatalf("unauthorised replay = %d", rec.Code)
	}
}
