package http

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/kurasikapa/api/internal/app/ports"
)

const recordingEventLimit = 64 << 10

type ivsRecordingEvent struct {
	Source     string   `json:"source"`
	DetailType string   `json:"detail-type"`
	Resources  []string `json:"resources"`
	Detail     struct {
		ChannelName    string `json:"channel_name"`
		SessionID      string `json:"recording_session_id"`
		Status         string `json:"recording_status"`
		Bucket         string `json:"recording_s3_bucket_name"`
		Prefix         string `json:"recording_s3_key_prefix"`
		DurationMillis int64  `json:"recording_duration_ms"`
	} `json:"detail"`
}

func (d Deps) handleIVSRecording(w http.ResponseWriter, r *http.Request) {
	if !d.validIVSSecret(r.Header.Get("X-Kurasikapa-IVS-Secret")) {
		http.NotFound(w, r)
		return
	}
	var event ivsRecordingEvent
	decoder := json.NewDecoder(io.LimitReader(r.Body, recordingEventLimit))
	if err := decoder.Decode(&event); err != nil {
		writeProblem(w, d.Log, errMalformedRequest)
		return
	}
	source, err := recordingSource(event)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	job, err := d.ReceiveRecording.Execute(r.Context(), systemActor(), source)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusAccepted, map[string]string{"id": job.ID().String(), "status": string(job.State().Status)})
}

func (d Deps) handleProcessRecordings(w http.ResponseWriter, r *http.Request) {
	if !d.requireCron(r) {
		http.NotFound(w, r)
		return
	}
	result, err := d.ProcessRecordings.Execute(r.Context(), systemActor())
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	status := http.StatusOK
	if len(result.Failed) > 0 {
		status = http.StatusMultiStatus
	}
	writeJSON(w, d.Log, status, result)
}

func (d Deps) validIVSSecret(provided string) bool {
	expected := d.IVSWebhookSecret
	return expected != "" && len(provided) == len(expected) && subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func recordingSource(event ivsRecordingEvent) (ports.RecordingSource, error) {
	if event.Source != "aws.ivs" || event.DetailType != "IVS Recording State Change" || event.Detail.Status != "Recording End" || len(event.Resources) != 1 || !strings.HasPrefix(event.Resources[0], "arn:aws:ivs:") || event.Detail.SessionID == "" || event.Detail.Bucket == "" || event.Detail.Prefix == "" || event.Detail.DurationMillis <= 0 {
		return ports.RecordingSource{}, errInvalidWebhookEvent
	}
	locale, title, ok := strings.Cut(event.Detail.ChannelName, ":")
	locale, title = strings.TrimSpace(locale), strings.TrimSpace(title)
	if !ok || (locale != "en" && locale != "fr") || title == "" {
		return ports.RecordingSource{}, errInvalidWebhookEvent
	}
	return ports.RecordingSource{
		SourceRef: event.Detail.SessionID, Bucket: event.Detail.Bucket, Prefix: event.Detail.Prefix,
		ChannelName: title, Locale: locale, DurationSeconds: float64(event.Detail.DurationMillis) / 1000,
	}, nil
}
