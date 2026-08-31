package cloudinary

import (
	"net/url"
	"path"
	"strings"

	"github.com/kurasikapa/api/internal/app/ports"
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
)

// Delivery derives Cloudinary's adaptive HLS manifest and a first-frame poster
// from the immutable original. Cloudinary creates each transformation lazily.
type Delivery struct{}

func NewDelivery() Delivery { return Delivery{} }

func (Delivery) Project(asset domainmedia.Asset) ports.VideoDelivery {
	state := asset.State()
	fallback := ports.VideoDelivery{PlaybackURL: state.SecureURL, MIMEType: state.MIMEType}
	if state.Kind != domainmedia.AssetVideo {
		return fallback
	}
	parsed, err := url.Parse(state.SecureURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host != "res.cloudinary.com" {
		return fallback
	}
	marker := "/video/upload/"
	index := strings.Index(parsed.Path, marker)
	if index < 0 {
		return fallback
	}
	prefix, source := parsed.Path[:index+len(marker)], parsed.Path[index+len(marker):]
	withoutExtension := strings.TrimSuffix(source, path.Ext(source))
	playback, poster := *parsed, *parsed
	playback.Path = prefix + "sp_auto/" + withoutExtension + ".m3u8"
	poster.Path = prefix + "so_0,f_jpg,q_auto/" + withoutExtension + ".jpg"
	return ports.VideoDelivery{
		PlaybackURL: playback.String(), PosterURL: poster.String(),
		MIMEType: "application/vnd.apple.mpegurl",
	}
}
