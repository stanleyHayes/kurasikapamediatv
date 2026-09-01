package revenue

import (
	"errors"
	"net/url"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrAffiliateIdentity = errors.New("affiliate link requires partner, title and category")
	ErrAffiliateCopy     = errors.New("affiliate link requires description, disclosure and accessible image")
	ErrAffiliateURL      = errors.New("affiliate destination must be an https URL")
	ErrAffiliateInactive = errors.New("affiliate link is not active")
)

type AffiliateLinkState struct {
	ID             shared.AffiliateLinkID `json:"id"`
	Partner        string                 `json:"partner"`
	Title          string                 `json:"title"`
	Category       string                 `json:"category"`
	Description    string                 `json:"description"`
	Disclosure     string                 `json:"disclosure"`
	ImageURL       string                 `json:"imageURL"`
	ImageAlt       string                 `json:"imageAlt"`
	DestinationURL string                 `json:"destinationURL"`
	CommissionNote string                 `json:"commissionNote"`
	Active         bool                   `json:"active"`
	ActivatedAt    *time.Time             `json:"activatedAt"`
	CreatedBy      shared.UserID          `json:"createdBy"`
	Clicks         int64                  `json:"clicks"`
}

type AffiliateLink struct{ state AffiliateLinkState }

func NewAffiliateLink(actor identity.Actor, state AffiliateLinkState) (AffiliateLink, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return AffiliateLink{}, err
	}
	state.Partner, state.Title, state.Category = trim3(state.Partner, state.Title, state.Category)
	state.Description, state.Disclosure, state.ImageAlt = trim3(state.Description, state.Disclosure, state.ImageAlt)
	state.ImageURL, state.DestinationURL, state.CommissionNote = trim3(state.ImageURL, state.DestinationURL, state.CommissionNote)
	if state.ID == "" {
		return AffiliateLink{}, shared.ErrEmptyID
	}
	if state.Partner == "" || state.Title == "" || state.Category == "" {
		return AffiliateLink{}, ErrAffiliateIdentity
	}
	if state.Description == "" || state.Disclosure == "" || state.ImageAlt == "" || !isHTTPS(state.ImageURL) {
		return AffiliateLink{}, ErrAffiliateCopy
	}
	if !isHTTPS(state.DestinationURL) {
		return AffiliateLink{}, ErrAffiliateURL
	}
	state.Active, state.ActivatedAt, state.CreatedBy, state.Clicks = false, nil, actor.ID(), 0
	return AffiliateLink{state: state}, nil
}

func isHTTPS(raw string) bool {
	parsed, err := url.Parse(raw)
	return err == nil && parsed.Scheme == "https" && parsed.Host != ""
}
func ReconstituteAffiliateLink(state AffiliateLinkState) AffiliateLink {
	return AffiliateLink{state: state}
}
func (a AffiliateLink) ID() shared.AffiliateLinkID { return a.state.ID }
func (a AffiliateLink) State() AffiliateLinkState  { return a.state }
func (a AffiliateLink) Activate(actor identity.Actor, at time.Time) (AffiliateLink, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return AffiliateLink{}, err
	}
	a.state.Active, a.state.ActivatedAt = true, &at
	return a, nil
}
