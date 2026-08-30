#!/usr/bin/env bash
# Smoke-checks the deployed Go API after the API_URL cut-over.
# Mirrors docs/operations/deploy-api.md §3.
#
# Usage:
#   API_URL=https://kurasikapa-media-api.onrender.com scripts/smoke-api.sh
#   CRON_SECRET=... API_URL=... scripts/smoke-api.sh   # also tests the cron happy path
set -euo pipefail

: "${API_URL:?set API_URL to the deployed service, e.g. https://kurasikapa-media-api.onrender.com}"

fail=0

check() {
  local desc="$1" want="$2" url="$3"
  shift 3
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$@" "$url" 2>/dev/null || true)"
  if [[ "$want" == *"$got"* ]]; then
    echo "PASS  $desc (got $got)"
  else
    echo "FAIL  $desc (want $want, got $got)"
    fail=1
  fi
}

got="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/healthz" || true)"
if [[ "$got" == "200" ]]; then
  echo "PASS  GET /healthz (got $got)"
else
  echo "FAIL  GET /healthz (want 200, got $got)"
  fail=1
fi

check "POST /articles without a session" "403" \
  "$API_URL/articles" -H 'Content-Type: application/json' -d '{}'

check "POST /internal/publish-due with wrong secret" "404" \
  "$API_URL/internal/publish-due" -H 'Authorization: Bearer wrong-secret'

if [[ -n "${CRON_SECRET:-}" ]]; then
  check "POST /internal/publish-due with right secret" "200" \
    "$API_URL/internal/publish-due" -H "Authorization: Bearer $CRON_SECRET"
else
  echo "SKIP  cron happy path (CRON_SECRET unset)"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "smoke-check FAILED — unset API_URL in Vercel to fall back to the TS path" >&2
  exit 1
fi
echo "smoke-check OK"
