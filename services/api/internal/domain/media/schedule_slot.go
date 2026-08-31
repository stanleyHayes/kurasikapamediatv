package media

import (
	"errors"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type ScheduleState string

const (
	ScheduleScheduled ScheduleState = "scheduled"
	ScheduleCancelled ScheduleState = "cancelled"
	ScheduleCompleted ScheduleState = "completed"
)

var (
	ErrScheduleInPast         = errors.New("schedule slot must start in the future")
	ErrInvalidScheduleWindow  = errors.New("schedule slot must end after it starts")
	ErrSlotAlreadyCancelled   = errors.New("schedule slot already cancelled")
	ErrReplayNeedsCaptions    = errors.New("recorded replay requires captions")
	ErrReplayBeforeSlotEnds   = errors.New("recorded replay cannot publish before the slot ends")
	ErrReplayAlreadyPublished = errors.New("recorded replay is already published")
	ErrReplayNotAwaiting      = errors.New("schedule slot is not awaiting a replay")
)

type ScheduleSlotState struct {
	ID                            shared.ScheduleSlotID
	ProgrammeID                   shared.ProgrammeID
	Locale                        string
	StartsAt, EndsAt              time.Time
	IsLive                        bool
	State                         ScheduleState
	ReplayAssetID, CaptionAssetID *shared.AssetID
	CreatedBy                     shared.UserID
}
type ScheduleSlot struct{ state ScheduleSlotState }

func NewScheduleSlot(actor identity.Actor, state ScheduleSlotState, now time.Time) (ScheduleSlot, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return ScheduleSlot{}, err
	}
	if !state.StartsAt.After(now) {
		return ScheduleSlot{}, ErrScheduleInPast
	}
	if !state.EndsAt.After(state.StartsAt) {
		return ScheduleSlot{}, ErrInvalidScheduleWindow
	}
	state.State, state.CreatedBy = ScheduleScheduled, actor.ID()
	state.ReplayAssetID, state.CaptionAssetID = nil, nil
	return ScheduleSlot{state: state}, nil
}
func ReconstituteScheduleSlot(state ScheduleSlotState) ScheduleSlot {
	return ScheduleSlot{state: state}
}
func (s ScheduleSlot) State() ScheduleSlotState  { return s.state }
func (s ScheduleSlot) ID() shared.ScheduleSlotID { return s.state.ID }
func (s ScheduleSlot) Cancel(actor identity.Actor) (ScheduleSlot, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return ScheduleSlot{}, err
	}
	if s.state.State == ScheduleCancelled {
		return ScheduleSlot{}, ErrSlotAlreadyCancelled
	}
	s.state.State = ScheduleCancelled
	return s, nil
}
func (s ScheduleSlot) PublishReplay(actor identity.Actor, replay shared.AssetID, captions *shared.AssetID, now time.Time) (ScheduleSlot, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return ScheduleSlot{}, err
	}
	if s.state.State == ScheduleCompleted {
		return ScheduleSlot{}, ErrReplayAlreadyPublished
	}
	if s.state.State != ScheduleScheduled || !s.state.IsLive {
		return ScheduleSlot{}, ErrReplayNotAwaiting
	}
	if now.Before(s.state.EndsAt) {
		return ScheduleSlot{}, ErrReplayBeforeSlotEnds
	}
	if captions == nil {
		return ScheduleSlot{}, ErrReplayNeedsCaptions
	}
	s.state.State, s.state.ReplayAssetID, s.state.CaptionAssetID = ScheduleCompleted, &replay, captions
	return s, nil
}
