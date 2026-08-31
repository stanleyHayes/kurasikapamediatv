package editorial

import "github.com/kurasikapa/api/internal/domain/editorial"

// ArticleNarrationView is the editor-approved recording safe for Studio and readers.
type ArticleNarrationView struct {
	AssetID          string  `json:"assetId"`
	SourceRevisionID string  `json:"sourceRevisionId"`
	SecureURL        string  `json:"secureUrl"`
	MIMEType         string  `json:"mimeType"`
	DurationSeconds  float64 `json:"durationSeconds"`
	Voice            string  `json:"voice"`
}

func narrationViewOf(article editorial.Article) *ArticleNarrationView {
	narration, ok := article.Narration()
	if !ok {
		return nil
	}

	return &ArticleNarrationView{
		AssetID: narration.AssetID.String(), SourceRevisionID: narration.SourceRevisionID.String(),
		SecureURL: narration.SecureURL, MIMEType: narration.MIMEType,
		DurationSeconds: narration.DurationSeconds, Voice: narration.Voice,
	}
}
