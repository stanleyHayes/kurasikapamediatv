// Package http is the transport edge: it turns requests into use case calls
// and results into responses.
//
// It decides nothing. Every guard, every permission check and every invariant
// belongs to the domain, and a rule that appears here is a rule the domain
// tests do not cover.
package http

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	appidentity "github.com/kurasikapa/api/internal/app/identity"
	appmedia "github.com/kurasikapa/api/internal/app/media"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
)

// Problem is the error body, following RFC 7807's shape.
//
// A stable machine-readable `type` and a human `title`. The caller keys off
// the type; the string is for a person reading a log.
type Problem struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
}

var errMalformedRequest = errors.New("malformed request")
var errInvalidWebhookEvent = errors.New("invalid webhook event")

// problemFor maps a domain error to a status and a stable type.
//
// The mapping lives in ONE place. Scattered across handlers, the same error
// ends up a 400 in one route and a 500 in another, and the client that has to
// cope with both is where the inconsistency becomes permanent.
//
// Anything unrecognised is 500 with a generic title. An unmapped error is by
// definition one we have not written a safe sentence for, and forwarding its
// message can hand a connection string to whoever made the request.
func problemFor(err error) Problem {
	switch {
	case errors.Is(err, errMalformedRequest):
		return Problem{Type: "invalid_json", Title: "The request body is not valid JSON", Status: http.StatusBadRequest}

	case errors.Is(err, errInvalidWebhookEvent):
		return Problem{Type: "invalid_webhook", Title: "The recording event is invalid", Status: http.StatusBadRequest}

	case errors.Is(err, ports.ErrNotFound):
		return Problem{Type: "not_found", Title: "Not found", Status: http.StatusNotFound}

	case errors.Is(err, identity.ErrNotPermitted):
		// 403, not 404. The caller is authenticated and we are telling them
		// they may not — hiding that behind a 404 would make an editor think
		// their own article had vanished.
		return Problem{Type: "not_permitted", Title: "Not permitted", Status: http.StatusForbidden}

	case errors.Is(err, ports.ErrInvalidPaymentWebhook):
		return Problem{Type: "invalid_webhook", Title: "The payment event could not be verified", Status: http.StatusUnauthorized}

	case errors.Is(err, ports.ErrNarrationNotConfigured):
		return Problem{Type: "narration_unavailable", Title: "Article narration is not configured", Status: http.StatusServiceUnavailable}

	case errors.Is(err, ports.ErrRecordingNotConfigured):
		return Problem{Type: "recording_unavailable", Title: "Recording promotion is not configured", Status: http.StatusServiceUnavailable}

	case errors.Is(err, editorial.ErrNotOwnArticle):
		return Problem{
			Type:   "not_own_article",
			Title:  "That article belongs to another author",
			Status: http.StatusForbidden,
		}

	case errors.Is(err, appeditorial.ErrSlugTaken):
		// 409: the URL is already claimed in this locale. A new title (or a
		// different locale) is the fix — not a retry of the same payload.
		return Problem{Type: "slug_taken", Title: err.Error(), Status: http.StatusConflict}

	case errors.Is(err, appeditorial.ErrUntitled):
		// 400: the title yields no slug. The request itself is the problem.
		return Problem{Type: "invalid_input", Title: err.Error(), Status: http.StatusBadRequest}

	case errors.Is(err, domainmedia.ErrInvalidAssetKind),
		errors.Is(err, identity.ErrIncompleteStaffProfile),
		errors.Is(err, identity.ErrUnsafeSocialLink),
		errors.Is(err, identity.ErrStaffProfileNeedsPortrait),
		errors.Is(err, editorial.ErrInvalidArticleHero),
		errors.Is(err, domainmedia.ErrEmptyAssetFilename),
		errors.Is(err, domainmedia.ErrImageNeedsAltText),
		errors.Is(err, domainmedia.ErrInvalidAssetDelivery),
		errors.Is(err, domainmedia.ErrEmptyPodcastTitle),
		errors.Is(err, domainmedia.ErrEmptyPodcastSummary),
		errors.Is(err, domainmedia.ErrInvalidGalleryKind),
		errors.Is(err, domainmedia.ErrEmptyGalleryTitle),
		errors.Is(err, domainmedia.ErrEmptyGallerySummary),
		errors.Is(err, domainmedia.ErrGalleryNeedsItems),
		errors.Is(err, domainmedia.ErrInvalidGalleryItem),
		errors.Is(err, domainmedia.ErrVideoNeedsCaptions),
		errors.Is(err, domainmedia.ErrEmptyEpisodeTitle),
		errors.Is(err, domainmedia.ErrEpisodeNeedsAudio),
		errors.Is(err, domainmedia.ErrEpisodeNeedsTranscript),
		errors.Is(err, domainmedia.ErrInvalidEpisodeChapter),
		errors.Is(err, domainmedia.ErrInvalidNarrationJob),
		errors.Is(err, domainmedia.ErrUnsupportedNarrationLocale),
		errors.Is(err, domainmedia.ErrInvalidRecordingImport),
		errors.Is(err, appeditorial.ErrNarrationTextTooLong),
		errors.Is(err, appeditorial.ErrNarrationTextEmpty):
		// Fall through to the shared invalid-input response.
		fallthrough
	case errors.Is(err, domainrevenue.ErrInvalidAmount),
		errors.Is(err, domainrevenue.ErrUnsupportedCurrency),
		errors.Is(err, domainrevenue.ErrInvalidProvider),
		errors.Is(err, domainrevenue.ErrEmptyPlanName),
		errors.Is(err, domainrevenue.ErrEmptyPlanSlug),
		errors.Is(err, domainrevenue.ErrInvalidInterval),
		errors.Is(err, domainrevenue.ErrPlanNeedsBenefits),
		errors.Is(err, domainrevenue.ErrInvalidAdSlot),
		errors.Is(err, domainrevenue.ErrInvalidAdWindow),
		errors.Is(err, domainrevenue.ErrInvalidAdURL),
		errors.Is(err, domainrevenue.ErrInvalidAdRate),
		errors.Is(err, domainrevenue.ErrIncompleteCampaign),
		errors.Is(err, domainrevenue.ErrInvalidAdEvent),
		errors.Is(err, domainrevenue.ErrAffiliateIdentity),
		errors.Is(err, domainrevenue.ErrAffiliateCopy),
		errors.Is(err, domainrevenue.ErrAffiliateURL),
		errors.Is(err, domainrevenue.ErrProductIdentity),
		errors.Is(err, domainrevenue.ErrProductCopy),
		errors.Is(err, domainrevenue.ErrInvalidStock),
		errors.Is(err, domainrevenue.ErrInvalidQuantity):
		return Problem{Type: "invalid_input", Title: err.Error(), Status: http.StatusBadRequest}

	case errors.Is(err, editorial.ErrIllegalTransition),
		errors.Is(err, editorial.ErrNotEditable),
		errors.Is(err, editorial.ErrNoApprovedRevision),
		errors.Is(err, editorial.ErrScheduleInPast),
		errors.Is(err, editorial.ErrRevisionNotOfArticle),
		errors.Is(err, appmedia.ErrPodcastNotPublished),
		errors.Is(err, appmedia.ErrGalleryAssetNotReady),
		errors.Is(err, appmedia.ErrGalleryCaptionNotReady),
		errors.Is(err, appmedia.ErrEpisodeAudioNotReady),
		errors.Is(err, appmedia.ErrTranscriptNotReady),
		errors.Is(err, appmedia.ErrReplayNeedsReadyVideo),
		errors.Is(err, appmedia.ErrReplayNeedsReadyCaptions),
		errors.Is(err, appmedia.ErrReplayCaptionsMustBeVTT),
		errors.Is(err, domainmedia.ErrReplayBeforeSlotEnds),
		errors.Is(err, domainmedia.ErrReplayAlreadyPublished),
		errors.Is(err, domainmedia.ErrReplayNotAwaiting),
		errors.Is(err, appeditorial.ErrHeroAssetNotUsable),
		errors.Is(err, appeditorial.ErrNarrationJobNotUsable),
		errors.Is(err, editorial.ErrInvalidArticleNarration),
		errors.Is(err, editorial.ErrNarrationRevisionMismatch),
		errors.Is(err, domainmedia.ErrNarrationJobTransition),
		errors.Is(err, appidentity.ErrInvalidStaffPortrait),
		errors.Is(err, domainrevenue.ErrCampaignEnded),
		errors.Is(err, domainrevenue.ErrAffiliateInactive):
		// 409: the request is well-formed and the article is simply not in a
		// state where it can happen. 400 would suggest the caller sent
		// something malformed and should change the payload.
		return Problem{Type: "conflict", Title: err.Error(), Status: http.StatusConflict}

	default:
		return Problem{
			Type:   "internal",
			Title:  "Something went wrong",
			Status: http.StatusInternalServerError,
		}
	}
}

// writeProblem sends the error and, for a 500, logs what it was hiding.
func writeProblem(w http.ResponseWriter, log *slog.Logger, err error) {
	problem := problemFor(err)

	// Only the unrecognised case is logged at error level: the others are
	// normal outcomes of a guard doing its job, and logging them as errors
	// trains everyone to ignore the log.
	if problem.Status == http.StatusInternalServerError {
		log.Error("unhandled error", slog.String("error", err.Error()))
	}

	writeJSON(w, log, problem.Status, problem)
}

// writeJSON sends a value, or gives up loudly rather than silently.
func writeJSON(w http.ResponseWriter, log *slog.Logger, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(body); err != nil {
		// The status is already sent, so nothing can be done for this caller —
		// but an encoder failing means a response nobody can parse, and that
		// must not be invisible.
		log.Error("encoding response", slog.String("error", err.Error()))
	}
}
