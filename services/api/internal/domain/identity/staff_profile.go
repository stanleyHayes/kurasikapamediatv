package identity

import (
	"errors"
	"net/url"
	"strings"

	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrIncompleteStaffProfile    = errors.New("staff profile is incomplete")
	ErrUnsafeSocialLink          = errors.New("staff profile social links must use https")
	ErrStaffProfileNeedsPortrait = errors.New("staff profile requires a portrait before publication")
)

type SocialLink struct {
	Label string
	URL   string
}

type StaffProfileState struct {
	ID              shared.StaffProfileID
	UserID          shared.UserID
	Locale          string
	Slug            shared.Slug
	DisplayName     string
	JobTitle        string
	Biography       string
	PortraitAssetID *shared.AssetID
	SocialLinks     []SocialLink
	Published       bool
	CreatedBy       shared.UserID
	UpdatedBy       shared.UserID
}

type StaffProfile struct{ state StaffProfileState }

func NewStaffProfile(actor Actor, state StaffProfileState) (StaffProfile, error) {
	if err := actor.Require(PermProfileManage); err != nil {
		return StaffProfile{}, err
	}
	state.Published = false
	state.CreatedBy, state.UpdatedBy = actor.ID(), actor.ID()
	return buildStaffProfile(state)
}

func ReconstituteStaffProfile(state StaffProfileState) StaffProfile {
	return StaffProfile{state: copyProfileState(state)}
}

func (p StaffProfile) ID() shared.StaffProfileID { return p.state.ID }

func (p StaffProfile) State() StaffProfileState { return copyProfileState(p.state) }

func (p StaffProfile) Update(actor Actor, changes StaffProfileState) (StaffProfile, error) {
	if err := actor.Require(PermProfileManage); err != nil {
		return StaffProfile{}, err
	}
	changes.ID, changes.UserID = p.state.ID, p.state.UserID
	changes.CreatedBy, changes.UpdatedBy = p.state.CreatedBy, actor.ID()
	changes.Published = false
	return buildStaffProfile(changes)
}

func (p StaffProfile) Publish(actor Actor) (StaffProfile, error) {
	if err := actor.Require(PermProfileManage); err != nil {
		return StaffProfile{}, err
	}
	if p.state.PortraitAssetID == nil {
		return StaffProfile{}, ErrStaffProfileNeedsPortrait
	}
	p.state.Published, p.state.UpdatedBy = true, actor.ID()
	return p, nil
}

func buildStaffProfile(state StaffProfileState) (StaffProfile, error) {
	state.Locale = strings.TrimSpace(state.Locale)
	state.DisplayName = strings.TrimSpace(state.DisplayName)
	state.JobTitle = strings.TrimSpace(state.JobTitle)
	state.Biography = strings.TrimSpace(state.Biography)
	if state.UserID == "" || state.Locale == "" || state.DisplayName == "" || state.JobTitle == "" || state.Biography == "" {
		return StaffProfile{}, ErrIncompleteStaffProfile
	}
	if state.Slug.IsZero() {
		state.Slug = shared.SlugFrom(state.DisplayName)
	}
	if state.Slug.IsZero() {
		return StaffProfile{}, ErrIncompleteStaffProfile
	}
	links, err := cleanSocialLinks(state.SocialLinks)
	if err != nil {
		return StaffProfile{}, err
	}
	state.SocialLinks = links
	return StaffProfile{state: copyProfileState(state)}, nil
}

func cleanSocialLinks(links []SocialLink) ([]SocialLink, error) {
	out := make([]SocialLink, len(links))
	for i, link := range links {
		link.Label, link.URL = strings.TrimSpace(link.Label), strings.TrimSpace(link.URL)
		parsed, err := url.Parse(link.URL)
		if err != nil || link.Label == "" || parsed.Scheme != "https" || parsed.Host == "" {
			return nil, ErrUnsafeSocialLink
		}
		out[i] = link
	}
	return out, nil
}

func copyProfileState(state StaffProfileState) StaffProfileState {
	state.SocialLinks = append([]SocialLink(nil), state.SocialLinks...)
	if state.PortraitAssetID != nil {
		portrait := *state.PortraitAssetID
		state.PortraitAssetID = &portrait
	}
	return state
}
