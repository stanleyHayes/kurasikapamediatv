package media

import (
	"context"
	"errors"
	"fmt"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

const recordingImportBatchSize = 10

type ReceiveRecording struct {
	deps     Deps
	imports  ports.RecordingImportRepository
	provider ports.RecordingPromotionPort
}

func NewReceiveRecording(deps Deps, imports ports.RecordingImportRepository, provider ports.RecordingPromotionPort) ReceiveRecording {
	return ReceiveRecording{deps, imports, provider}
}

func (u ReceiveRecording) Execute(ctx context.Context, actor identity.Actor, source ports.RecordingSource) (domainmedia.RecordingImport, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return domainmedia.RecordingImport{}, err
	}
	job, err := u.imports.FindBySourceRef(ctx, source.SourceRef)
	if err == nil {
		if job.State().Status != domainmedia.RecordingImportRequested {
			return job, nil
		}
		return u.start(ctx, actor, job, source)
	}
	if !errors.Is(err, ports.ErrNotFound) {
		return domainmedia.RecordingImport{}, err
	}
	job, err = domainmedia.NewRecordingImport(actor, domainmedia.RecordingImportState{
		ID: shared.RecordingImportID(u.deps.IDs.NewID()), AssetID: shared.AssetID(u.deps.IDs.NewID()),
		SourceRef: source.SourceRef, Bucket: source.Bucket, Prefix: source.Prefix,
		ChannelName: source.ChannelName, Locale: source.Locale, DurationSeconds: source.DurationSeconds,
	}, u.deps.Clock.Now())
	if err != nil {
		return domainmedia.RecordingImport{}, err
	}
	if err = u.imports.Save(ctx, job); err != nil {
		return domainmedia.RecordingImport{}, err
	}
	return u.start(ctx, actor, job, source)
}

func (u ReceiveRecording) start(ctx context.Context, actor identity.Actor, job domainmedia.RecordingImport, source ports.RecordingSource) (domainmedia.RecordingImport, error) {
	task, err := u.provider.Start(ctx, job.ID(), source)
	if err != nil {
		return job, err
	}
	job, err = job.Start(actor, task.TaskID, task.OutputRef, u.deps.Clock.Now())
	if err != nil {
		return domainmedia.RecordingImport{}, err
	}
	return job, u.imports.Save(ctx, job)
}

type ProcessRecordingResult struct {
	Processing int      `json:"processing"`
	Ready      int      `json:"ready"`
	Failed     []string `json:"failed"`
}

type ProcessRecordings struct {
	deps     Deps
	imports  ports.RecordingImportRepository
	provider ports.RecordingPromotionPort
}

func NewProcessRecordings(deps Deps, imports ports.RecordingImportRepository, provider ports.RecordingPromotionPort) ProcessRecordings {
	return ProcessRecordings{deps, imports, provider}
}

func (u ProcessRecordings) Execute(ctx context.Context, actor identity.Actor) (ProcessRecordingResult, error) {
	if err := actor.Require(identity.PermAssetUploadVideo); err != nil {
		return ProcessRecordingResult{}, err
	}
	jobs, err := u.imports.ListProcessing(ctx, recordingImportBatchSize)
	if err != nil {
		return ProcessRecordingResult{}, err
	}
	result := ProcessRecordingResult{Failed: []string{}}
	for _, job := range jobs {
		outcome, checkErr := u.provider.Check(ctx, job.ID(), job.State().ProviderTaskID, job.State().OutputRef)
		if checkErr != nil {
			result.Failed = append(result.Failed, job.ID().String())
			continue
		}
		switch outcome.Status {
		case ports.RecordingProviderProcessing:
			result.Processing++
		case ports.RecordingProviderReady:
			if u.complete(ctx, actor, job, outcome.Delivery) != nil {
				result.Failed = append(result.Failed, job.ID().String())
			} else {
				result.Ready++
			}
		case ports.RecordingProviderFailed:
			if u.fail(ctx, actor, job, outcome.FailureReason) != nil {
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

func (u ProcessRecordings) complete(ctx context.Context, actor identity.Actor, job domainmedia.RecordingImport, delivery domainmedia.AssetDelivery) error {
	state := job.State()
	_, err := u.deps.Assets.FindByID(ctx, state.AssetID)
	if errors.Is(err, ports.ErrNotFound) {
		asset, createErr := domainmedia.NewAsset(actor, domainmedia.AssetState{ID: state.AssetID, Kind: domainmedia.AssetVideo, Filename: state.ChannelName + ".mp4", MIMEType: "video/mp4", Locale: state.Locale})
		err = createErr
		if err == nil {
			asset, err = asset.MarkReady(actor, delivery)
		}
		if err == nil {
			err = u.deps.Assets.Save(ctx, asset)
		}
	}
	if err != nil {
		return fmt.Errorf("saving recording asset: %w", err)
	}
	job, err = job.Complete(actor, u.deps.Clock.Now())
	if err != nil {
		return err
	}
	return u.imports.Save(ctx, job)
}

func (u ProcessRecordings) fail(ctx context.Context, actor identity.Actor, job domainmedia.RecordingImport, reason string) error {
	if reason == "" {
		reason = "recording provider did not complete the promotion"
	}
	job, err := job.Fail(actor, reason, u.deps.Clock.Now())
	if err != nil {
		return err
	}
	return u.imports.Save(ctx, job)
}
