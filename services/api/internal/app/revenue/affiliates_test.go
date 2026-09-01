package revenue_test

import (
	"context"
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/app/ports"
	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
)

func affiliateInput() domainrevenue.AffiliateLinkState {
	return domainrevenue.AffiliateLinkState{Partner: "Akwaaba Books", Title: "Ghanaian history collection", Category: "Books", Description: "A carefully selected collection from Ghanaian writers.", Disclosure: "Kurasikapa may earn a commission from this link.", ImageURL: "https://cdn.example.com/books.jpg", ImageAlt: "A collection of Ghanaian books", DestinationURL: "https://partner.example.com/ghana-books"}
}
func affiliateDeps() (apprevenue.Deps, *fakes.AffiliateLinkStore) {
	store := fakes.NewAffiliateLinkStore()
	return apprevenue.Deps{AffiliateLinks: store, Clock: fixedClock{}, IDs: &ids{}}, store
}

func TestAffiliateApplicationLifecycleAndTracking(t *testing.T) {
	deps, store := affiliateDeps()
	link, err := apprevenue.NewCreateAffiliateLink(deps).Execute(context.Background(), admin(), affiliateInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, err = apprevenue.NewFollowAffiliateLink(deps).Execute(context.Background(), link.ID()); !errors.Is(err, domainrevenue.ErrAffiliateInactive) {
		t.Fatal(err)
	}
	link, err = apprevenue.NewActivateAffiliateLink(deps).Execute(context.Background(), admin(), link.ID())
	if err != nil || !link.State().Active {
		t.Fatal(link.State(), err)
	}
	destination, err := apprevenue.NewFollowAffiliateLink(deps).Execute(context.Background(), link.ID())
	if err != nil || destination != link.State().DestinationURL || store.Clicks != 1 {
		t.Fatal(destination, store.Clicks, err)
	}
	if rows, err := apprevenue.NewListAffiliateLinks(deps).Execute(context.Background(), nil); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	actor := admin()
	if rows, err := apprevenue.NewListAffiliateLinks(deps).Execute(context.Background(), &actor); err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
}

func TestAffiliateApplicationRejectsInvalidActorsAndMissingLinks(t *testing.T) {
	deps, _ := affiliateDeps()
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := apprevenue.NewCreateAffiliateLink(deps).Execute(context.Background(), guest, affiliateInput()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewActivateAffiliateLink(deps).Execute(context.Background(), admin(), "missing"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewFollowAffiliateLink(deps).Execute(context.Background(), "missing"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatal(err)
	}
	if _, err := apprevenue.NewListAffiliateLinks(deps).Execute(context.Background(), &guest); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
}
