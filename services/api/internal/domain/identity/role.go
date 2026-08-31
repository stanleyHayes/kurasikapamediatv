// Package identity answers "what may this person do".
//
// Better Auth answers who someone is. This package decides what they may do,
// and it is the only place that decision is made. A role check in a React
// component is cosmetic and is never the control — see ADR-0004 and ADR-0009.
package identity

// Role is one of the eleven roles from the signed questionnaire (§ 8).
type Role string

// The eleven roles.
const (
	RoleSuperAdmin         Role = "super_admin"
	RoleAdministrator      Role = "administrator"
	RoleEditor             Role = "editor"
	RoleJournalist         Role = "journalist"
	RoleAuthor             Role = "author"
	RolePhotographer       Role = "photographer"
	RoleVideoEditor        Role = "video_editor"
	RoleSocialMediaManager Role = "social_media_manager"
	RoleAdvertiser         Role = "advertiser"
	RoleSubscriber         Role = "subscriber"
	RoleGuest              Role = "guest"
)

// Permission is a single capability a role may confer.
type Permission string

// Every permission the platform recognises.
const (
	PermArticleDraft     Permission = "article:draft"
	PermArticleEditOwn   Permission = "article:edit_own"
	PermArticleEditAny   Permission = "article:edit_any"
	PermArticleSubmit    Permission = "article:submit"
	PermArticleApprove   Permission = "article:approve"
	PermArticlePublish   Permission = "article:publish"
	PermArticleUnpublish Permission = "article:unpublish"
	PermAssetUploadImage Permission = "asset:upload_image"
	PermAssetUploadVideo Permission = "asset:upload_video"
	PermStreamManage     Permission = "stream:manage"
	PermSocialPublish    Permission = "social:publish"
	PermCampaignViewOwn  Permission = "campaign:view_own"
	PermRevenueManage    Permission = "revenue:manage"
	PermRevenueRead      Permission = "revenue:read"
	PermRoleAssign       Permission = "role:assign"
	PermAuditRead        Permission = "audit:read"
)

// allPermissions is the full set, in declaration order.
var allPermissions = []Permission{
	PermArticleDraft, PermArticleEditOwn, PermArticleEditAny, PermArticleSubmit,
	PermArticleApprove, PermArticlePublish, PermArticleUnpublish,
	PermAssetUploadImage, PermAssetUploadVideo, PermStreamManage,
	PermSocialPublish, PermCampaignViewOwn, PermRevenueManage, PermRevenueRead,
	PermRoleAssign, PermAuditRead,
}

// AllPermissions returns a copy of every permission.
//
// A copy, not the slice itself: handing out the backing array would let a
// caller reorder or blank the authorisation model from the outside.
func AllPermissions() []Permission {
	out := make([]Permission, len(allPermissions))
	copy(out, allPermissions)

	return out
}

var editorPermissions = []Permission{
	PermArticleDraft, PermArticleEditOwn, PermArticleEditAny, PermArticleSubmit,
	PermArticleApprove, PermArticlePublish, PermArticleUnpublish, PermAssetUploadImage,
}

// rolePermissions maps each role to what it confers.
//
// administrator gets everything except role:assign. That separation is the
// point: an administrator runs the platform, but granting roles — including
// granting themselves more — stays with the super admin.
var rolePermissions = map[Role][]Permission{
	RoleSuperAdmin:    allPermissions,
	RoleAdministrator: without(allPermissions, PermRoleAssign),
	RoleEditor:        editorPermissions,
	RoleJournalist: {
		PermArticleDraft, PermArticleEditOwn, PermArticleSubmit, PermAssetUploadImage,
	},
	RoleAuthor:             {PermArticleDraft, PermArticleEditOwn, PermArticleSubmit},
	RolePhotographer:       {PermAssetUploadImage},
	RoleVideoEditor:        {PermAssetUploadVideo, PermStreamManage},
	RoleSocialMediaManager: {PermSocialPublish},
	RoleAdvertiser:         {PermCampaignViewOwn},
	RoleSubscriber:         {},
	RoleGuest:              {},
}

// IsKnownRole reports whether a stored string is a role the platform defines.
//
// Storage is not a trust boundary. A role deleted from this file must not
// arrive from the database as a live grant that resolves to nothing.
func IsKnownRole(candidate string) bool {
	_, ok := rolePermissions[Role(candidate)]

	return ok
}

// PermissionsOf returns the union of everything the given roles confer.
func PermissionsOf(roles []Role) map[Permission]struct{} {
	granted := make(map[Permission]struct{})

	for _, role := range roles {
		for _, permission := range rolePermissions[role] {
			granted[permission] = struct{}{}
		}
	}

	return granted
}

func without(all []Permission, excluded Permission) []Permission {
	out := make([]Permission, 0, len(all))

	for _, p := range all {
		if p != excluded {
			out = append(out, p)
		}
	}

	return out
}
