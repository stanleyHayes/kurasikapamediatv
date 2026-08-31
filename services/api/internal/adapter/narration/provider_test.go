package narration

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/polly"
	pollytypes "github.com/aws/aws-sdk-go-v2/service/polly/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/kurasikapa/api/internal/app/ports"
	faketesting "github.com/kurasikapa/api/internal/app/testing"
)

type pollyFake struct {
	startInput *polly.StartSpeechSynthesisTaskInput
	status     pollytypes.TaskStatus
	reason     string
}

func (f *pollyFake) StartSpeechSynthesisTask(_ context.Context, input *polly.StartSpeechSynthesisTaskInput, _ ...func(*polly.Options)) (*polly.StartSpeechSynthesisTaskOutput, error) {
	f.startInput = input
	return &polly.StartSpeechSynthesisTaskOutput{SynthesisTask: &pollytypes.SynthesisTask{TaskId: aws.String("task_1")}}, nil
}

func (f *pollyFake) GetSpeechSynthesisTask(_ context.Context, _ *polly.GetSpeechSynthesisTaskInput, _ ...func(*polly.Options)) (*polly.GetSpeechSynthesisTaskOutput, error) {
	return &polly.GetSpeechSynthesisTaskOutput{SynthesisTask: &pollytypes.SynthesisTask{
		TaskStatus: f.status, TaskStatusReason: aws.String(f.reason),
	}}, nil
}

type s3Fake struct {
	getKey, deletedKey string
}

func (f *s3Fake) GetObject(_ context.Context, input *s3.GetObjectInput, _ ...func(*s3.Options)) (*s3.GetObjectOutput, error) {
	f.getKey = aws.ToString(input.Key)
	return &s3.GetObjectOutput{Body: io.NopCloser(strings.NewReader("mp3 frames"))}, nil
}

func (f *s3Fake) DeleteObject(_ context.Context, input *s3.DeleteObjectInput, _ ...func(*s3.Options)) (*s3.DeleteObjectOutput, error) {
	f.deletedKey = aws.ToString(input.Key)
	return &s3.DeleteObjectOutput{}, nil
}

func narrationConfig(serverURL string) Config {
	return Config{
		Region: "eu-west-2", Bucket: "narration-staging", CloudName: "demo",
		CloudinaryKey: "key", CloudinarySecret: "secret", Folder: "kurasikapa/narrations",
		HTTPClient: http.DefaultClient, UploadURL: serverURL,
		Clock: faketesting.FixedClock{At: time.Unix(1_700_000_000, 0)},
	}
}

func TestProviderStartsGenerativeLongFormTask(t *testing.T) {
	t.Parallel()
	pollyClient, objectStore := &pollyFake{}, &s3Fake{}
	provider, err := newWithClients(pollyClient, objectStore, narrationConfig("https://upload.test"))
	if err != nil {
		t.Fatal(err)
	}
	taskID, err := provider.Start(context.Background(), ports.NarrationRequest{
		JobID: "job_1", Text: "Market report.", Locale: "en", Voice: "Amy",
	})
	if err != nil || taskID != "task_1" {
		t.Fatalf("task = %q error = %v", taskID, err)
	}
	input := pollyClient.startInput
	if input.Engine != pollytypes.EngineGenerative || input.LanguageCode != pollytypes.LanguageCodeEnGb || aws.ToString(input.OutputS3KeyPrefix) != "kurasikapa/narrations/staging/job_1" {
		t.Fatalf("start input = %#v", input)
	}
}

func TestProviderPromotesCompletedAudioAndRemovesStagingObject(t *testing.T) {
	t.Parallel()
	upload := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Error(err)
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			t.Error(err)
		} else {
			payload, _ := io.ReadAll(file)
			if string(payload) != "mp3 frames" {
				t.Errorf("audio = %q", payload)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"public_id":"kurasikapa/narrations/job_1","secure_url":"https://res.cloudinary.com/demo/video/upload/job_1.mp3","bytes":4096,"duration":92.5}`)
	}))
	defer upload.Close()
	pollyClient := &pollyFake{status: pollytypes.TaskStatusCompleted}
	objectStore := &s3Fake{}
	provider, _ := newWithClients(pollyClient, objectStore, narrationConfig(upload.URL))

	result, err := provider.Check(context.Background(), "job_1", "task_1")
	if err != nil || result.Status != ports.NarrationProviderReady || result.Delivery.DurationSeconds != 92.5 {
		t.Fatalf("result = %+v error = %v", result, err)
	}
	wantKey := "kurasikapa/narrations/staging/job_1.task_1.mp3"
	if objectStore.getKey != wantKey || objectStore.deletedKey != wantKey {
		t.Fatalf("get = %q delete = %q", objectStore.getKey, objectStore.deletedKey)
	}
}

func TestProviderReportsProcessingAndFailureWithoutFetchingAudio(t *testing.T) {
	t.Parallel()
	pollyClient := &pollyFake{status: pollytypes.TaskStatusInProgress}
	objectStore := &s3Fake{}
	provider, _ := newWithClients(pollyClient, objectStore, narrationConfig("https://upload.test"))
	result, err := provider.Check(context.Background(), "job_1", "task_1")
	if err != nil || result.Status != ports.NarrationProviderProcessing || objectStore.getKey != "" {
		t.Fatalf("processing = %+v error = %v", result, err)
	}
	pollyClient.status, pollyClient.reason = pollytypes.TaskStatusFailed, "voice rejected"
	result, err = provider.Check(context.Background(), "job_1", "task_1")
	if err != nil || result.Status != ports.NarrationProviderFailed || result.FailureReason != "voice rejected" {
		t.Fatalf("failed = %+v error = %v", result, err)
	}
}
