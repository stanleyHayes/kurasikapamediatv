package revenue_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func affiliateState() revenue.AffiliateLinkState {
	return revenue.AffiliateLinkState{ID: "affiliate-1", Partner: "Akwaaba Books", Title: "Read more Ghanaian history", Category: "Books", Description: "A carefully selected collection from Ghanaian writers.", Disclosure: "Kurasikapa may earn a commission from this link.", ImageURL: "https://cdn.example.com/books.jpg", ImageAlt: "A collection of Ghanaian books", DestinationURL: "https://partner.example.com/ghana-books", CommissionNote: "Ten percent on completed orders"}
}

func TestAffiliateLinkRequiresPermissionAndDisclosure(t *testing.T) {
	guest := identity.NewActor("guest", []identity.Role{identity.RoleGuest})
	if _, err := revenue.NewAffiliateLink(guest, affiliateState()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
	link, err := revenue.NewAffiliateLink(commerceManager(), affiliateState())
	if err != nil || link.State().Active || link.State().Clicks != 0 {
		t.Fatal(link.State(), err)
	}
	active, err := link.Activate(commerceManager(), time.Now())
	if err != nil || !active.State().Active || active.State().ActivatedAt == nil {
		t.Fatal(active.State(), err)
	}
	if _, err = link.Activate(guest, time.Now()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
}

func TestAffiliateLinkRejectsUnsafeOrIncompleteInput(t *testing.T) {
	tests := []struct {
		name string
		edit func(*revenue.AffiliateLinkState)
		want error
	}{
		{"empty id", func(s *revenue.AffiliateLinkState) { s.ID = "" }, shared.ErrEmptyID},
		{"identity", func(s *revenue.AffiliateLinkState) { s.Partner = " " }, revenue.ErrAffiliateIdentity},
		{"copy", func(s *revenue.AffiliateLinkState) { s.Disclosure = "" }, revenue.ErrAffiliateCopy},
		{"image", func(s *revenue.AffiliateLinkState) { s.ImageURL = "http://cdn.example.com/image.jpg" }, revenue.ErrAffiliateCopy},
		{"destination scheme", func(s *revenue.AffiliateLinkState) { s.DestinationURL = "javascript:alert(1)" }, revenue.ErrAffiliateURL},
		{"destination host", func(s *revenue.AffiliateLinkState) { s.DestinationURL = "https:///missing-host" }, revenue.ErrAffiliateURL},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			state := affiliateState()
			tc.edit(&state)
			_, err := revenue.NewAffiliateLink(commerceManager(), state)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v want %v", err, tc.want)
			}
		})
	}
}

func TestAffiliateLinkReconstitutionPreservesReporting(t *testing.T) {
	state := affiliateState()
	state.Active = true
	state.Clicks = 17
	link := revenue.ReconstituteAffiliateLink(state)
	if link.ID() != "affiliate-1" || link.State().Clicks != 17 {
		t.Fatal(link.State())
	}
}
