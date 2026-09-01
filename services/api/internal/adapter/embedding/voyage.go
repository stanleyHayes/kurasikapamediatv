package embedding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/kurasikapa/api/internal/app/ports"
)

const voyageEndpoint = "https://api.voyageai.com/v1/embeddings"

type Voyage struct {
	client    *http.Client
	apiKey    string
	model     string
	dimension int
	Endpoint  string
}

func NewVoyage(client *http.Client, apiKey, model string, dimension int) *Voyage {
	return &Voyage{client: client, apiKey: strings.TrimSpace(apiKey), model: model, dimension: dimension, Endpoint: voyageEndpoint}
}

type request struct {
	Input           string              `json:"input"`
	Model           string              `json:"model"`
	InputType       ports.EmbeddingKind `json:"input_type"`
	OutputDimension int                 `json:"output_dimension"`
	Truncation      bool                `json:"truncation"`
}

type response struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
}

func (v *Voyage) Embed(ctx context.Context, text string, kind ports.EmbeddingKind) ([]float32, error) {
	if v.apiKey == "" {
		return nil, ports.ErrSemanticNotConfigured
	}
	payload, err := json.Marshal(request{Input: text, Model: v.model, InputType: kind, OutputDimension: v.dimension, Truncation: true})
	if err != nil {
		return nil, fmt.Errorf("encoding embedding request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("creating embedding request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+v.apiKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := v.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("requesting embedding: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return nil, fmt.Errorf("embedding provider returned %d: %s", res.StatusCode, strings.TrimSpace(string(message)))
	}
	var decoded response
	if err := json.NewDecoder(res.Body).Decode(&decoded); err != nil {
		return nil, fmt.Errorf("decoding embedding: %w", err)
	}
	if len(decoded.Data) != 1 || len(decoded.Data[0].Embedding) != v.dimension {
		return nil, fmt.Errorf("embedding provider returned unexpected dimensions")
	}
	return decoded.Data[0].Embedding, nil
}
