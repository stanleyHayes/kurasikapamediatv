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
	github.com/aws/aws-sdk-go-v2 v1.45.1 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.20 // indirect
	github.com/aws/aws-sdk-go-v2/config v1.33.1 // indirect
	github.com/aws/aws-sdk-go-v2/credentials v1.20.1 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.19.1 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.1 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.1 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.19 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/mediaconvert v1.100.0 // indirect
	github.com/aws/aws-sdk-go-v2/service/polly v1.62.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.109.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/signin v1.7.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.35.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.40.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.47.1 // indirect
	github.com/aws/smithy-go v1.28.1 // indirect
	github.com/klauspost/compress v1.17.6 // indirect
	github.com/xdg-go/pbkdf2 v1.0.0 // indirect
	github.com/xdg-go/scram v1.2.0 // indirect
	github.com/xdg-go/stringprep v1.0.4 // indirect
	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
	go.mongodb.org/mongo-driver/v2 v2.8.0 // indirect
	golang.org/x/crypto v0.33.0 // indirect
	golang.org/x/sync v0.22.0 // indirect
)
