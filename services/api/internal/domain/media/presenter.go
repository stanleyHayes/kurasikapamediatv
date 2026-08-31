// Package media owns station programming and replay rules.
package media

import (
	"errors"
	"strings"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrEmptyPresenterName = errors.New("presenter name cannot be empty")

type PresenterState struct {
	ID                                  shared.PresenterID
	Name, Slug, Locale, Role, Biography string
	PortraitAssetID                     *shared.AssetID
	Published                           bool
	CreatedBy                           shared.UserID
}

type Presenter struct{ state PresenterState }

func NewPresenter(actor identity.Actor, state PresenterState) (Presenter, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return Presenter{}, err
	}
	state.Name = strings.TrimSpace(state.Name)
	if state.Name == "" {
		return Presenter{}, ErrEmptyPresenterName
	}
	state.Published = false
	state.CreatedBy = actor.ID()
	return Presenter{state: state}, nil
}

func ReconstitutePresenter(state PresenterState) Presenter { return Presenter{state: state} }
func (p Presenter) State() PresenterState                  { return p.state }
func (p Presenter) ID() shared.PresenterID                 { return p.state.ID }
func (p Presenter) Publish(actor identity.Actor) (Presenter, error) {
	if err := actor.Require(identity.PermStreamManage); err != nil {
		return Presenter{}, err
	}
	p.state.Published = true
	return p, nil
}
