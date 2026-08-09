// Command api serves the Kurasikapa backend.
//
// The composition root, and the only place allowed to know about both an
// adapter and a use case. Everything below this file talks to interfaces.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	adaptermongo "github.com/kurasikapa/api/internal/adapter/mongo"
	appeditorial "github.com/kurasikapa/api/internal/app/editorial"
	kurahttp "github.com/kurasikapa/api/internal/http"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(log); err != nil {
		log.Error("fatal", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		return err
	}
	defer func() {
		disconnectCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = client.Disconnect(disconnectCtx)
	}()

	db := client.Database(cfg.MongoDB)

	// Ports on the left, adapters on the right. This is the only file where
	// both names appear.
	clock := systemClock{}
	articles := adaptermongo.NewArticleRepository(db, clock)
	revisions := adaptermongo.NewRevisionRepository(db)
	roles := adaptermongo.NewRoleRepository(db)

	if err := revisions.EnsureIndexes(ctx); err != nil {
		// Fatal, not a warning. The unique (articleId, seq) index is what makes
		// history monotonic — starting without it means a concurrent save can
		// silently lose a revision, which is the one failure this system must
		// not have.
		return err
	}

	deps := appeditorial.Deps{
		Articles:  articles,
		Revisions: revisions,
		Clock:     clock,
		IDs:       uuidIDs{},
		Events:    loggingBus{log: log},
	}

	handler := kurahttp.NewRouter(kurahttp.Deps{
		CreateDraft:        appeditorial.NewCreateDraft(deps),
		PublishArticle:     appeditorial.NewPublishArticle(deps),
		PublishDueArticles: appeditorial.NewPublishDueArticles(deps),
		Roles:              roles,
		Log:                log,
		CronSecret:         cfg.CronSecret,
	})

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: handler,
		// Bounded on purpose. A server with no timeouts holds a connection for
		// ever when a client stops reading, and the symptom is exhaustion under
		// load rather than an error anyone can trace.
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		<-ctx.Done()

		// Drain rather than drop. A publish in flight when a deploy lands
		// should finish, not become a half-written article.
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	log.Info("listening", slog.String("addr", server.Addr))

	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	return nil
}

type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now().UTC() }

type uuidIDs struct{}

// NewID returns a random 128-bit identifier as hex.
//
// crypto/rand, not math/rand. Ids appear in URLs, so a predictable one lets
// somebody guess the address of an unpublished draft.
func (uuidIDs) NewID() string {
	buf := make([]byte, 16)
	// rand.Read from crypto/rand never returns an error; it panics on failure,
	// which is correct — a process that cannot generate an id must not serve.
	_, _ = rand.Read(buf)

	return hex.EncodeToString(buf)
}
