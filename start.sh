#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -f .env ]]; then
  echo "Create .env with your local database URL and administrator settings. See README.md." >&2
  exit 1
fi

if [[ ! -x node_modules/.bin/vite ]]; then
  npm ci
fi

postgres_dir="$PWD/.lago-local/postgres"
if [[ -f "$postgres_dir/PG_VERSION" ]]; then
  postgres_major=$(<"$postgres_dir/PG_VERSION")
  postgres_ctl=
  for candidate in "$(command -v pg_ctl || true)" \
    "/opt/homebrew/opt/postgresql@$postgres_major/bin/pg_ctl" \
    "/usr/local/opt/postgresql@$postgres_major/bin/pg_ctl"; do
    if [[ -x "$candidate" ]] && \
      [[ "$("$candidate" --version)" == "pg_ctl (PostgreSQL) $postgres_major."* ]]; then
      postgres_ctl="$candidate"
      break
    fi
  done
  if [[ -z "$postgres_ctl" ]]; then
    echo "This local database requires PostgreSQL $postgres_major. Install that version and add its bin directory to PATH." >&2
    exit 1
  fi
  if ! "$postgres_ctl" -D "$postgres_dir" status >/dev/null; then
    if ! "$postgres_ctl" -D "$postgres_dir" -l "$PWD/.lago-local/postgres.log" start; then
      tail -n 30 "$PWD/.lago-local/postgres.log" >&2
      exit 1
    fi
  fi
fi

if lsof -tiTCP:3000 -sTCP:LISTEN >/dev/null; then
  echo "Port 3000 is already in use. Stop the other app before starting Lago." >&2
  exit 1
fi

api_pid=
web_pid=
cleanup() {
  if [[ -n "$web_pid" ]]; then
    kill "$web_pid" 2>/dev/null || true
    wait "$web_pid" 2>/dev/null || true
  fi
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

NODE_ENV=development HOST=127.0.0.1 PORT=3000 node --env-file=.env server/index.js &
api_pid=$!

./node_modules/.bin/vite --host 127.0.0.1 --port 5173 --strictPort &
web_pid=$!

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
  sleep 1
done

echo "A Lago process stopped. See the output above." >&2
exit 1
