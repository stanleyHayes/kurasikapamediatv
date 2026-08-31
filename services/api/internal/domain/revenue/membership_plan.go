package revenue

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type BillingInterval string

const (
	IntervalMonthly BillingInterval = "monthly"
	IntervalYearly  BillingInterval = "yearly"
)

var (
	ErrEmptyPlanName     = errors.New("membership plan name cannot be empty")
	ErrEmptyPlanSlug     = errors.New("membership plan slug cannot be empty")
	ErrInvalidInterval   = errors.New("billing interval must be monthly or yearly")
	ErrPlanNeedsBenefits = errors.New("membership plan requires at least one benefit")
)

type MembershipPlanState struct {
	ID          shared.MembershipPlanID
	Name        string
	Slug        string
	Description string
	Interval    BillingInterval
	Price       Money
	Benefits    []string
	Active      bool
	ActivatedAt *time.Time
	CreatedBy   shared.UserID
}

type MembershipPlan struct{ state MembershipPlanState }

func NewMembershipPlan(actor identity.Actor, state MembershipPlanState) (MembershipPlan, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return MembershipPlan{}, err
	}
	state.Name, state.Slug = strings.TrimSpace(state.Name), strings.TrimSpace(state.Slug)
	if state.Name == "" {
		return MembershipPlan{}, ErrEmptyPlanName
	}
	if state.Slug == "" {
		return MembershipPlan{}, ErrEmptyPlanSlug
	}
	if state.Interval != IntervalMonthly && state.Interval != IntervalYearly {
		return MembershipPlan{}, ErrInvalidInterval
	}
	if err := validateMoney(state.Price); err != nil {
		return MembershipPlan{}, err
	}
	state.Benefits = cleanBenefits(state.Benefits)
	if len(state.Benefits) == 0 {
		return MembershipPlan{}, ErrPlanNeedsBenefits
	}
	state.Active, state.ActivatedAt, state.CreatedBy = false, nil, actor.ID()
	return MembershipPlan{state: state}, nil
}

func ReconstituteMembershipPlan(state MembershipPlanState) MembershipPlan {
	state.Benefits = append([]string(nil), state.Benefits...)
	return MembershipPlan{state: state}
}

func (p MembershipPlan) ID() shared.MembershipPlanID { return p.state.ID }
func (p MembershipPlan) State() MembershipPlanState {
	p.state.Benefits = append([]string(nil), p.state.Benefits...)
	return p.state
}
func (p MembershipPlan) Activate(actor identity.Actor, at time.Time) (MembershipPlan, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return MembershipPlan{}, err
	}
	p.state.Active, p.state.ActivatedAt = true, &at
	return p, nil
}

func cleanBenefits(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
