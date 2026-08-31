package recording

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type Unavailable struct{}

func (Unavailable) Start(context.Context, shared.RecordingImportID, ports.RecordingSource) (ports.RecordingTranscode, error) {
	return ports.RecordingTranscode{}, ErrNotConfigured
}

func (Unavailable) Check(context.Context, shared.RecordingImportID, string, string) (ports.RecordingProviderResult, error) {
	return ports.RecordingProviderResult{}, ErrNotConfigured
}
