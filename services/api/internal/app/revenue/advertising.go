package revenue

import (
	"context"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type CreateAdCampaign struct{ deps Deps }

func NewCreateAdCampaign(deps Deps) CreateAdCampaign { return CreateAdCampaign{deps: deps} }
func (u CreateAdCampaign) Execute(ctx context.Context, actor identity.Actor, input domainrevenue.AdCampaignState) (domainrevenue.AdCampaign, error) {
	input.ID = shared.AdCampaignID(u.deps.IDs.NewID())
	campaign, err := domainrevenue.NewAdCampaign(actor, input)
	if err != nil {
		return domainrevenue.AdCampaign{}, err
	}
	return campaign, u.deps.AdCampaigns.Save(ctx, campaign)
}

type ActivateAdCampaign struct{ deps Deps }

func NewActivateAdCampaign(deps Deps) ActivateAdCampaign { return ActivateAdCampaign{deps: deps} }
func (u ActivateAdCampaign) Execute(ctx context.Context, actor identity.Actor, id shared.AdCampaignID) (domainrevenue.AdCampaign, error) {
	campaign, err := u.deps.AdCampaigns.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.AdCampaign{}, err
	}
	campaign, err = campaign.Activate(actor, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.AdCampaign{}, err
	}
	return campaign, u.deps.AdCampaigns.Save(ctx, campaign)
}

type ResolveAdPlacement struct{ deps Deps }

func NewResolveAdPlacement(deps Deps) ResolveAdPlacement { return ResolveAdPlacement{deps: deps} }
func (u ResolveAdPlacement) Execute(ctx context.Context, slot domainrevenue.AdSlot, locale string) (*domainrevenue.AdCampaign, error) {
	now := u.deps.Clock.Now()
	campaigns, err := u.deps.AdCampaigns.ListEligible(ctx, slot, locale, now, 10)
	if err != nil {
		return nil, err
	}
	for _, campaign := range campaigns {
		count, countErr := u.deps.AdEvents.CountForCampaign(ctx, campaign.ID(), domainrevenue.AdImpression)
		if countErr != nil {
			return nil, countErr
		}
		if campaign.Eligible(slot, locale, now, count) {
			return &campaign, nil
		}
	}
	return nil, nil
}

type RecordAdEvent struct{ deps Deps }

func NewRecordAdEvent(deps Deps) RecordAdEvent { return RecordAdEvent{deps: deps} }
func (u RecordAdEvent) Execute(ctx context.Context, campaignID shared.AdCampaignID, kind domainrevenue.AdEventKind) (domainrevenue.AdEvent, error) {
	if _, err := u.deps.AdCampaigns.FindByID(ctx, campaignID); err != nil {
		return domainrevenue.AdEvent{}, err
	}
	event, err := domainrevenue.NewAdEvent(shared.AdEventID(u.deps.IDs.NewID()), campaignID, kind, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.AdEvent{}, err
	}
	return event, u.deps.AdEvents.Append(ctx, event)
}

type AdCampaignReport struct {
	ID, Name, Advertiser string
	Slot                 domainrevenue.AdSlot
	Active               bool
	Budget               domainrevenue.Money
	Impressions, Clicks  int64
	EstimatedSpendMinor  int64
	CTR                  float64
	StartsAt, EndsAt     time.Time
}

type BuildAdReport struct{ deps Deps }

func NewBuildAdReport(deps Deps) BuildAdReport { return BuildAdReport{deps: deps} }
func (u BuildAdReport) Execute(ctx context.Context, actor identity.Actor) ([]AdCampaignReport, error) {
	if err := actor.Require(identity.PermRevenueRead); err != nil {
		return nil, err
	}
	campaigns, err := u.deps.AdCampaigns.ListAll(ctx, 250)
	if err != nil {
		return nil, err
	}
	report := make([]AdCampaignReport, 0, len(campaigns))
	for _, campaign := range campaigns {
		row, rowErr := u.row(ctx, campaign)
		if rowErr != nil {
			return nil, rowErr
		}
		report = append(report, row)
	}
	return report, nil
}

func (u BuildAdReport) row(ctx context.Context, campaign domainrevenue.AdCampaign) (AdCampaignReport, error) {
	impressions, err := u.deps.AdEvents.CountForCampaign(ctx, campaign.ID(), domainrevenue.AdImpression)
	if err != nil {
		return AdCampaignReport{}, err
	}
	clicks, err := u.deps.AdEvents.CountForCampaign(ctx, campaign.ID(), domainrevenue.AdClick)
	if err != nil {
		return AdCampaignReport{}, err
	}
	state := campaign.State()
	ctr := float64(0)
	if impressions > 0 {
		ctr = float64(clicks) / float64(impressions) * 100
	}
	return AdCampaignReport{ID: state.ID.String(), Name: state.Name, Advertiser: state.Advertiser, Slot: state.Slot, Active: state.Active, Budget: state.Budget, Impressions: impressions, Clicks: clicks, EstimatedSpendMinor: campaign.EstimatedSpend(impressions), CTR: ctr, StartsAt: state.StartsAt, EndsAt: state.EndsAt}, nil
}
