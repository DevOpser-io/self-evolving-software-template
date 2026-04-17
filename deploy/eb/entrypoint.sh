#!/bin/bash
set -euo pipefail

echo "==> entrypoint: running migrations"
cd /app/backend
./migrate.sh

echo "==> entrypoint: starting server"
exec node server.js
