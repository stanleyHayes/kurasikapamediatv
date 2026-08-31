package editorial_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func narration() editorial.ArticleNarration {
	return editorial.ArticleNarration{
		AssetID:          shared.AssetID("audio_1"),
		SourceRevisionID: revID,
		SecureURL:        "https://res.cloudinary.com/demo/video/upload/story.mp3",
		MIMEType:         "audio/mpeg",
		DurationSeconds:  185.4,
		Voice:            "Amy",
	}
}

func approvedArticle() editorial.Article {
	return anArticle(func(state *editorial.ArticleState) {
		state.Status = editorial.StatusApproved
		state.ApprovedRevisionID = &revID
	})
}

func TestArticleNarrationRequiresApprovedAccessibleAudio(t *testing.T) {
	t.Parallel()

	attached, err := approvedArticle().SetNarration(narration(), editor())
	if err != nil {
		t.Fatal(err)
	}
	got, ok := attached.Narration()
	if !ok || got != narration() {
		t.Fatalf("narration = %#v, %v", got, ok)
	}

	if _, err = approvedArticle().SetNarration(narration(), author()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("author error = %v, want ErrNotPermitted", err)
	}

	invalid := narration()
	invalid.SecureURL = "http://cdn.test/story.mp3"
	if _, err = approvedArticle().SetNarration(invalid, editor()); !errors.Is(err, editorial.ErrInvalidArticleNarration) {
		t.Fatalf("invalid audio error = %v, want ErrInvalidArticleNarration", err)
	}

	stale := narration()
	stale.SourceRevisionID = shared.RevisionID("rev_old")
	if _, err = approvedArticle().SetNarration(stale, editor()); !errors.Is(err, editorial.ErrNarrationRevisionMismatch) {
		t.Fatalf("stale audio error = %v, want ErrNarrationRevisionMismatch", err)
	}
}

func TestArticleNarrationIsWithdrawnWhenApprovedTextChanges(t *testing.T) {
	t.Parallel()

	withAudio, err := approvedArticle().SetNarration(narration(), editor())
	if err != nil {
		t.Fatal(err)
	}

	inReview := editorial.Reconstitute(func() editorial.ArticleState {
		state := withAudio.State()
		state.Status = editorial.StatusInReview
		return state
	}())
	newRevision := shared.RevisionID("rev_2")
	reapproved, err := inReview.Approve(newRevision, articleID, editor())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := reapproved.Narration(); ok {
		t.Fatal("narration for an older revision survived approval of new text")
	}

	rejected, err := editorial.Reconstitute(func() editorial.ArticleState {
		state := withAudio.State()
		state.Status = editorial.StatusInReview
		return state
	}()).Reject(editor())
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := rejected.Narration(); ok {
		t.Fatal("narration survived rejection of its source text")
	}
}
