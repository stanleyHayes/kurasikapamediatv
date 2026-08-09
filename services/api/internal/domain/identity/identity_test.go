package identity_test

import (
	"errors"
	"testing"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestRolePermissions(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		role  identity.Role
		perm  identity.Permission
		grant bool
	}{
		{"an editor may approve", identity.RoleEditor, identity.PermArticleApprove, true},
		{"an editor may edit any article", identity.RoleEditor, identity.PermArticleEditAny, true},
		{"an editor may not assign roles", identity.RoleEditor, identity.PermRoleAssign, false},
		{"an author may draft", identity.RoleAuthor, identity.PermArticleDraft, true},
		{"an author may not approve", identity.RoleAuthor, identity.PermArticleApprove, false},
		{"a journalist may upload images", identity.RoleJournalist, identity.PermAssetUploadImage, true},
		{"a subscriber may do nothing editorial", identity.RoleSubscriber, identity.PermArticleDraft, false},
		{"a guest may do nothing editorial", identity.RoleGuest, identity.PermArticleDraft, false},
		{"a super admin may assign roles", identity.RoleSuperAdmin, identity.PermRoleAssign, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			actor := identity.NewActor(shared.UserID("usr_1"), []identity.Role{tc.role})
			if got := actor.Can(tc.perm); got != tc.grant {
				t.Errorf("%s can %s = %v, want %v", tc.role, tc.perm, got, tc.grant)
			}
		})
	}
}

func TestAdministratorHasEverythingExceptRoleAssignment(t *testing.T) {
	t.Parallel()

	// The separation is the point: an administrator runs the platform, but
	// granting roles — including granting themselves more — stays with the
	// super admin.
	admin := identity.NewActor(shared.UserID("usr_admin"), []identity.Role{identity.RoleAdministrator})

	if admin.Can(identity.PermRoleAssign) {
		t.Error("an administrator must not be able to assign roles")
	}

	for _, p := range identity.AllPermissions() {
		if p == identity.PermRoleAssign {
			continue
		}
		if !admin.Can(p) {
			t.Errorf("an administrator should hold %s", p)
		}
	}
}

func TestAllPermissionsReturnsACopy(t *testing.T) {
	t.Parallel()

	// Handing out the backing array would let a caller blank the
	// authorisation model from the outside.
	first := identity.AllPermissions()
	first[0] = "tampered"

	if identity.AllPermissions()[0] == "tampered" {
		t.Error("AllPermissions exposed its backing array")
	}
}

func TestActorUnionsMultipleRoles(t *testing.T) {
	t.Parallel()

	actor := identity.NewActor(shared.UserID("usr_1"), []identity.Role{
		identity.RoleAuthor, identity.RoleSocialMediaManager,
	})

	if !actor.Can(identity.PermArticleDraft) {
		t.Error("lost the author's permissions")
	}
	if !actor.Can(identity.PermSocialPublish) {
		t.Error("lost the social manager's permissions")
	}
}

func TestActorDropsUnknownRoles(t *testing.T) {
	t.Parallel()

	// Storage is not a trust boundary. A role deleted from the codebase must
	// degrade access, not arrive as a live grant or lock someone out.
	actor := identity.NewActor(shared.UserID("usr_1"), []identity.Role{
		identity.RoleEditor, identity.Role("chief_wizard"),
	})

	if len(actor.Roles()) != 1 {
		t.Errorf("roles = %v, want only the known one", actor.Roles())
	}
	if !actor.Can(identity.PermArticleApprove) {
		t.Error("dropping the unknown role also dropped the known one")
	}
}

func TestActorRolesReturnsACopy(t *testing.T) {
	t.Parallel()

	actor := identity.NewActor(shared.UserID("usr_1"), []identity.Role{identity.RoleEditor})

	roles := actor.Roles()
	roles[0] = identity.RoleSuperAdmin

	if actor.Roles()[0] == identity.RoleSuperAdmin {
		t.Error("Roles exposed the actor's own slice; a caller could escalate")
	}
}

func TestRequire(t *testing.T) {
	t.Parallel()

	actor := identity.NewActor(shared.UserID("usr_1"), []identity.Role{identity.RoleAuthor})

	if err := actor.Require(identity.PermArticleDraft); err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	err := actor.Require(identity.PermArticleApprove)
	if !errors.Is(err, identity.ErrNotPermitted) {
		t.Errorf("got %v, want ErrNotPermitted", err)
	}
}

func TestIsKnownRole(t *testing.T) {
	t.Parallel()

	if !identity.IsKnownRole("editor") {
		t.Error("editor should be known")
	}
	if identity.IsKnownRole("chief_wizard") {
		t.Error("chief_wizard should not be known")
	}
}

func TestActorID(t *testing.T) {
	t.Parallel()

	actor := identity.NewActor(shared.UserID("usr_42"), nil)

	if actor.ID() != "usr_42" {
		t.Errorf("ID = %q", actor.ID())
	}
	if len(actor.Roles()) != 0 {
		t.Errorf("expected no roles, got %v", actor.Roles())
	}
}
