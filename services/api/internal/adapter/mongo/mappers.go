package mongo

import (
	"time"

	"github.com/kurasikapa/api/internal/domain/editorial"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// Mapping lives here and nowhere else.
//
// A repository that builds domain objects inline ends up with three subtly
// different reconstructions of the same aggregate, and the third one forgets a
// field. One function per direction, per aggregate.

func articleToDomain(doc articleDoc) editorial.Article {
	// The stored slug is already normalised — it was normalised on the way in.
	// Reconstitution does not re-validate for the same reason the aggregate has
	// a separate Reconstitute: a document already in the database happened, and
	// refusing to load it because a rule has since tightened would make the
	// article unreachable rather than correctable.
	slug := shared.SlugFrom(doc.Slug)

	var approved *shared.RevisionID
	if doc.ApprovedRevisionID != nil {
		id := shared.RevisionID(*doc.ApprovedRevisionID)
		approved = &id
	}

	tags := make([]shared.TagID, 0, len(doc.TagIDs))
	for _, t := range doc.TagIDs {
		tags = append(tags, shared.TagID(t))
	}
	var hero *editorial.ArticleHero
	if doc.Hero != nil {
		hero = &editorial.ArticleHero{
			AssetID: shared.AssetID(doc.Hero.AssetID), SecureURL: doc.Hero.SecureURL,
			AltText: doc.Hero.AltText, Caption: doc.Hero.Caption, Credit: doc.Hero.Credit,
			Width: doc.Hero.Width, Height: doc.Hero.Height,
		}
	}
	var narration *editorial.ArticleNarration
	if doc.Narration != nil {
		narration = &editorial.ArticleNarration{
			AssetID:          shared.AssetID(doc.Narration.AssetID),
			SourceRevisionID: shared.RevisionID(doc.Narration.SourceRevisionID),
			SecureURL:        doc.Narration.SecureURL, MIMEType: doc.Narration.MIMEType,
			DurationSeconds: doc.Narration.DurationSeconds, Voice: doc.Narration.Voice,
		}
	}

	return editorial.Reconstitute(editorial.ArticleState{
		ID:                 shared.ArticleID(doc.ID),
		FamilyID:           shared.FamilyID(doc.FamilyID),
		Locale:             doc.Locale,
		Slug:               slug,
		Title:              doc.Title,
		AuthorID:           shared.UserID(doc.AuthorID),
		CategoryID:         shared.CategoryID(doc.CategoryID),
		TagIDs:             tags,
		Hero:               hero,
		Narration:          narration,
		Status:             editorial.Status(doc.Status),
		ApprovedRevisionID: approved,
		ScheduledAt:        doc.ScheduledAt,
		PublishedAt:        doc.PublishedAt,
	})
}

func articleToDoc(article editorial.Article, updatedAt time.Time) articleDoc {
	s := article.State()

	var approved *string
	if s.ApprovedRevisionID != nil {
		id := s.ApprovedRevisionID.String()
		approved = &id
	}

	// Never nil. A nil slice marshals to BSON null, and the TypeScript side
	// declares tagIds as string[] — a null there is a type error at the far end
	// of a shared collection.
	tags := make([]string, 0, len(s.TagIDs))
	for _, t := range s.TagIDs {
		tags = append(tags, t.String())
	}
	var hero *articleHeroDoc
	if s.Hero != nil {
		hero = &articleHeroDoc{
			AssetID: s.Hero.AssetID.String(), SecureURL: s.Hero.SecureURL,
			AltText: s.Hero.AltText, Caption: s.Hero.Caption, Credit: s.Hero.Credit,
			Width: s.Hero.Width, Height: s.Hero.Height,
		}
	}
	var narration *articleNarrationDoc
	if s.Narration != nil {
		narration = &articleNarrationDoc{
			AssetID: s.Narration.AssetID.String(), SourceRevisionID: s.Narration.SourceRevisionID.String(),
			SecureURL: s.Narration.SecureURL, MIMEType: s.Narration.MIMEType,
			DurationSeconds: s.Narration.DurationSeconds, Voice: s.Narration.Voice,
		}
	}

	return articleDoc{
		ID:                 s.ID.String(),
		FamilyID:           s.FamilyID.String(),
		Locale:             s.Locale,
		Slug:               s.Slug.String(),
		Title:              s.Title,
		AuthorID:           s.AuthorID.String(),
		CategoryID:         s.CategoryID.String(),
		TagIDs:             tags,
		Hero:               hero,
		Narration:          narration,
		Status:             string(s.Status),
		ApprovedRevisionID: approved,
		ScheduledAt:        s.ScheduledAt,
		PublishedAt:        s.PublishedAt,
		UpdatedAt:          updatedAt,
	}
}

func revisionToDomain(doc revisionDoc) editorial.Revision {
	return editorial.ReconstituteRevision(editorial.RevisionState{
		ID:        shared.RevisionID(doc.ID),
		ArticleID: shared.ArticleID(doc.ArticleID),
		Seq:       doc.Seq,
		Title:     doc.Title,
		Body:      doc.Body,
		AuthorID:  shared.UserID(doc.AuthorID),
		CreatedAt: doc.CreatedAt,
	})
}

func revisionToDoc(revision editorial.Revision) revisionDoc {
	s := revision.State()

	return revisionDoc{
		ID:        s.ID.String(),
		ArticleID: s.ArticleID.String(),
		Seq:       s.Seq,
		Title:     s.Title,
		Body:      s.Body,
		AuthorID:  s.AuthorID.String(),
		CreatedAt: s.CreatedAt,
	}
}

func categoryToDomain(doc categoryDoc) editorial.Category {
	var parent *shared.CategoryID
	if doc.ParentID != nil {
		id := shared.CategoryID(*doc.ParentID)
		parent = &id
	}

	return editorial.ReconstituteCategory(editorial.CategoryState{
		ID:           shared.CategoryID(doc.ID),
		ParentID:     parent,
		Slugs:        doc.Slugs,
		Names:        doc.Names,
		Descriptions: doc.Descriptions,
		Order:        doc.Order,
	})
}

func categoryToDoc(category editorial.Category) categoryDoc {
	s := category.State()

	var parent *string
	if s.ParentID != nil {
		id := s.ParentID.String()
		parent = &id
	}

	return categoryDoc{
		ID:           s.ID.String(),
		ParentID:     parent,
		Slugs:        s.Slugs,
		Names:        s.Names,
		Descriptions: s.Descriptions,
		Order:        s.Order,
	}
}
