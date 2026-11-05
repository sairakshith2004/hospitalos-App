#!/bin/sh
# Creates (or re-verifies) the HospitalOS Mobile databases and roles inside OUR container only.
# Addresses Compose project "hospitalos-mobile" explicitly, so it can never reach the reference
# project's containers. Passwords travel as environment variables into psql, which reads them with
# \getenv; they are never printed or passed as arguments.
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env. Run 'npm run env:init' first." >&2
  exit 1
fi

set -a
. ./.env
set +a

for name in POSTGRES_USER HOS_OWNER_PASSWORD HOS_APP_PASSWORD; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "$name is not set in .env" >&2
    exit 1
  fi
done
for name in HOS_OWNER_PASSWORD HOS_APP_PASSWORD; do
  eval "value=\${$name}"
  if [ "${#value}" -lt 32 ]; then
    echo "$name must be at least 32 characters (run npm run env:init)" >&2
    exit 1
  fi
done

# Only ever our own container.
container="$(docker compose -p hospitalos-mobile ps -q db)"
if [ -z "$container" ]; then
  echo "The hospitalos-mobile db container is not running. Run 'npm run db:up' first." >&2
  exit 1
fi
name="$(docker inspect -f '{{.Name}}' "$container")"
if [ "$name" != "/hospitalos-mobile-db" ]; then
  echo "Unexpected container $name; refusing." >&2
  exit 1
fi

docker compose -p hospitalos-mobile exec -T \
  -e HOS_OWNER_PASSWORD -e HOS_APP_PASSWORD \
  db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -f - \
  < docker/postgres/init/01-roles-and-databases.sql

echo "db:init finished."
