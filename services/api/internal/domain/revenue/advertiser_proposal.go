package revenue

import (
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type AdvertiserProposalStatus string

const (
	ProposalSubmitted AdvertiserProposalStatus = "submitted"
	ProposalApproved  AdvertiserProposalStatus = "approved"
	ProposalRejected  AdvertiserProposalStatus = "rejected"
)

var (
	ErrAdvertiserContact = errors.New("advertiser proposal requires a contact name and email")
	ErrProposalReviewed  = errors.New("advertiser proposal has already been reviewed")
	ErrProposalNotOwned  = errors.New("advertiser proposal belongs to another advertiser")
)

type AdvertiserProposalState struct {
	ID           shared.AdvertiserProposalID `json:"id"`
	OwnerID      shared.UserID               `json:"ownerId"`
	ContactName  string                      `json:"contactName"`
	ContactEmail string                      `json:"contactEmail"`
	Campaign     AdCampaignState             `json:"campaign"`
	Status       AdvertiserProposalStatus    `json:"status"`
	SubmittedAt  time.Time                   `json:"submittedAt"`
	ReviewedAt   *time.Time                  `json:"reviewedAt"`
	ReviewedBy   shared.UserID               `json:"reviewedBy"`
	CampaignID   shared.AdCampaignID         `json:"campaignId"`
	ReviewNote   string                      `json:"reviewNote"`
}

type AdvertiserProposal struct{ state AdvertiserProposalState }

func NewAdvertiserProposal(actor identity.Actor, state AdvertiserProposalState, at time.Time) (AdvertiserProposal, error) {
	if err := actor.Require(identity.PermCampaignViewOwn); err != nil {
		return AdvertiserProposal{}, err
	}
	state.ContactName = strings.TrimSpace(state.ContactName)
	state.ContactEmail = strings.TrimSpace(state.ContactEmail)
	if state.ID == "" {
		return AdvertiserProposal{}, shared.ErrEmptyID
	}
	if !validAdvertiserContact(state.ContactName, state.ContactEmail) {
		return AdvertiserProposal{}, ErrAdvertiserContact
	}
	campaign, err := validateAdCampaign(state.Campaign)
	if err != nil {
		return AdvertiserProposal{}, err
	}
	campaign.ID, campaign.Active, campaign.ActivatedAt, campaign.CreatedBy = "", false, nil, ""
	state.OwnerID, state.Campaign = actor.ID(), campaign
	state.Status, state.SubmittedAt = ProposalSubmitted, at
	state.ReviewedAt, state.ReviewedBy = nil, ""
	state.CampaignID, state.ReviewNote = "", ""
	return AdvertiserProposal{state: state}, nil
}

func ReconstituteAdvertiserProposal(state AdvertiserProposalState) AdvertiserProposal {
	return AdvertiserProposal{state: state}
}
func (p AdvertiserProposal) ID() shared.AdvertiserProposalID { return p.state.ID }
func (p AdvertiserProposal) State() AdvertiserProposalState  { return p.state }
func (p AdvertiserProposal) OwnedBy(actor identity.Actor) error {
	if p.state.OwnerID != actor.ID() {
		return ErrProposalNotOwned
	}
	return actor.Require(identity.PermCampaignViewOwn)
}
func (p AdvertiserProposal) Approve(actor identity.Actor, campaignID shared.AdCampaignID, at time.Time) (AdvertiserProposal, error) {
	if campaignID == "" {
		return AdvertiserProposal{}, shared.ErrEmptyID
	}
	return p.review(actor, ProposalApproved, campaignID, "", at)
}
func (p AdvertiserProposal) Reject(actor identity.Actor, note string, at time.Time) (AdvertiserProposal, error) {
	return p.review(actor, ProposalRejected, "", strings.TrimSpace(note), at)
}
func (p AdvertiserProposal) review(actor identity.Actor, status AdvertiserProposalStatus, campaignID shared.AdCampaignID, note string, at time.Time) (AdvertiserProposal, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return AdvertiserProposal{}, err
	}
	if p.state.Status != ProposalSubmitted {
		return AdvertiserProposal{}, ErrProposalReviewed
	}
	p.state.Status, p.state.ReviewedAt = status, &at
	p.state.ReviewedBy, p.state.CampaignID = actor.ID(), campaignID
	p.state.ReviewNote = note
	return p, nil
}

func validAdvertiserContact(name, email string) bool {
	if name == "" || email == "" {
		return false
	}
	address, err := mail.ParseAddress(email)
	return err == nil && address.Address == email
}
