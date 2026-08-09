package mongo_test

import (
	"context"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

// A real MongoDB, never a mocked driver.
//
// AGENTS.md requires it, and the reason is specific: the interesting bugs in
// this layer are query bugs. A mocked driver returns whatever the test author
// believed the query would match, which means a wrong filter and a wrong mock
// agree with each other and both pass. The keyset pagination and the $group
// aggregation in particular cannot be verified any other way.
//
// KURA_TEST_MONGO_URI points at an already-running replica set. Without it the
// suite skips: a developer with no Docker should not be blocked from running
// the domain and application tests, which are the ones that hold the rules.
//
// KURA_REQUIRE_MONGO turns that skip into a failure, and CI sets it. A suite
// that skips silently is a gate that never fires — this project has already
// shipped two of those (a Playwright run against a foreign server, and a
// dependency-cruiser rule disarmed by an unanchored exclusion), and both were
// invisible precisely because green meant nothing.
const (
	uriEnv     = "KURA_TEST_MONGO_URI"
	requireEnv = "KURA_REQUIRE_MONGO"
)

type harness struct {
	DB *mongo.Database
}

func newHarness(t *testing.T) harness {
	t.Helper()

	uri := os.Getenv(uriEnv)
	if uri == "" {
		if os.Getenv(requireEnv) != "" {
			t.Fatalf("%s is set but %s is not — integration tests cannot be skipped here", requireEnv, uriEnv)
		}

		t.Skipf("%s is not set — skipping MongoDB integration tests", uriEnv)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		t.Fatalf("connecting to %s: %v", uri, err)
	}

	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		t.Fatalf("pinging MongoDB: %v", err)
	}

	// A database per test, dropped afterwards. Sharing one would make these
	// tests order-dependent, and an order-dependent integration suite is a
	// suite that goes red for reasons nobody can reproduce.
	db := client.Database("kura_test_" + sanitise(t.Name()))

	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cleanupCancel()

		_ = db.Drop(cleanupCtx)
		_ = client.Disconnect(cleanupCtx)
	})

	return harness{DB: db}
}

// sanitise turns a Go test name into something Mongo accepts as a database name.
func sanitise(name string) string {
	out := make([]rune, 0, len(name))

	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			out = append(out, r)
		default:
			out = append(out, '_')
		}
	}

	return string(out)
}

// fixedClock is the Clock port, pinned so tests can assert on updatedAt.
type fixedClock struct{ at time.Time }

func (c fixedClock) Now() time.Time { return c.at }
