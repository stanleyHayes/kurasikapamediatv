package recording

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
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
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	Duration  float64 `json:"duration"`
}

func (p *Provider) upload(ctx context.Context, id shared.RecordingImportID, source string) (domainmedia.AssetDelivery, error) {
	timestamp := strconv.FormatInt(p.cfg.Clock.Now().Unix(), 10)
	folder := strings.Trim(p.cfg.OutputPrefix, "/")
	publicID := id.String()
	serialized := "folder=" + folder + "&overwrite=true&public_id=" + publicID + "&timestamp=" + timestamp
	digest := sha256.Sum256([]byte(serialized + p.cfg.CloudinarySecret))
	form := url.Values{
		"api_key": {p.cfg.CloudinaryKey}, "file": {source}, "folder": {folder},
		"overwrite": {"true"}, "public_id": {publicID},
		"signature": {hex.EncodeToString(digest[:])}, "timestamp": {timestamp},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.uploadURL(), strings.NewReader(form.Encode()))
	if err != nil {
		return domainmedia.AssetDelivery{}, fmt.Errorf("creating Cloudinary recording request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := p.cfg.HTTPClient.Do(request)
	if err != nil {
		return domainmedia.AssetDelivery{}, fmt.Errorf("uploading recording to Cloudinary: %w", err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return domainmedia.AssetDelivery{}, fmt.Errorf("cloudinary recording upload returned %d", response.StatusCode)
	}
	var uploaded uploadResponse
	if err = json.NewDecoder(response.Body).Decode(&uploaded); err != nil {
		return domainmedia.AssetDelivery{}, fmt.Errorf("decoding Cloudinary recording upload: %w", err)
	}
	parsed, parseErr := url.Parse(uploaded.SecureURL)
	if uploaded.PublicID == "" || parseErr != nil || parsed.Scheme != "https" || uploaded.Bytes <= 0 || uploaded.Duration <= 0 {
		return domainmedia.AssetDelivery{}, errors.New("cloudinary returned incomplete recording metadata")
	}
	return domainmedia.AssetDelivery{ProviderID: uploaded.PublicID, SecureURL: uploaded.SecureURL, Bytes: uploaded.Bytes, Width: uploaded.Width, Height: uploaded.Height, DurationSeconds: uploaded.Duration}, nil
}

func (p *Provider) uploadURL() string {
	if p.cfg.UploadURL != "" {
		return p.cfg.UploadURL
	}
	return "https://api.cloudinary.com/v1_1/" + url.PathEscape(p.cfg.CloudName) + "/video/upload"
}
