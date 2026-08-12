# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install git and ca-certs for Go module fetching.
RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . ./

# Build a static binary. CGO is disabled so the scratch image can run it.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /api ./cmd/api

# Runtime stage
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /

COPY --from=builder /api /api
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# The service listens on $PORT (default 8080).
EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/api"]
