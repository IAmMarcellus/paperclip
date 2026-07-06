#!/usr/bin/env bash
#
# paperclip-api.sh — authenticated Paperclip API client for agents.
#
# ALWAYS attaches `Authorization: Bearer $PAPERCLIP_API_KEY` and
# `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID` from the environment, so every request
# is attributed to THIS agent + run. A raw `curl` that forgets those headers is
# silently accepted as the local operator ("Board") rather than as you — this
# wrapper makes that impossible by construction, and fails loudly if the
# credential is missing instead of sending an unauthenticated request.
#
# Usage:
#   paperclip-api.sh <METHOD> <path> [body]
#
#   <METHOD>   GET | POST | PATCH | PUT | DELETE  (case-insensitive)
#   <path>     API path, e.g. /issues/CEL-1/comments  (leading /api is optional)
#   [body]     JSON string, or @FILE to read a file, or - to read stdin
#
# Examples:
#   paperclip-api.sh GET   /agents/me
#   paperclip-api.sh POST  /issues/CEL-1/comments '{"body":"done"}'
#   paperclip-api.sh PATCH /issues/CEL-1 '{"status":"done"}'
#   printf '%s' "$json" | paperclip-api.sh POST /issues/CEL-1/comments -
#
# Prints the response body to stdout on 2xx (exit 0). On a non-2xx status it
# prints the method/url/status and the response body to stderr and exits 1.

set -euo pipefail

usage() {
  sed -n '3,27p' "$0" | sed 's/^#\{0,1\} \{0,1\}//'
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

method_raw="${1:-}"
path="${2:-}"

if [[ -z "$method_raw" || -z "$path" ]]; then
  printf 'usage: paperclip-api.sh <METHOD> <path> [body]\n' >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  printf 'paperclip-api.sh: curl is required\n' >&2
  exit 1
fi

# Fail loud if the credential is missing rather than sending a bare request that
# would be silently misattributed to the operator ("Board").
: "${PAPERCLIP_API_URL:?paperclip-api.sh: PAPERCLIP_API_URL is not set}"
: "${PAPERCLIP_API_KEY:?paperclip-api.sh: PAPERCLIP_API_KEY is not set — agent credential missing; refusing to send an unauthenticated request}"
: "${PAPERCLIP_RUN_ID:?paperclip-api.sh: PAPERCLIP_RUN_ID is not set}"

method="$(printf '%s' "$method_raw" | tr '[:lower:]' '[:upper:]')"

host="${PAPERCLIP_API_URL%/}"
case "$path" in
  http://*|https://*) url="$path" ;;
  /api/*)             url="$host$path" ;;
  /*)                 url="$host/api$path" ;;
  *)                  url="$host/api/$path" ;;
esac

# Resolve an optional request body: literal JSON, @FILE, or - for stdin.
have_body=0
body=""
if [[ $# -ge 3 ]]; then
  have_body=1
  case "$3" in
    -)  body="$(cat)" ;;
    @*) body="$(cat "${3#@}")" ;;
    *)  body="$3" ;;
  esac
fi

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

if [[ "$have_body" == "1" ]]; then
  status_code="$(
    curl -sS -X "$method" -w '%{http_code}' -o "$response_file" "$url" \
      -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
      -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
      -H 'Content-Type: application/json' \
      --data-binary "$body"
  )"
else
  status_code="$(
    curl -sS -X "$method" -w '%{http_code}' -o "$response_file" "$url" \
      -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
      -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID"
  )"
fi

if [[ "$status_code" -lt 200 || "$status_code" -ge 300 ]]; then
  printf 'paperclip-api.sh: %s %s -> HTTP %s\n' "$method" "$url" "$status_code" >&2
  cat "$response_file" >&2
  printf '\n' >&2
  exit 1
fi

cat "$response_file"
