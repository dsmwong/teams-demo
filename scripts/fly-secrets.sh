#!/usr/bin/env bash
# Reads .env and sets all non-infrastructure vars as Fly.io secrets.
# PORT and NODE_ENV are excluded — they're already in fly.toml.

set -e

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy .env.example to .env and fill in your values first."
  exit 1
fi

SECRETS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == PORT=* || "$line" == NODE_ENV=* ]] && continue
  SECRETS+=("$line")
done < .env

if [ ${#SECRETS[@]} -eq 0 ]; then
  echo "No secrets to set (all vars were excluded or .env is empty)."
  exit 0
fi

echo "Setting ${#SECRETS[@]} secret(s)..."
fly secrets set "${SECRETS[@]}"
echo "Done."
