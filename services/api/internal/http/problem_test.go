package http

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
)

func TestProblemFor(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		err    error
		typeID string
		status int
	}{
		{"not found", ports.ErrNotFound, "not_found", http.StatusNotFound},
		{"not permitted", identity.ErrNotPermitted, "not_permitted", http.StatusForbidden},
		{"not own", editorial.ErrNotOwnArticle, "not_own_article", http.StatusForbidden},
		{"slug taken", appeditorial.ErrSlugTaken, "slug_taken", http.StatusConflict},
		{"untitled", appeditorial.ErrUntitled, "invalid_input", http.StatusBadRequest},
		{"illegal transition", editorial.ErrIllegalTransition, "conflict", http.StatusConflict},
		{"unknown", errors.New("boom"), "internal", http.StatusInternalServerError},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := problemFor(tc.err)
			if got.Type != tc.typeID {
				t.Errorf("type = %q, want %q", got.Type, tc.typeID)
			}
			if got.Status != tc.status {
				t.Errorf("status = %d, want %d", got.Status, tc.status)
			}
		})
	}
}

func TestProblemForRecognisesWrappedSlugTaken(t *testing.T) {
	t.Parallel()

	// create_draft wraps ErrSlugTaken with the slug and locale — the transport
	// must still recognise it, or every collision becomes a 500.
	wrapped := fmt.Errorf("%w: %s (%s)", appeditorial.ErrSlugTaken, "budget-2026", "en")

	got := problemFor(wrapped)
	if got.Type != "slug_taken" {
		t.Fatalf("type = %q, want slug_taken", got.Type)
	}
}
