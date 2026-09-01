package editorial_test

import (
	"context"
	"testing"

	app "github.com/kurasikapa/api/internal/app/editorial"
	"github.com/kurasikapa/api/internal/domain/editorial"
)

func TestQueueSemanticInventoryBackfillsApprovedPublishedStories(t *testing.T) {
	live := publishedArt("art_live", "live", "cat_news")
	h := newHarness(live, draftArticle("art_draft"))
	revision := editorial.NewRevision("rev_art_live", live.ID(), nil, "Budget", "Approved body", "usr_author", now)
	if err := h.revisions.Append(context.Background(), revision); err != nil {
		t.Fatal(err)
	}

	result, err := app.NewQueueSemanticInventory(h.deps).Execute(context.Background(), []string{"en", "fr"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Queued != 1 || h.semantic.Records[live.ID()].Text == "" {
		t.Fatalf("result=%+v", result)
	}

	again, err := app.NewQueueSemanticInventory(h.deps).Execute(context.Background(), []string{"en"})
	if err != nil || again.Queued != 0 || again.Current != 1 {
		t.Fatalf("again=%+v err=%v", again, err)
	}
}
