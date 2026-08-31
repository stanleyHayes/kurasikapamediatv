package recording

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/mediaconvert"
	mctypes "github.com/aws/aws-sdk-go-v2/service/mediaconvert/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/kurasikapa/api/internal/app/ports"
	fakes "github.com/kurasikapa/api/internal/app/testing"
)

type mediaConvertFake struct {
	createInput *mediaconvert.CreateJobInput
	createOut   *mediaconvert.CreateJobOutput
	createErr   error
	getOut      *mediaconvert.GetJobOutput
	getErr      error
}

func (f *mediaConvertFake) CreateJob(_ context.Context, input *mediaconvert.CreateJobInput, _ ...func(*mediaconvert.Options)) (*mediaconvert.CreateJobOutput, error) {
	f.createInput = input
	return f.createOut, f.createErr
}

func (f *mediaConvertFake) GetJob(context.Context, *mediaconvert.GetJobInput, ...func(*mediaconvert.Options)) (*mediaconvert.GetJobOutput, error) {
	return f.getOut, f.getErr
}

type s3Fake struct {
	body      string
	getErr    error
	deleteErr error
	deleted   *s3.DeleteObjectInput
}

func (f *s3Fake) GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return &s3.GetObjectOutput{Body: io.NopCloser(strings.NewReader(f.body))}, nil
}

func (f *s3Fake) DeleteObject(_ context.Context, input *s3.DeleteObjectInput, _ ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	f.deleted = input
	return &s3.DeleteObjectOutput{}, f.deleteErr
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) { return f(request) }

func recordingConfig(client *http.Client) Config {
	return Config{
		Region: "eu-west-1", SourceBucket: "ivs-source", OutputBucket: "media-output",
		RoleARN: "arn:aws:iam::123456789012:role/mediaconvert", JobTemplate: "kurasikapa-ivs-mp4",
		OutputPrefix: "kurasikapa/recordings", CloudName: "demo", CloudinaryKey: "key",
		CloudinarySecret: "secret", HTTPClient: client,
		Clock: fakes.FixedClock{At: time.Unix(1_800_000_000, 0)}, UploadURL: "https://cloudinary.test/upload",
	}
}

func source() ports.RecordingSource {
	return ports.RecordingSource{SourceRef: "session_1", Bucket: "ivs-source", Prefix: "ivs/v1/account/channel/date/session", ChannelName: "Evening News", Locale: "en", DurationSeconds: 60}
}

func metadata() string {
	return `{"recording_status":"RECORDING_ENDED","media":{"hls":{"path":"media/hls","playlist":"master.m3u8"}}}`
}

func TestStartDiscoversManifestAndCreatesIdempotentTranscode(t *testing.T) {
	mc := &mediaConvertFake{createOut: &mediaconvert.CreateJobOutput{Job: &mctypes.Job{Id: aws.String("job_1")}}}
	storage := &s3Fake{body: metadata()}
	provider, err := newWithClients(mc, storage, recordingConfig(http.DefaultClient))
	if err != nil {
		t.Fatal(err)
	}
	task, err := provider.Start(context.Background(), "import_1", source())
	if err != nil || task.TaskID != "job_1" || task.OutputRef != "s3://media-output/kurasikapa/recordings/import_1/master.mp4" {
		t.Fatalf("task=%+v err=%v", task, err)
	}
	input := aws.ToString(mc.createInput.Settings.Inputs[0].FileInput)
	destination := aws.ToString(mc.createInput.Settings.OutputGroups[0].OutputGroupSettings.FileGroupSettings.Destination)
	if input != "s3://ivs-source/ivs/v1/account/channel/date/session/media/hls/master.m3u8" || destination != "s3://media-output/kurasikapa/recordings/import_1/" || aws.ToString(mc.createInput.ClientRequestToken) != "import_1" {
		t.Fatalf("input=%s destination=%s token=%s", input, destination, aws.ToString(mc.createInput.ClientRequestToken))
	}
}

func TestStartRejectsUntrustedAndIncompleteSources(t *testing.T) {
	provider, _ := newWithClients(&mediaConvertFake{}, &s3Fake{body: metadata()}, recordingConfig(http.DefaultClient))
	untrusted := source()
	untrusted.Bucket = "attacker-bucket"
	if _, err := provider.Start(context.Background(), "import", untrusted); err == nil {
		t.Fatal("untrusted bucket accepted")
	}
	untrusted = source()
	untrusted.Prefix = "../../secret"
	if _, err := provider.Start(context.Background(), "import", untrusted); err == nil {
		t.Fatal("unsafe prefix accepted")
	}
	provider, _ = newWithClients(&mediaConvertFake{}, &s3Fake{body: `{}`}, recordingConfig(http.DefaultClient))
	if _, err := provider.Start(context.Background(), "import", source()); err == nil {
		t.Fatal("incomplete metadata accepted")
	}
	if _, err := newWithClients(&mediaConvertFake{}, &s3Fake{}, Config{}); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("missing config: %v", err)
	}
}

func TestCheckPromotesCompletedRecordingAndDeletesOnlyOutput(t *testing.T) {
	var form string
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(request.Body)
		form = string(body)
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"public_id":"kurasikapa/recordings/import_1","secure_url":"https://res.cloudinary.test/video/upload/import_1.mp4","bytes":4096,"width":1280,"height":720,"duration":60}`)), Header: http.Header{}}, nil
	})}
	mc := &mediaConvertFake{getOut: &mediaconvert.GetJobOutput{Job: &mctypes.Job{Status: mctypes.JobStatusComplete}}}
	storage := &s3Fake{}
	provider, _ := newWithClients(mc, storage, recordingConfig(client))
	result, err := provider.Check(context.Background(), "import_1", "job_1", "s3://media-output/kurasikapa/recordings/import_1/master.mp4")
	if err != nil || result.Status != ports.RecordingProviderReady || result.Delivery.Width != 1280 {
		t.Fatalf("result=%+v err=%v", result, err)
	}
	if !strings.Contains(form, "file=s3%3A%2F%2Fmedia-output") || !strings.Contains(form, "overwrite=true") {
		t.Fatalf("upload form=%s", form)
	}
	if aws.ToString(storage.deleted.Bucket) != "media-output" || aws.ToString(storage.deleted.Key) != "kurasikapa/recordings/import_1/master.mp4" {
		t.Fatalf("deleted=%+v", storage.deleted)
	}
}

func TestCheckProjectsProcessingFailureAndTransportErrors(t *testing.T) {
	provider, _ := newWithClients(&mediaConvertFake{getOut: &mediaconvert.GetJobOutput{Job: &mctypes.Job{Status: mctypes.JobStatusProgressing}}}, &s3Fake{}, recordingConfig(http.DefaultClient))
	result, err := provider.Check(context.Background(), "import", "job", "output")
	if err != nil || result.Status != ports.RecordingProviderProcessing {
		t.Fatalf("processing=%+v %v", result, err)
	}
	provider.mediaConvert = &mediaConvertFake{getOut: &mediaconvert.GetJobOutput{Job: &mctypes.Job{Status: mctypes.JobStatusError, ErrorMessage: aws.String("bad input")}}}
	result, err = provider.Check(context.Background(), "import", "job", "output")
	if err != nil || result.Status != ports.RecordingProviderFailed || result.FailureReason != "bad input" {
		t.Fatalf("failed=%+v %v", result, err)
	}
	provider.mediaConvert = &mediaConvertFake{getErr: errors.New("aws down")}
	if _, err = provider.Check(context.Background(), "import", "job", "output"); err == nil {
		t.Fatal("get error swallowed")
	}
	if _, err = (Unavailable{}).Start(context.Background(), "import", source()); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("unavailable: %v", err)
	}
}

func TestProviderPropagatesMetadataTranscodeUploadAndCleanupFailures(t *testing.T) {
	mc := &mediaConvertFake{createOut: &mediaconvert.CreateJobOutput{}}
	storage := &s3Fake{getErr: errors.New("s3 down")}
	provider, _ := newWithClients(mc, storage, recordingConfig(http.DefaultClient))
	if _, err := provider.Start(context.Background(), "import", source()); err == nil {
		t.Fatal("metadata read error swallowed")
	}
	storage.getErr, storage.body = nil, `{`
	if _, err := provider.Start(context.Background(), "import", source()); err == nil {
		t.Fatal("invalid metadata accepted")
	}
	storage.body, mc.createErr = metadata(), errors.New("mediaconvert down")
	if _, err := provider.Start(context.Background(), "import", source()); err == nil {
		t.Fatal("create error swallowed")
	}
	mc.createErr = nil
	if _, err := provider.Start(context.Background(), "import", source()); err == nil {
		t.Fatal("empty job id accepted")
	}

	mc.getOut = &mediaconvert.GetJobOutput{}
	if _, err := provider.Check(context.Background(), "import", "job", "output"); err == nil {
		t.Fatal("empty get job accepted")
	}
	client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusBadGateway, Body: io.NopCloser(strings.NewReader("down")), Header: http.Header{}}, nil
	})}
	provider.cfg.HTTPClient = client
	mc.getOut = &mediaconvert.GetJobOutput{Job: &mctypes.Job{Status: mctypes.JobStatusComplete}}
	if _, err := provider.Check(context.Background(), "import", "job", "s3://media-output/output.mp4"); err == nil {
		t.Fatal("upload failure swallowed")
	}
	provider.cfg.HTTPClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"public_id":"id","secure_url":"https://cdn.test/video.mp4","bytes":10,"duration":1}`)), Header: http.Header{}}, nil
	})}
	storage.deleteErr = errors.New("delete down")
	if _, err := provider.Check(context.Background(), "import", "job", "s3://media-output/output.mp4"); err == nil {
		t.Fatal("cleanup failure swallowed")
	}
	storage.deleteErr = nil
	if _, err := provider.Check(context.Background(), "import", "job", "s3://other/output.mp4"); err == nil {
		t.Fatal("foreign output accepted")
	}
}
