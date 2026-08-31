package mongo

import (
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func staffProfileToDoc(profile identity.StaffProfile) staffProfileDoc {
	state := profile.State()
	doc := staffProfileDoc{
		ID: state.ID.String(), UserID: state.UserID.String(), Locale: state.Locale,
		Slug: state.Slug.String(), DisplayName: state.DisplayName, JobTitle: state.JobTitle,
		Biography: state.Biography, Published: state.Published,
		CreatedBy: state.CreatedBy.String(), UpdatedBy: state.UpdatedBy.String(),
		SocialLinks: make([]socialLinkDoc, len(state.SocialLinks)),
	}
	if state.PortraitAssetID != nil {
		portrait := state.PortraitAssetID.String()
		doc.PortraitAssetID = &portrait
	}
	for i, link := range state.SocialLinks {
		doc.SocialLinks[i] = socialLinkDoc{Label: link.Label, URL: link.URL}
	}
	return doc
}

func staffProfileToDomain(doc staffProfileDoc) identity.StaffProfile {
	slug, _ := shared.NewSlug(doc.Slug)
	state := identity.StaffProfileState{
		ID: shared.StaffProfileID(doc.ID), UserID: shared.UserID(doc.UserID), Locale: doc.Locale,
		Slug: slug, DisplayName: doc.DisplayName, JobTitle: doc.JobTitle, Biography: doc.Biography,
		Published: doc.Published, CreatedBy: shared.UserID(doc.CreatedBy), UpdatedBy: shared.UserID(doc.UpdatedBy),
		SocialLinks: make([]identity.SocialLink, len(doc.SocialLinks)),
	}
	if doc.PortraitAssetID != nil {
		portrait := shared.AssetID(*doc.PortraitAssetID)
		state.PortraitAssetID = &portrait
	}
	for i, link := range doc.SocialLinks {
		state.SocialLinks[i] = identity.SocialLink{Label: link.Label, URL: link.URL}
	}
	return identity.ReconstituteStaffProfile(state)
}
