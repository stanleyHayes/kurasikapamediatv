// Package recording promotes completed Amazon IVS HLS recordings into
// Cloudinary-ready MP4 assets through AWS Elemental MediaConvert.
package recording

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/mediaconvert"
	mctypes "github.com/aws/aws-sdk-go-v2/service/mediaconvert/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrNotConfigured = ports.ErrRecordingNotConfigured

type mediaConvertAPI interface {
	CreateJob(context.Context, *mediaconvert.CreateJobInput, ...func(*mediaconvert.Options)) (*mediaconvert.CreateJobOutput, error)
	GetJob(context.Context, *mediaconvert.GetJobInput, ...func(*mediaconvert.Options)) (*mediaconvert.GetJobOutput, error)
}

type s3API interface {
	GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	DeleteObject(context.Context, *s3.DeleteObjectInput, ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
}

type Config struct {
	Region, SourceBucket, OutputBucket         string
	RoleARN, JobTemplate, OutputPrefix         string
	CloudName, CloudinaryKey, CloudinarySecret string
	HTTPClient                                 *http.Client
	Clock                                      ports.Clock
	UploadURL                                  string
}

type Provider struct {
	mediaConvert mediaConvertAPI
	s3           s3API
	cfg          Config
}

func New(ctx context.Context, cfg Config) (*Provider, error) {
	if !configured(cfg) {
		return nil, ErrNotConfigured
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.Region))
	if err != nil {
		return nil, fmt.Errorf("loading AWS recording configuration: %w", err)
	}
	return &Provider{mediaConvert: mediaconvert.NewFromConfig(awsCfg), s3: s3.NewFromConfig(awsCfg), cfg: defaults(cfg)}, nil
}

func newWithClients(mediaConvertClient mediaConvertAPI, s3Client s3API, cfg Config) (*Provider, error) {
	if !configured(cfg) {
		return nil, ErrNotConfigured
	}
	return &Provider{mediaConvert: mediaConvertClient, s3: s3Client, cfg: defaults(cfg)}, nil
}

func (p *Provider) Start(ctx context.Context, id shared.RecordingImportID, source ports.RecordingSource) (ports.RecordingTranscode, error) {
	if source.Bucket != p.cfg.SourceBucket || !validPrefix(source.Prefix) {
		return ports.RecordingTranscode{}, errors.New("recording source is outside the configured IVS bucket")
	}
	input, err := p.recordingInput(ctx, source)
	if err != nil {
		return ports.RecordingTranscode{}, err
	}
	destination := p.destination(id)
	job, err := p.mediaConvert.CreateJob(ctx, &mediaconvert.CreateJobInput{
		Role: aws.String(p.cfg.RoleARN), JobTemplate: aws.String(p.cfg.JobTemplate),
		ClientRequestToken: aws.String(id.String()),
		Settings: &mctypes.JobSettings{
			Inputs: []mctypes.Input{{FileInput: aws.String(input)}},
			OutputGroups: []mctypes.OutputGroup{{OutputGroupSettings: &mctypes.OutputGroupSettings{
				Type:              mctypes.OutputGroupTypeFileGroupSettings,
				FileGroupSettings: &mctypes.FileGroupSettings{Destination: aws.String(destination)},
			}}},
		},
		UserMetadata: map[string]string{"recording_import_id": id.String(), "source_ref": source.SourceRef},
	})
	if err != nil {
		return ports.RecordingTranscode{}, fmt.Errorf("starting recording transcode: %w", err)
	}
	if job.Job == nil || aws.ToString(job.Job.Id) == "" {
		return ports.RecordingTranscode{}, errors.New("MediaConvert returned no job id")
	}
	return ports.RecordingTranscode{TaskID: aws.ToString(job.Job.Id), OutputRef: destination + "master.mp4"}, nil
}

func (p *Provider) Check(ctx context.Context, id shared.RecordingImportID, taskID, outputRef string) (ports.RecordingProviderResult, error) {
	job, err := p.mediaConvert.GetJob(ctx, &mediaconvert.GetJobInput{Id: aws.String(taskID)})
	if err != nil {
		return ports.RecordingProviderResult{}, fmt.Errorf("checking recording transcode: %w", err)
	}
	if job.Job == nil {
		return ports.RecordingProviderResult{}, errors.New("MediaConvert returned no job")
	}
	switch job.Job.Status {
	case mctypes.JobStatusComplete:
		delivery, uploadErr := p.upload(ctx, id, outputRef)
		if uploadErr != nil {
			return ports.RecordingProviderResult{}, uploadErr
		}
		if deleteErr := p.deleteOutput(ctx, outputRef); deleteErr != nil {
			return ports.RecordingProviderResult{}, deleteErr
		}
		return ports.RecordingProviderResult{Status: ports.RecordingProviderReady, Delivery: delivery}, nil
	case mctypes.JobStatusError, mctypes.JobStatusCanceled:
		return ports.RecordingProviderResult{Status: ports.RecordingProviderFailed, FailureReason: aws.ToString(job.Job.ErrorMessage)}, nil
	default:
		return ports.RecordingProviderResult{Status: ports.RecordingProviderProcessing}, nil
	}
}

type recordingMetadata struct {
	Status string `json:"recording_status"`
	Media  struct {
		HLS struct{ Path, Playlist string } `json:"hls"`
	} `json:"media"`
}

func (p *Provider) recordingInput(ctx context.Context, source ports.RecordingSource) (string, error) {
	key := strings.TrimSuffix(source.Prefix, "/") + "/events/recording-ended.json"
	object, err := p.s3.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(source.Bucket), Key: aws.String(key)})
	if err != nil {
		return "", fmt.Errorf("reading IVS recording metadata: %w", err)
	}
	defer func() { _ = object.Body.Close() }()
	var metadata recordingMetadata
	if err = json.NewDecoder(io.LimitReader(object.Body, 1<<20)).Decode(&metadata); err != nil {
		return "", fmt.Errorf("decoding IVS recording metadata: %w", err)
	}
	if metadata.Status != "RECORDING_ENDED" || metadata.Media.HLS.Path == "" || metadata.Media.HLS.Playlist == "" {
		return "", errors.New("IVS recording metadata is incomplete or unsuccessful")
	}
	key = path.Join(source.Prefix, metadata.Media.HLS.Path, metadata.Media.HLS.Playlist)
	return "s3://" + source.Bucket + "/" + key, nil
}

func (p *Provider) destination(id shared.RecordingImportID) string {
	return "s3://" + p.cfg.OutputBucket + "/" + strings.Trim(p.cfg.OutputPrefix, "/") + "/" + id.String() + "/"
}

func (p *Provider) deleteOutput(ctx context.Context, ref string) error {
	bucket, key, ok := splitS3(ref)
	if !ok || bucket != p.cfg.OutputBucket {
		return errors.New("recording output is outside the configured processing bucket")
	}
	if _, err := p.s3.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)}); err != nil {
		return fmt.Errorf("removing processed recording: %w", err)
	}
	return nil
}

func configured(cfg Config) bool {
	return strings.TrimSpace(cfg.Region) != "" && strings.TrimSpace(cfg.SourceBucket) != "" && strings.TrimSpace(cfg.OutputBucket) != "" && strings.TrimSpace(cfg.RoleARN) != "" && strings.TrimSpace(cfg.JobTemplate) != "" && strings.TrimSpace(cfg.CloudName) != "" && strings.TrimSpace(cfg.CloudinaryKey) != "" && strings.TrimSpace(cfg.CloudinarySecret) != "" && cfg.Clock != nil
}

func defaults(cfg Config) Config {
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = http.DefaultClient
	}
	if strings.TrimSpace(cfg.OutputPrefix) == "" {
		cfg.OutputPrefix = "kurasikapa/recordings"
	}
	return cfg
}

func validPrefix(prefix string) bool {
	cleaned := path.Clean("/" + prefix)
	return strings.HasPrefix(strings.TrimPrefix(cleaned, "/"), "ivs/v1/") && !strings.Contains(prefix, "..")
}

func splitS3(ref string) (string, string, bool) {
	if !strings.HasPrefix(ref, "s3://") {
		return "", "", false
	}
	parts := strings.SplitN(strings.TrimPrefix(ref, "s3://"), "/", 2)
	return parts[0], func() string {
		if len(parts) == 2 {
			return parts[1]
		}
		return ""
	}(), len(parts) == 2 && parts[0] != "" && parts[1] != ""
}
