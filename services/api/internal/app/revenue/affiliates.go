package revenue

import (
	"context"

	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type CreateAffiliateLink struct{ deps Deps }

func NewCreateAffiliateLink(deps Deps) CreateAffiliateLink { return CreateAffiliateLink{deps: deps} }
func (u CreateAffiliateLink) Execute(ctx context.Context, actor identity.Actor, input domainrevenue.AffiliateLinkState) (domainrevenue.AffiliateLink, error) {
	input.ID = shared.AffiliateLinkID(u.deps.IDs.NewID())
	link, err := domainrevenue.NewAffiliateLink(actor, input)
	if err != nil {
		return domainrevenue.AffiliateLink{}, err
	}
	return link, u.deps.AffiliateLinks.Save(ctx, link)
}

type ActivateAffiliateLink struct{ deps Deps }

func NewActivateAffiliateLink(deps Deps) ActivateAffiliateLink {
	return ActivateAffiliateLink{deps: deps}
}
func (u ActivateAffiliateLink) Execute(ctx context.Context, actor identity.Actor, id shared.AffiliateLinkID) (domainrevenue.AffiliateLink, error) {
	link, err := u.deps.AffiliateLinks.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.AffiliateLink{}, err
	}
	link, err = link.Activate(actor, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.AffiliateLink{}, err
	}
	return link, u.deps.AffiliateLinks.Save(ctx, link)
}

type ListAffiliateLinks struct{ deps Deps }

func NewListAffiliateLinks(deps Deps) ListAffiliateLinks { return ListAffiliateLinks{deps: deps} }
func (u ListAffiliateLinks) Execute(ctx context.Context, actor *identity.Actor) ([]domainrevenue.AffiliateLink, error) {
	if actor == nil {
		return u.deps.AffiliateLinks.ListActive(ctx, 100)
	}
	if err := actor.Require(identity.PermRevenueRead); err != nil {
		return nil, err
	}
	return u.deps.AffiliateLinks.ListAll(ctx, 250)
}

type FollowAffiliateLink struct{ deps Deps }

func NewFollowAffiliateLink(deps Deps) FollowAffiliateLink { return FollowAffiliateLink{deps: deps} }
func (u FollowAffiliateLink) Execute(ctx context.Context, id shared.AffiliateLinkID) (string, error) {
	link, err := u.deps.AffiliateLinks.FindByID(ctx, id)
	if err != nil {
		return "", err
	}
	if !link.State().Active {
		return "", domainrevenue.ErrAffiliateInactive
	}
	if err = u.deps.AffiliateLinks.RecordClick(ctx, id, u.deps.Clock.Now()); err != nil {
		return "", err
	}
	return link.State().DestinationURL, nil
}
