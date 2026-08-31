// Package narration generates long-form article audio with Amazon Polly and
// promotes completed recordings from private S3 staging into Cloudinary.
package narration

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/polly"
	pollytypes "github.com/aws/aws-sdk-go-v2/service/polly/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var ErrNotConfigured = ports.ErrNarrationNotConfigured

type pollyAPI interface {
	StartSpeechSynthesisTask(context.Context, *polly.StartSpeechSynthesisTaskInput, ...func(*polly.Options)) (*polly.StartSpeechSynthesisTaskOutput, error)
	GetSpeechSynthesisTask(context.Context, *polly.GetSpeechSynthesisTaskInput, ...func(*polly.Options)) (*polly.GetSpeechSynthesisTaskOutput, error)
}

type s3API interface {
	GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	DeleteObject(context.Context, *s3.DeleteObjectInput, ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
}

type Config struct {
	Region, Bucket                             string
	CloudName, CloudinaryKey, CloudinarySecret string
	Folder                                     string
	HTTPClient                                 *http.Client
	Clock                                      ports.Clock
	UploadURL                                  string
}

type Provider struct {
	polly pollyAPI
	s3    s3API
	cfg   Config
}

func New(ctx context.Context, cfg Config) (*Provider, error) {
	if !configured(cfg) {
		return nil, ErrNotConfigured
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(cfg.Region))
	if err != nil {
		return nil, fmt.Errorf("loading AWS narration configuration: %w", err)
	}
	return &Provider{polly: polly.NewFromConfig(awsCfg), s3: s3.NewFromConfig(awsCfg), cfg: defaults(cfg)}, nil
}

func newWithClients(pollyClient pollyAPI, s3Client s3API, cfg Config) (*Provider, error) {
	if !configured(cfg) {
		return nil, ErrNotConfigured
	}
	return &Provider{polly: pollyClient, s3: s3Client, cfg: defaults(cfg)}, nil
}

func (p *Provider) Start(ctx context.Context, request ports.NarrationRequest) (string, error) {
	prefix := p.outputPrefix(request.JobID)
	output, err := p.polly.StartSpeechSynthesisTask(ctx, &polly.StartSpeechSynthesisTaskInput{
		Engine: pollytypes.EngineGenerative, LanguageCode: languageCode(request.Locale),
		OutputFormat: pollytypes.OutputFormatMp3, OutputS3BucketName: aws.String(p.cfg.Bucket),
		OutputS3KeyPrefix: aws.String(prefix), Text: aws.String(request.Text),
		TextType: pollytypes.TextTypeText, VoiceId: pollytypes.VoiceId(request.Voice),
	})
	if err != nil {
		return "", fmt.Errorf("starting Polly narration: %w", err)
	}
	if output.SynthesisTask == nil || output.SynthesisTask.TaskId == nil || *output.SynthesisTask.TaskId == "" {
		return "", errors.New("polly narration response had no task id")
	}
	return *output.SynthesisTask.TaskId, nil
}

func (p *Provider) Check(ctx context.Context, jobID shared.NarrationJobID, taskID string) (ports.NarrationProviderResult, error) {
	output, err := p.polly.GetSpeechSynthesisTask(ctx, &polly.GetSpeechSynthesisTaskInput{TaskId: aws.String(taskID)})
	if err != nil {
		return ports.NarrationProviderResult{}, fmt.Errorf("checking Polly narration: %w", err)
	}
	if output.SynthesisTask == nil {
		return ports.NarrationProviderResult{}, errors.New("polly narration response had no task")
	}
	switch output.SynthesisTask.TaskStatus {
	case pollytypes.TaskStatusCompleted:
		delivery, promoteErr := p.promote(ctx, jobID, taskID)
		return ports.NarrationProviderResult{Status: ports.NarrationProviderReady, Delivery: delivery}, promoteErr
	case pollytypes.TaskStatusFailed:
		return ports.NarrationProviderResult{Status: ports.NarrationProviderFailed, FailureReason: aws.ToString(output.SynthesisTask.TaskStatusReason)}, nil
	default:
		return ports.NarrationProviderResult{Status: ports.NarrationProviderProcessing}, nil
	}
}

func (p *Provider) promote(ctx context.Context, jobID shared.NarrationJobID, taskID string) (domainmedia.AssetDelivery, error) {
	key := p.outputKey(jobID, taskID)
	object, err := p.s3.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(p.cfg.Bucket), Key: aws.String(key)})
	if err != nil {
		return domainmedia.AssetDelivery{}, fmt.Errorf("reading Polly narration output: %w", err)
	}
	defer func() { _ = object.Body.Close() }()
	delivery, err := p.upload(ctx, jobID, object.Body)
	if err != nil {
		return domainmedia.AssetDelivery{}, err
	}
	if _, err = p.s3.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(p.cfg.Bucket), Key: aws.String(key)}); err != nil {
		return domainmedia.AssetDelivery{}, fmt.Errorf("removing staged narration: %w", err)
	}
	return delivery, nil
}

func (p *Provider) outputPrefix(jobID shared.NarrationJobID) string {
	return strings.Trim(p.cfg.Folder, "/") + "/staging/" + jobID.String()
}

func (p *Provider) outputKey(jobID shared.NarrationJobID, taskID string) string {
	return p.outputPrefix(jobID) + "." + taskID + ".mp3"
}

func languageCode(locale string) pollytypes.LanguageCode {
	if locale == "fr" {
		return pollytypes.LanguageCodeFrFr
	}
	return pollytypes.LanguageCodeEnGb
}

func configured(cfg Config) bool {
	return strings.TrimSpace(cfg.Region) != "" && strings.TrimSpace(cfg.Bucket) != "" &&
		strings.TrimSpace(cfg.CloudName) != "" && strings.TrimSpace(cfg.CloudinaryKey) != "" &&
		strings.TrimSpace(cfg.CloudinarySecret) != "" && cfg.Clock != nil
}

func defaults(cfg Config) Config {
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = http.DefaultClient
	}
	if strings.TrimSpace(cfg.Folder) == "" {
		cfg.Folder = "kurasikapa/narrations"
	}
	return cfg
}
