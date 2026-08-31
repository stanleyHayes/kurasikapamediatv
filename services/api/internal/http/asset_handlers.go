package http

import (
	"net/http"
	"strconv"

	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type createAssetRequest struct {
	Kind                                         domainmedia.AssetKind
	Filename, MIMEType, Locale, AltText, Caption string
}
type completeAssetRequest struct {
	PublicID, SecureURL, Signature string
	Version, Bytes                 int64
	Width, Height                  int
	DurationSeconds                float64
}

func (d Deps) handleCreateAssetUpload(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input createAssetRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	result, err := d.CreateAssetUpload.Execute(r.Context(), actor, domainmedia.AssetState{
		Kind: input.Kind, Filename: input.Filename, MIMEType: input.MIMEType,
		Locale: input.Locale, AltText: input.AltText, Caption: input.Caption,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, map[string]any{"asset": assetView(result.Asset), "upload": uploadTicketView(result.Ticket)})
}
func uploadTicketView(ticket ports.UploadTicket) map[string]any {
	return map[string]any{
		"url": ticket.URL, "apiKey": ticket.APIKey, "signature": ticket.Signature,
		"publicId": ticket.PublicID, "resourceType": ticket.ResourceType,
		"folder": ticket.Folder, "timestamp": ticket.Timestamp,
	}
}
func (d Deps) handleCompleteAssetUpload(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input completeAssetRequest
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	asset, err := d.CompleteAssetUpload.Execute(r.Context(), actor, shared.AssetID(r.PathValue("id")), ports.UploadReceipt{
		PublicID: input.PublicID, SecureURL: input.SecureURL, Signature: input.Signature,
		Version: input.Version, Bytes: input.Bytes, Width: input.Width, Height: input.Height,
		DurationSeconds: input.DurationSeconds,
	})
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, assetView(asset))
}
func (d Deps) handleListAssets(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 40
	}
	assets, err := d.ListAssets.Execute(r.Context(), actor, r.URL.Query().Get("locale"), limit)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	items := make([]any, len(assets))
	for i, asset := range assets {
		items[i] = assetView(asset)
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": items})
}
func assetView(asset domainmedia.Asset) map[string]any {
	s := asset.State()
	return map[string]any{
		"id": s.ID.String(), "kind": s.Kind, "filename": s.Filename, "mimeType": s.MIMEType,
		"locale": s.Locale, "altText": s.AltText, "caption": s.Caption, "status": s.Status,
		"providerId": s.ProviderID, "secureUrl": s.SecureURL, "bytes": s.Bytes,
		"width": s.Width, "height": s.Height, "durationSeconds": s.DurationSeconds,
		"failureReason": s.FailureReason,
	}
}
