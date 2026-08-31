package http

import (
	appidentity "github.com/kurasikapa/api/internal/app/identity"
	domainidentity "github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func profileState(userID string, input staffProfileRequest) domainidentity.StaffProfileState {
	state := domainidentity.StaffProfileState{
		UserID: shared.UserID(userID), Locale: input.Locale, DisplayName: input.DisplayName,
		JobTitle: input.JobTitle, Biography: input.Biography, SocialLinks: input.SocialLinks,
	}
	if input.PortraitAssetID != nil {
		portrait := shared.AssetID(*input.PortraitAssetID)
		state.PortraitAssetID = &portrait
	}
	return state
}

func staffProfileStateView(profile domainidentity.StaffProfile) map[string]any {
	state := profile.State()
	return map[string]any{
		"id": state.ID.String(), "userId": state.UserID.String(), "locale": state.Locale,
		"slug": state.Slug.String(), "displayName": state.DisplayName, "jobTitle": state.JobTitle,
		"biography": state.Biography, "portraitAssetId": state.PortraitAssetID,
		"socialLinks": state.SocialLinks, "published": state.Published,
	}
}

func publicStaffProfileView(entry appidentity.PublicStaffProfile) map[string]any {
	view := staffProfileStateView(entry.Profile)
	portrait := entry.Portrait.State()
	view["portrait"] = map[string]any{
		"url": portrait.SecureURL, "altText": portrait.AltText,
		"width": portrait.Width, "height": portrait.Height,
	}
	return view
}
