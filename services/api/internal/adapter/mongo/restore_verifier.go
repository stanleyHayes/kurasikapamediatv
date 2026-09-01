package mongo

import (
	"context"
	"fmt"
	"sort"

	"go.mongodb.org/mongo-driver/v2/bson"
	drivermongo "go.mongodb.org/mongo-driver/v2/mongo"
)

// RestoreReport is the read-only acceptance record for one restored snapshot.
// It intentionally contains no URI: evidence may be shared without leaking a
// database credential.
type RestoreReport struct {
	Database string           `json:"database"`
	Counts   map[string]int64 `json:"counts"`
	Healthy  bool             `json:"healthy"`
	Issues   []string         `json:"issues"`
}

// RestoreVerifier checks that a restored database is structurally usable.
// It never creates a collection or index and never writes a document.
type RestoreVerifier struct {
	db *drivermongo.Database
}

func NewRestoreVerifier(db *drivermongo.Database) *RestoreVerifier {
	return &RestoreVerifier{db: db}
}

var requiredRestoreCollections = []string{
	CollArticles,
	CollRevisions,
	CollCategories,
	CollRoleAssignments,
	"user",
}

var requiredRestoreIndexes = map[string][]string{
	CollArticles: {
		"locale_slug_unique",
		"family_locale_unique",
		"published_recent",
		"due_for_publication",
	},
	CollRevisions:  {"article_seq_unique"},
	CollCategories: {"slug_en_unique", "slug_fr_unique", "nav_order"},
}

// Verify reads collection metadata and editorial references under one caller-
// supplied deadline. Any issue makes Healthy false while transport/query
// failures are returned as errors because they invalidate the report itself.
func (v *RestoreVerifier) Verify(ctx context.Context) (RestoreReport, error) {
	report := RestoreReport{
		Database: v.db.Name(),
		Counts:   make(map[string]int64, len(requiredRestoreCollections)),
		Issues:   []string{},
	}

	names, err := v.db.ListCollectionNames(ctx, bson.D{})
	if err != nil {
		return RestoreReport{}, fmt.Errorf("listing restored collections: %w", err)
	}
	present := stringSet(names)

	for _, collection := range requiredRestoreCollections {
		if !present[collection] {
			report.Issues = append(report.Issues, "missing collection: "+collection)
			continue
		}

		count, countErr := v.db.Collection(collection).CountDocuments(ctx, bson.D{})
		if countErr != nil {
			return RestoreReport{}, fmt.Errorf("counting restored %s: %w", collection, countErr)
		}
		report.Counts[collection] = count
	}

	if err := v.checkIndexes(ctx, present, &report); err != nil {
		return RestoreReport{}, err
	}
	if present[CollArticles] && present[CollRevisions] && present[CollCategories] {
		if err := v.checkEditorialReferences(ctx, &report); err != nil {
			return RestoreReport{}, err
		}
	}

	if report.Counts[CollArticles] == 0 {
		report.Issues = append(report.Issues, "restored editorial inventory is empty")
	}
	if report.Counts["user"] == 0 {
		report.Issues = append(report.Issues, "restored user directory is empty")
	}

	sort.Strings(report.Issues)
	report.Healthy = len(report.Issues) == 0
	return report, nil
}

func (v *RestoreVerifier) checkIndexes(
	ctx context.Context,
	present map[string]bool,
	report *RestoreReport,
) error {
	for collection, required := range requiredRestoreIndexes {
		if !present[collection] {
			continue
		}

		specs, err := v.db.Collection(collection).Indexes().ListSpecifications(ctx)
		if err != nil {
			return fmt.Errorf("listing restored %s indexes: %w", collection, err)
		}
		names := make(map[string]bool, len(specs))
		for _, spec := range specs {
			names[spec.Name] = true
		}
		for _, name := range required {
			if !names[name] {
				report.Issues = append(report.Issues, fmt.Sprintf("missing index: %s.%s", collection, name))
			}
		}
	}
	return nil
}

func (v *RestoreVerifier) checkEditorialReferences(ctx context.Context, report *RestoreReport) error {
	checks := []struct {
		label    string
		pipeline drivermongo.Pipeline
	}{
		{
			label:    "articles reference missing categories",
			pipeline: lookupMissing("categories", "categoryId", "_id", nil),
		},
		{
			label: "approved articles reference missing approved revisions",
			pipeline: lookupMissing("article_revisions", "approvedRevisionId", "_id", bson.M{
				"status": bson.M{"$in": bson.A{"approved", "scheduled", "published"}},
			}),
		},
	}

	for _, check := range checks {
		count, err := aggregateCount(ctx, v.db.Collection(CollArticles), check.pipeline)
		if err != nil {
			return fmt.Errorf("checking %s: %w", check.label, err)
		}
		if count > 0 {
			report.Issues = append(report.Issues, fmt.Sprintf("%s: %d", check.label, count))
		}
	}
	return nil
}

func lookupMissing(from, localField, foreignField string, filter bson.M) drivermongo.Pipeline {
	pipeline := drivermongo.Pipeline{}
	if filter != nil {
		pipeline = append(pipeline, bson.D{{Key: "$match", Value: filter}})
	}
	return append(pipeline,
		bson.D{{Key: "$lookup", Value: bson.M{
			"from": from, "localField": localField, "foreignField": foreignField, "as": "matched",
		}}},
		bson.D{{Key: "$match", Value: bson.M{"matched": bson.M{"$size": 0}}}},
		bson.D{{Key: "$count", Value: "total"}},
	)
}

func aggregateCount(ctx context.Context, collection *drivermongo.Collection, pipeline drivermongo.Pipeline) (int64, error) {
	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, err
	}
	defer func() { _ = cursor.Close(ctx) }()

	var rows []struct {
		Total int64 `bson:"total"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Total, nil
}

func stringSet(values []string) map[string]bool {
	set := make(map[string]bool, len(values))
	for _, value := range values {
		set[value] = true
	}
	return set
}
