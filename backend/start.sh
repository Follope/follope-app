#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy || true
npx prisma db push --skip-generate

echo "Starting server..."
node dist/server.js
