package editorial_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/identity"
)

func TestAssertReadable(t *testing.T) {
	t.Parallel()

	if err := anArticle().AssertReadable(author()); err != nil {
		t.Errorf("author should read own draft: %v", err)
	}
	if err := anArticle().AssertReadable(subscriber()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Errorf("got %v, want ErrNotPermitted", err)
	}
}

func TestAssertEditable(t *testing.T) {
	t.Parallel()

	if err := anArticle().AssertEditable(author()); err != nil {
		t.Errorf("author should edit own draft: %v", err)
	}
	inReview := anArticle(func(s *editorial.ArticleState) { s.Status = editorial.StatusInReview })
	if err := inReview.AssertEditable(author()); !errors.Is(err, editorial.ErrNotEditable) {
		t.Errorf("got %v, want ErrNotEditable", err)
	}
}
