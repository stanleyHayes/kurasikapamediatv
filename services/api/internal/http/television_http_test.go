package http_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
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
