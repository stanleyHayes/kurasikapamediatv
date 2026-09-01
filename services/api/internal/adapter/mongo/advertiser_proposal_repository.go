package mongo

import (
	"context"
	"errors"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type AdvertiserProposalRepository struct {
	collection *mongo.Collection
	campaigns  *mongo.Collection
}

func NewAdvertiserProposalRepository(db *mongo.Database) *AdvertiserProposalRepository {
	return &AdvertiserProposalRepository{
		collection: db.Collection(CollAdvertiserProposals),
		campaigns:  db.Collection(CollAdCampaigns),
	}
}
func (r *AdvertiserProposalRepository) FindByID(ctx context.Context, id shared.AdvertiserProposalID) (revenue.AdvertiserProposal, error) {
	var doc advertiserProposalDoc
	if err := r.collection.FindOne(ctx, bson.M{"_id": id.String()}).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return revenue.AdvertiserProposal{}, ports.ErrNotFound
		}
		return revenue.AdvertiserProposal{}, err
	}
	return advertiserProposalFromDoc(doc), nil
}
func (r *AdvertiserProposalRepository) ListForOwner(ctx context.Context, owner shared.UserID, limit int) ([]revenue.AdvertiserProposal, error) {
	return r.list(ctx, bson.M{"ownerId": owner.String()}, limit)
}
func (r *AdvertiserProposalRepository) ListSubmitted(ctx context.Context, limit int) ([]revenue.AdvertiserProposal, error) {
	return r.list(ctx, bson.M{"status": string(revenue.ProposalSubmitted)}, limit)
}
func (r *AdvertiserProposalRepository) list(ctx context.Context, filter bson.M, limit int) ([]revenue.AdvertiserProposal, error) {
	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "submittedAt", Value: -1}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cursor.Close(ctx) }()
	var docs []advertiserProposalDoc
	if err = cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	items := make([]revenue.AdvertiserProposal, len(docs))
	for index, doc := range docs {
		items[index] = advertiserProposalFromDoc(doc)
	}
	return items, nil
}
func (r *AdvertiserProposalRepository) Save(ctx context.Context, proposal revenue.AdvertiserProposal) error {
	doc := advertiserProposalToDoc(proposal)
	if proposal.State().Status == revenue.ProposalSubmitted {
		_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID}, doc, options.Replace().SetUpsert(true))
		return err
	}
	result, err := r.collection.ReplaceOne(ctx, bson.M{"_id": doc.ID, "status": string(revenue.ProposalSubmitted)}, doc)
	if err == nil && result.MatchedCount == 0 {
		return revenue.ErrProposalReviewed
	}
	return err
}
func (r *AdvertiserProposalRepository) ApproveWithCampaign(ctx context.Context, proposal revenue.AdvertiserProposal, campaign revenue.AdCampaign) error {
	session, err := r.collection.Database().Client().StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)
	_, err = session.WithTransaction(ctx, func(tx context.Context) (any, error) {
		campaignDoc := adCampaignToDoc(campaign)
		if _, insertErr := r.campaigns.InsertOne(tx, campaignDoc); insertErr != nil {
			return nil, insertErr
		}
		proposalDoc := advertiserProposalToDoc(proposal)
		result, replaceErr := r.collection.ReplaceOne(tx, bson.M{
			"_id": proposalDoc.ID, "status": string(revenue.ProposalSubmitted),
		}, proposalDoc)
		if replaceErr != nil {
			return nil, replaceErr
		}
		if result.MatchedCount == 0 {
			return nil, revenue.ErrProposalReviewed
		}
		return nil, nil
	})
	return err
}
func (r *AdvertiserProposalRepository) EnsureIndexes(ctx context.Context) error {
	_, err := r.collection.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "ownerId", Value: 1}, {Key: "submittedAt", Value: -1}}, Options: options.Index().SetName("advertiser_proposals_owner")},
		{Keys: bson.D{{Key: "status", Value: 1}, {Key: "submittedAt", Value: -1}}, Options: options.Index().SetName("advertiser_proposal_queue")},
	})
	return err
}

func advertiserProposalToDoc(value revenue.AdvertiserProposal) advertiserProposalDoc {
	s := value.State()
	campaign := adCampaignToDoc(revenue.ReconstituteAdCampaign(s.Campaign))
	return advertiserProposalDoc{ID: s.ID.String(), OwnerID: s.OwnerID.String(), ContactName: s.ContactName, ContactEmail: s.ContactEmail, Campaign: campaign, Status: string(s.Status), SubmittedAt: s.SubmittedAt, ReviewedAt: s.ReviewedAt, ReviewedBy: s.ReviewedBy.String(), CampaignID: s.CampaignID.String(), ReviewNote: s.ReviewNote}
}
func advertiserProposalFromDoc(doc advertiserProposalDoc) revenue.AdvertiserProposal {
	campaign := adCampaignFromDoc(doc.Campaign).State()
	return revenue.ReconstituteAdvertiserProposal(revenue.AdvertiserProposalState{ID: shared.AdvertiserProposalID(doc.ID), OwnerID: shared.UserID(doc.OwnerID), ContactName: doc.ContactName, ContactEmail: doc.ContactEmail, Campaign: campaign, Status: revenue.AdvertiserProposalStatus(doc.Status), SubmittedAt: doc.SubmittedAt, ReviewedAt: doc.ReviewedAt, ReviewedBy: shared.UserID(doc.ReviewedBy), CampaignID: shared.AdCampaignID(doc.CampaignID), ReviewNote: doc.ReviewNote})
}
