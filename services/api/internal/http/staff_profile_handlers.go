package http

import (
	"net/http"

	appidentity "github.com/kurasikapa/api/internal/app/identity"
	domainidentity "github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type staffProfileRequest struct {
	Locale          string                      `json:"locale"`
	DisplayName     string                      `json:"displayName"`
	JobTitle        string                      `json:"jobTitle"`
	Biography       string                      `json:"biography"`
	PortraitAssetID *string                     `json:"portraitAssetId"`
	SocialLinks     []domainidentity.SocialLink `json:"socialLinks"`
}

func (d Deps) handleUpsertStaffProfile(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input staffProfileRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	profile, err := d.UpsertStaffProfile.Execute(r.Context(), actor, profileState(r.PathValue("userId"), input))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, staffProfileStateView(profile))
}

func (d Deps) handlePublishStaffProfile(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	profile, err := d.PublishStaffProfile.Execute(r.Context(), actor, shared.StaffProfileID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, staffProfileStateView(profile))
}

func (d Deps) handleListStaffProfiles(w http.ResponseWriter, r *http.Request) {
	profiles, err := d.ListStaffProfiles.Execute(r.Context(), r.PathValue("locale"))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	views := make([]any, len(profiles))
	for i, profile := range profiles {
		views[i] = publicStaffProfileView(profile)
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"profiles": views})
}

func (d Deps) handleStaffProfileBySlug(w http.ResponseWriter, r *http.Request) {
	profile, err := d.GetStaffProfile.BySlug(r.Context(), r.PathValue("locale"), r.PathValue("slug"))
	writeStaffProfile(w, d, profile, err)
}

func (d Deps) handleStaffProfileByUser(w http.ResponseWriter, r *http.Request) {
	profile, err := d.GetStaffProfile.ByUser(r.Context(), r.PathValue("locale"), shared.UserID(r.PathValue("userId")))
	writeStaffProfile(w, d, profile, err)
}

func writeStaffProfile(w http.ResponseWriter, d Deps, profile appidentity.PublicStaffProfile, err error) {
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, publicStaffProfileView(profile))
}
