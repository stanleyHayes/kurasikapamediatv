package editorial

import (
	"context"
	"fmt"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const narrationBatchSize = 25

type ProcessNarrationResult struct {
	Processing int      `json:"processing"`
	Ready      int      `json:"ready"`
	Failed     []string `json:"failed"`
}

type ProcessNarrationJobs struct {
	deps     Deps
	jobs     ports.NarrationJobRepository
	provider ports.NarrationProvider
}

func NewProcessNarrationJobs(deps Deps, jobs ports.NarrationJobRepository, provider ports.NarrationProvider) ProcessNarrationJobs {
	return ProcessNarrationJobs{deps: deps, jobs: jobs, provider: provider}
}

func (u ProcessNarrationJobs) Execute(ctx context.Context, actor identity.Actor) (ProcessNarrationResult, error) {
	if err := actor.Require(identity.PermArticlePublish); err != nil {
		return ProcessNarrationResult{}, err
	}
	jobs, err := u.jobs.ListProcessing(ctx, narrationBatchSize)
	if err != nil {
		return ProcessNarrationResult{}, err
	}
	result := ProcessNarrationResult{Failed: []string{}}
	for _, job := range jobs {
		status, checkErr := u.provider.Check(ctx, job.ID(), job.State().ProviderTaskID)
		if checkErr != nil {
			result.Failed = append(result.Failed, job.ID().String())
			continue
		}
		switch status.Status {
		case ports.NarrationProviderProcessing:
			result.Processing++
		case ports.NarrationProviderReady:
			if u.complete(ctx, actor, job, status.Delivery) != nil {
				result.Failed = append(result.Failed, job.ID().String())
			} else {
				result.Ready++
			}
		case ports.NarrationProviderFailed:
			if u.fail(ctx, actor, job, status.FailureReason) != nil {
				result.Failed = append(result.Failed, job.ID().String())
			} else {
				result.Failed = append(result.Failed, job.ID().String())
			}
		default:
			result.Failed = append(result.Failed, job.ID().String())
		}
	}
	return result, nil
}

func (u ProcessNarrationJobs) complete(ctx context.Context, actor identity.Actor, job media.NarrationJob, delivery media.AssetDelivery) error {
	assetID := shared.AssetID("narration_" + job.ID().String())
	asset, err := media.NewAsset(actor, media.AssetState{
		ID: assetID, Kind: media.AssetAudio, Filename: job.ID().String() + ".mp3",
		MIMEType: "audio/mpeg", Locale: job.State().Locale,
	})
	if err == nil {
		asset, err = asset.MarkReady(actor, delivery)
	}
	if err == nil {
		err = u.deps.Assets.Save(ctx, asset)
	}
	if err != nil {
		return fmt.Errorf("saving narration asset: %w", err)
	}
	job, err = job.Complete(actor, assetID, u.deps.Clock.Now())
	if err != nil {
		return err
	}
	return u.jobs.Save(ctx, job)
}

func (u ProcessNarrationJobs) fail(ctx context.Context, actor identity.Actor, job media.NarrationJob, reason string) error {
	if reason == "" {
		reason = "speech provider did not complete the recording"
	}
	failed, err := job.Fail(actor, reason, u.deps.Clock.Now())
	if err != nil {
		return err
	}
	return u.jobs.Save(ctx, failed)
}
