package editorial

import (
	"errors"
	"net/url"
	"strings"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrInvalidArticleNarration   = errors.New("article narration metadata is incomplete")
	ErrNarrationRevisionMismatch = errors.New("narration was not generated from the approved revision")
)

// ArticleNarration is the approved delivery snapshot exposed to readers.
// SourceRevisionID binds the recording to the exact copy an editor reviewed.
type ArticleNarration struct {
	AssetID          shared.AssetID
	SourceRevisionID shared.RevisionID
	SecureURL        string
	MIMEType         string
	DurationSeconds  float64
	Voice            string
}

// SetNarration publishes a generated recording only after a separate editor
// decision. Generating audio alone never mutates an article or exposes it.
func (a Article) SetNarration(narration ArticleNarration, actor identity.Actor) (Article, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return Article{}, err
	}
	if a.approvedRevisionID == nil {
		return Article{}, ErrNoApprovedRevision
	}
	if narration.SourceRevisionID != *a.approvedRevisionID {
		return Article{}, ErrNarrationRevisionMismatch
	}
	if !validNarration(narration) {
		return Article{}, ErrInvalidArticleNarration
	}

	next := a
	next.narration = &narration

	return next, nil
}

// Narration returns the editor-approved recording, if one is attached.
func (a Article) Narration() (ArticleNarration, bool) {
	if a.narration == nil {
		return ArticleNarration{}, false
	}

	return *a.narration, true
}

func validNarration(narration ArticleNarration) bool {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(narration.SecureURL))

	return narration.AssetID != "" && narration.SourceRevisionID != "" &&
		err == nil && parsed.Scheme == "https" && narration.MIMEType == "audio/mpeg" &&
		narration.DurationSeconds > 0 && strings.TrimSpace(narration.Voice) != ""
}
