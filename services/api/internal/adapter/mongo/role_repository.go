package mongo

import (
	"context"
	"errors"
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// RoleRepository is the MongoDB implementation of ports.RoleRepository.
//
// Roles live in our own collection, keyed by the auth library's user id. They
// are never written into Better Auth's user document: that collection belongs
// to the library, and reading it is the only thing we do there.
//
// The key is the user id as a HEX STRING. Better Auth lets Mongo mint the
// user's `_id` as an ObjectId while its API reports `user.id` as hex, and
// storing an ObjectId here would mean every lookup misses — an editor resolves
// with no roles and is silently bounced out of the studio. That is not
// hypothetical; it shipped once and took a stale-build bug to uncover.
type RoleRepository struct {
	assignments *mongo.Collection
}

// NewRoleRepository wires the repository.
func NewRoleRepository(db *mongo.Database) *RoleRepository {
	return &RoleRepository{assignments: db.Collection(CollRoleAssignments)}
}

// RolesFor returns the roles granted to a user.
//
// An absent document is no roles, not an error. Most signed-in people are
// readers with no grant at all, and making that the error path would turn the
// common case into an exception.
func (r *RoleRepository) RolesFor(ctx context.Context, userID shared.UserID) ([]identity.Role, error) {
	var doc roleAssignmentDoc

	err := r.assignments.FindOne(ctx, bson.M{"_id": userID.String()}).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return []identity.Role{}, nil
		}

		return nil, fmt.Errorf("finding roles for %s: %w", userID, err)
	}

	// Storage is not a trust boundary. A role removed from the codebase must
	// not arrive from the database as a live grant that resolves to nothing.
	roles := make([]identity.Role, 0, len(doc.Roles))
	for _, raw := range doc.Roles {
		if identity.IsKnownRole(raw) {
			roles = append(roles, identity.Role(raw))
		}
	}

	return roles, nil
}

// Replace sets a user's complete role set.
//
// Replace, not merge. "Grant" and "revoke" as separate operations invite a UI
// that shows a checkbox list and forgets to send the unchecked ones, which
// fails open. Sending the whole set means the absent ones are absent on purpose.
func (r *RoleRepository) Replace(ctx context.Context, userID shared.UserID, roles []identity.Role) error {
	if len(roles) == 0 {
		// No empty document left behind: absence and "granted nothing" are the
		// same state, and one row per signed-up reader is pure waste.
		if _, err := r.assignments.DeleteOne(ctx, bson.M{"_id": userID.String()}); err != nil {
			return fmt.Errorf("clearing roles for %s: %w", userID, err)
		}

		return nil
	}

	raw := make([]string, 0, len(roles))
	for _, role := range roles {
		raw = append(raw, string(role))
	}

	_, err := r.assignments.UpdateOne(
		ctx,
		bson.M{"_id": userID.String()},
		bson.M{"$set": bson.M{"roles": raw}},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return fmt.Errorf("replacing roles for %s: %w", userID, err)
	}

	return nil
}
