package identity

import (
	"errors"
	"fmt"

	"github.com/kurasikapa/api/internal/domain/shared"
)

// ErrNotPermitted is returned when an actor lacks a required permission.
//
// Deliberately says nothing about the resource. Telling someone with no
// editorial permission that an article "belongs to another author" leaks who
// wrote an unpublished draft.
var ErrNotPermitted = errors.New("not permitted")

// Actor is an authenticated person, resolved to what they may do.
//
// Roles are read from our own store on every resolution rather than carried in
// a session token, so a revocation takes effect on the next request instead of
// whenever the token happens to expire.
type Actor struct {
	id          shared.UserID
	roles       []Role
	permissions map[Permission]struct{}
}

// NewActor builds an actor from an id and the roles currently granted to them.
//
// Unknown role strings are dropped rather than rejected: a role removed from
// the codebase should degrade a person's access, not lock them out of a system
// that no longer understands their grant.
func NewActor(id shared.UserID, roles []Role) Actor {
	known := make([]Role, 0, len(roles))

	for _, role := range roles {
		if IsKnownRole(string(role)) {
			known = append(known, role)
		}
	}

	return Actor{id: id, roles: known, permissions: PermissionsOf(known)}
}

// ID returns the actor's user id.
func (a Actor) ID() shared.UserID { return a.id }

// Roles returns a copy of the actor's known roles.
func (a Actor) Roles() []Role {
	out := make([]Role, len(a.roles))
	copy(out, a.roles)

	return out
}

// Can reports whether the actor holds a permission.
func (a Actor) Can(p Permission) bool {
	_, ok := a.permissions[p]

	return ok
}

// Require returns ErrNotPermitted unless the actor holds the permission.
//
// Callers should prefer this over Can when the answer is a guard, so the error
// message stays uniform and uninformative to an attacker.
func (a Actor) Require(p Permission) error {
	if !a.Can(p) {
		return fmt.Errorf("%w: %s", ErrNotPermitted, p)
	}

	return nil
}
