#!/bin/sh
set -e

host="$1"
shift

until nc -z "$host" 5432; do
  echo "⏳ PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "✅ PostgreSQL is up - executing command"
exec "$@"
