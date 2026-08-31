package narration

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type uploadResponse struct {
	PublicID  string  `json:"public_id"`
	SecureURL string  `json:"secure_url"`
	Bytes     int64   `json:"bytes"`
	Duration  float64 `json:"duration"`
}

func (p *Provider) upload(ctx context.Context, jobID shared.NarrationJobID, audio io.Reader) (domainmedia.AssetDelivery, error) {
	timestamp := strconv.FormatInt(p.cfg.Clock.Now().Unix(), 10)
	publicID := jobID.String()
	serialized := "folder=" + p.cfg.Folder + "&overwrite=false&public_id=" + publicID + "&timestamp=" + timestamp
	digest := sha256.Sum256([]byte(serialized + p.cfg.CloudinarySecret))
	fields := map[string]string{
		"api_key": p.cfg.CloudinaryKey, "folder": p.cfg.Folder, "overwrite": "false",
		"public_id": publicID, "signature": hex.EncodeToString(digest[:]), "timestamp": timestamp,
	}
	body, contentType := multipartBody(audio, fields)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.uploadURL(), body)
	if err != nil {
		return domainmedia.AssetDelivery{}, fmt.Errorf("creating Cloudinary narration request: %w", err)
	}
	request.Header.Set("Content-Type", contentType)
	response, err := p.cfg.HTTPClient.Do(request)
	if err != nil {
		_ = body.Close()
		return domainmedia.AssetDelivery{}, fmt.Errorf("uploading narration to Cloudinary: %w", err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return domainmedia.AssetDelivery{}, fmt.Errorf("cloudinary narration upload returned %d: %s", response.StatusCode, strings.TrimSpace(string(message)))
	}
	var uploaded uploadResponse
	if err = json.NewDecoder(response.Body).Decode(&uploaded); err != nil {
		return domainmedia.AssetDelivery{}, fmt.Errorf("decoding Cloudinary narration upload: %w", err)
	}
	if err = validateUpload(uploaded); err != nil {
		return domainmedia.AssetDelivery{}, err
	}
	return domainmedia.AssetDelivery{
		ProviderID: uploaded.PublicID, SecureURL: uploaded.SecureURL,
		Bytes: uploaded.Bytes, DurationSeconds: uploaded.Duration,
	}, nil
}

func multipartBody(audio io.Reader, fields map[string]string) (*io.PipeReader, string) {
	reader, writer := io.Pipe()
	form := multipart.NewWriter(writer)
	go func() {
		var err error
		for key, value := range fields {
			if err = form.WriteField(key, value); err != nil {
				_ = writer.CloseWithError(err)
				return
			}
		}
		var part io.Writer
		if part, err = form.CreateFormFile("file", "article.mp3"); err == nil {
			_, err = io.Copy(part, audio)
		}
		if closeErr := form.Close(); err == nil {
			err = closeErr
		}
		_ = writer.CloseWithError(err)
	}()
	return reader, form.FormDataContentType()
}

func (p *Provider) uploadURL() string {
	if p.cfg.UploadURL != "" {
		return p.cfg.UploadURL
	}
	return "https://api.cloudinary.com/v1_1/" + url.PathEscape(p.cfg.CloudName) + "/video/upload"
}

func validateUpload(uploaded uploadResponse) error {
	parsed, err := url.Parse(uploaded.SecureURL)
	if uploaded.PublicID == "" || err != nil || parsed.Scheme != "https" || uploaded.Bytes <= 0 || uploaded.Duration <= 0 {
		return errors.New("cloudinary returned incomplete narration metadata")
	}
	return nil
}
