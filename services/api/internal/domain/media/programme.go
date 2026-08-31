package media

import (
	"errors"
	"strings"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrEmptyProgrammeTitle     = errors.New("programme title cannot be empty")
	ErrProgrammeNeedsPresenter = errors.New("programme requires at least one presenter")
)

type ProgrammeState struct {
	ID                                     shared.ProgrammeID
	Title, Slug, Locale, Summary, Category string
	PresenterIDs                           []shared.PresenterID
	ArtworkAssetID                         *shared.AssetID
	Published                              bool
	CreatedBy                              shared.UserID
}

type Programme struct{ state ProgrammeState }

func NewProgramme(actor identity.Actor, state ProgrammeState) (Programme, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return Programme{}, err
	}
	state.Title = strings.TrimSpace(state.Title)
	if state.Title == "" {
		return Programme{}, ErrEmptyProgrammeTitle
	}
	if len(state.PresenterIDs) == 0 {
		return Programme{}, ErrProgrammeNeedsPresenter
	}
	state.Published = false
	state.CreatedBy = actor.ID()
	state.PresenterIDs = append([]shared.PresenterID(nil), state.PresenterIDs...)
	return Programme{state: state}, nil
}

func ReconstituteProgramme(state ProgrammeState) Programme {
	state.PresenterIDs = append([]shared.PresenterID(nil), state.PresenterIDs...)
	return Programme{state: state}
}
func (p Programme) State() ProgrammeState {
	p.state.PresenterIDs = append([]shared.PresenterID(nil), p.state.PresenterIDs...)
	return p.state
}
func (p Programme) ID() shared.ProgrammeID { return p.state.ID }
func (p Programme) Publish(actor identity.Actor) (Programme, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return Programme{}, err
	}
	p.state.Published = true
	return p, nil
}
