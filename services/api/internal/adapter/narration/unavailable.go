package narration

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/shared"
)

// Unavailable keeps the API bootable while refusing every generation request.
type Unavailable struct{}

func (Unavailable) Start(context.Context, ports.NarrationRequest) (string, error) {
	return "", ErrNotConfigured
}

func (Unavailable) Check(context.Context, shared.NarrationJobID, string) (ports.NarrationProviderResult, error) {
	return ports.NarrationProviderResult{}, ErrNotConfigured
}
