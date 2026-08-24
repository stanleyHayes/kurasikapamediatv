module github.com/kurasikapa/api

go 1.26

// Floor, not a preference. go1.26.5 and earlier carry five reachable
// stdlib advisories this service trips on its own hot paths — GO-2026-6089
// and GO-2026-5026 (net/http, via ListenAndServe), GO-2026-6090 (crypto/tls),
// GO-2026-6218 (net/url) and GO-2026-5972 (encoding/asn1, via ApplyURI).
// The `go` directive above only sets the language version; without this line
// a build on an older toolchain is silently vulnerable and govulncheck in CI
// is the only thing that notices.
toolchain go1.26.7

require golang.org/x/text v0.40.0

require (
	github.com/klauspost/compress v1.17.6 // indirect
	github.com/xdg-go/pbkdf2 v1.0.0 // indirect
	github.com/xdg-go/scram v1.2.0 // indirect
	github.com/xdg-go/stringprep v1.0.4 // indirect
	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
	go.mongodb.org/mongo-driver/v2 v2.8.0 // indirect
	golang.org/x/crypto v0.33.0 // indirect
	golang.org/x/sync v0.22.0 // indirect
)
