// Package cloudinary implements signed direct-upload operations without
// sending media bytes through the API service.
package cloudinary

import (
	"crypto/sha1" // Cloudinary response signatures use SHA-1 by default.
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
)

var (
	ErrNotConfigured  = errors.New("cloudinary is not configured")
	ErrInvalidReceipt = errors.New("cloudinary upload receipt is invalid")
)

type Signer struct{ cloudName, apiKey, apiSecret, folder string }

func NewSigner(cloudName, apiKey, apiSecret, folder string) *Signer {
	return &Signer{strings.TrimSpace(cloudName), strings.TrimSpace(apiKey), strings.TrimSpace(apiSecret), strings.Trim(strings.TrimSpace(folder), "/")}
}
func (s *Signer) SignUpload(request ports.UploadRequest) (ports.UploadTicket, error) {
	if !s.configured() {
		return ports.UploadTicket{}, ErrNotConfigured
	}
	timestamp, publicID := request.Timestamp.Unix(), request.AssetID.String()
	serialized := fmt.Sprintf("folder=%s&public_id=%s&timestamp=%d", s.folder, publicID, timestamp)
	signature := sha256.Sum256([]byte(serialized + s.apiSecret))
	resource := resourceType(request.Kind)
	return ports.UploadTicket{
		URL:    fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/upload", s.cloudName, resource),
		APIKey: s.apiKey, Signature: hex.EncodeToString(signature[:]), PublicID: publicID,
		ResourceType: resource, Folder: s.folder, Timestamp: timestamp,
	}, nil
}
func (s *Signer) VerifyUpload(receipt ports.UploadReceipt) error {
	if !s.configured() {
		return ErrNotConfigured
	}
	if receipt.PublicID == "" || receipt.SecureURL == "" || receipt.Version <= 0 || receipt.Bytes <= 0 || receipt.Signature == "" {
		return ErrInvalidReceipt
	}
	payload := fmt.Sprintf("public_id=%s&version=%d%s", receipt.PublicID, receipt.Version, s.apiSecret)
	expected := sha1.Sum([]byte(payload))
	presented, err := hex.DecodeString(receipt.Signature)
	if err != nil || len(presented) != len(expected) || subtle.ConstantTimeCompare(presented, expected[:]) != 1 {
		return ErrInvalidReceipt
	}
	return nil
}
func (s *Signer) configured() bool {
	return s.cloudName != "" && s.apiKey != "" && s.apiSecret != "" && s.folder != ""
}
func resourceType(kind domainmedia.AssetKind) string {
	if kind == domainmedia.AssetImage {
		return "image"
	}
	if kind == domainmedia.AssetVideo || kind == domainmedia.AssetAudio {
		return "video"
	}
	return "raw"
}
