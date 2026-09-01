package embedding_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kurasikapa/api/internal/adapter/embedding"
	"github.com/kurasikapa/api/internal/app/ports"
)

func TestVoyageEmbedsRetrievalInput(t *testing.T) {
	var body, authorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		buffer := new(strings.Builder)
		_, _ = io.Copy(buffer, r.Body)
		body = buffer.String()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"embedding":[0.1,0.2]}]}`))
	}))
	defer server.Close()

	client := embedding.NewVoyage(server.Client(), "secret", "voyage-4", 2)
	client.Endpoint = server.URL
	vector, err := client.Embed(context.Background(), "Ghana budget", ports.EmbeddingQuery)
	if err != nil {
		t.Fatal(err)
	}
	if len(vector) != 2 || authorization != "Bearer secret" {
		t.Fatalf("vector=%v auth=%q", vector, authorization)
	}
	if !strings.Contains(body, `"input_type":"query"`) || !strings.Contains(body, `"output_dimension":2`) {
		t.Fatalf("body=%s", body)
	}
}

func TestVoyageFailsClosed(t *testing.T) {
	unconfigured := embedding.NewVoyage(http.DefaultClient, "", "voyage-4", 1024)
	if _, err := unconfigured.Embed(context.Background(), "query", ports.EmbeddingQuery); err != ports.ErrSemanticNotConfigured {
		t.Fatalf("error=%v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
	}))
	defer server.Close()
	client := embedding.NewVoyage(server.Client(), "secret", "voyage-4", 2)
	client.Endpoint = server.URL
	if _, err := client.Embed(context.Background(), "query", ports.EmbeddingQuery); err == nil {
		t.Fatal("expected upstream error")
	}
}
