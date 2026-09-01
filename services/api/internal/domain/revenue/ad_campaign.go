package revenue

import (
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type AdSlot string

const (
	SlotHomeLeaderboard AdSlot = "home_leaderboard"
	SlotArticleInline   AdSlot = "article_inline"
	SlotLiveCompanion   AdSlot = "live_companion"
)

var (
	ErrInvalidAdSlot      = errors.New("ad slot is not supported")
	ErrInvalidAdLocale    = errors.New("campaign locale must be en, fr or *")
	ErrInvalidAdWindow    = errors.New("campaign end must follow its start")
	ErrInvalidAdURL       = errors.New("creative and landing URLs must use HTTPS")
	ErrInvalidAdRate      = errors.New("CPM must be positive and no greater than budget")
	ErrIncompleteCampaign = errors.New("campaign requires name, advertiser and accessible creative text")
	ErrCampaignEnded      = errors.New("an ended campaign cannot be activated")
)

type AdCampaignState struct {
	ID                   shared.AdCampaignID
	Name, Advertiser     string
	Locale               string
	Slot                 AdSlot
	CreativeURL, AltText string
	LandingURL           string
	Budget               Money
	CPMMinor             int64
	Priority             int
	StartsAt, EndsAt     time.Time
	Active               bool
	ActivatedAt          *time.Time
	CreatedBy            shared.UserID
}

type AdCampaign struct{ state AdCampaignState }

func NewAdCampaign(actor identity.Actor, state AdCampaignState) (AdCampaign, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return AdCampaign{}, err
	}
	if state.ID == "" {
		return AdCampaign{}, shared.ErrEmptyID
	}
	state, err := validateAdCampaign(state)
	if err != nil {
		return AdCampaign{}, err
	}
	state.Active, state.ActivatedAt, state.CreatedBy = false, nil, actor.ID()
	return AdCampaign{state: state}, nil
}

func validateAdCampaign(state AdCampaignState) (AdCampaignState, error) {
	state.Name, state.Advertiser, state.AltText = strings.TrimSpace(state.Name), strings.TrimSpace(state.Advertiser), strings.TrimSpace(state.AltText)
	if state.Name == "" || state.Advertiser == "" || state.AltText == "" {
		return AdCampaignState{}, ErrIncompleteCampaign
	}
	if !knownSlot(state.Slot) {
		return AdCampaignState{}, ErrInvalidAdSlot
	}
	if state.Locale != "en" && state.Locale != "fr" && state.Locale != "*" {
		return AdCampaignState{}, ErrInvalidAdLocale
	}
	if !secureURL(state.CreativeURL) || !secureURL(state.LandingURL) {
		return AdCampaignState{}, ErrInvalidAdURL
	}
	if err := validateMoney(state.Budget); err != nil {
		return AdCampaignState{}, err
	}
	if state.CPMMinor <= 0 || state.CPMMinor > state.Budget.Minor {
		return AdCampaignState{}, ErrInvalidAdRate
	}
	if !state.EndsAt.After(state.StartsAt) {
		return AdCampaignState{}, ErrInvalidAdWindow
	}
	if state.Priority < 1 || state.Priority > 100 {
		state.Priority = 50
	}
	return state, nil
}

func ReconstituteAdCampaign(state AdCampaignState) AdCampaign { return AdCampaign{state: state} }
func (c AdCampaign) ID() shared.AdCampaignID                  { return c.state.ID }
func (c AdCampaign) State() AdCampaignState                   { return c.state }
func (c AdCampaign) Activate(actor identity.Actor, at time.Time) (AdCampaign, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return AdCampaign{}, err
	}
	if !at.Before(c.state.EndsAt) {
		return AdCampaign{}, ErrCampaignEnded
	}
	c.state.Active, c.state.ActivatedAt = true, &at
	return c, nil
}
func (c AdCampaign) Eligible(slot AdSlot, locale string, at time.Time, impressions int64) bool {
	return c.state.Active && c.state.Slot == slot && (c.state.Locale == "*" || c.state.Locale == locale) && !at.Before(c.state.StartsAt) && at.Before(c.state.EndsAt) && c.EstimatedSpend(impressions) < c.state.Budget.Minor
}
func (c AdCampaign) EstimatedSpend(impressions int64) int64 {
	return impressions * c.state.CPMMinor / 1000
}

func knownSlot(slot AdSlot) bool {
	return slot == SlotHomeLeaderboard || slot == SlotArticleInline || slot == SlotLiveCompanion
}
func secureURL(raw string) bool {
	parsed, err := url.ParseRequestURI(raw)
	return err == nil && parsed.Scheme == "https" && parsed.Host != ""
}
