#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Follope — Production Deployment Script for Hostinger VPS
# Run this script from the project root: ./deploy/deploy.sh
# -----------------------------------------------------------------------------

echo "==========================================="
echo "   🚀 Starting Follope Production Deploy    "
echo "==========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# 1. Verify .env exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found in project root."
  echo "Please copy .env.example to .env and configure AUTH_SECRET, POSTGRES_PASSWORD, etc."
  exit 1
fi

echo "📦 1/4 Building Web Client (Expo export for follope.com)..."
cd "${ROOT_DIR}/mobile"
npm ci
EXPO_PUBLIC_API_BASE_URL="https://api.follope.com/v1" npx expo export -p web
cd "${ROOT_DIR}"

echo "🐳 2/4 Building and Starting Docker Containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "⏳ Waiting for Database to be ready..."
sleep 5

echo "🗄️ 3/4 Applying Database Migrations..."
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy || true

echo "🌐 4/4 Reloading Nginx..."
if [ -f /etc/nginx/sites-available/follope ]; then
  sudo cp "${ROOT_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/follope
  sudo nginx -t && sudo systemctl reload nginx
  echo "✅ Nginx reloaded successfully."
else
  echo "ℹ️ Nginx site not linked yet. See deploy/HOSTINGER-SETUP.md for initial Nginx & SSL setup."
fi

echo "==========================================="
echo "   🎉 Follope Deployed Successfully!       "
echo "   Web: https://follope.com                "
echo "   API: https://api.follope.com/health     "
echo "==========================================="
