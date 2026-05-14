#!/usr/bin/env bash
# Pre-deploy validation — run before every production deployment.
# Exits non-zero on the first failure so CI aborts the deploy.
set -euo pipefail

echo "==> ProteaAI pre-deploy validation"

# 1. TypeScript strict type check
echo "[1/5] TypeScript type check..."
npx tsc --noEmit

# 2. Lint + format
echo "[2/5] Lint & format..."
npm run presubmit

# 3. Unit tests
echo "[3/5] Unit tests..."
npm run test

# 4. Build both targets (catches import errors, missing modules, etc.)
echo "[4/5] Production build..."
npm run build:web

# 5. Required environment variables check
echo "[5/5] Environment variables..."
REQUIRED_VARS=(
  "JWT_SECRET"
  "SECRET_KEY"
  "NODE_ENV"
  "APP_BASE_URL"
  "CORS_ORIGIN"
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "  ERROR: \$$var is not set"
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ]; then
  echo "Pre-deploy FAILED: missing required environment variables."
  exit 1
fi

# Warn (not fail) if Stripe is partially configured
STRIPE_VARS=(STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRO_PRICE_ID)
STRIPE_SET=0
STRIPE_MISSING=0
for var in "${STRIPE_VARS[@]}"; do
  if [ -n "${!var:-}" ]; then STRIPE_SET=$((STRIPE_SET+1)); else STRIPE_MISSING=$((STRIPE_MISSING+1)); fi
done
if [ "$STRIPE_SET" -gt 0 ] && [ "$STRIPE_MISSING" -gt 0 ]; then
  echo "  WARNING: Stripe is partially configured ($STRIPE_SET/3 vars set). Billing may not work."
fi

echo ""
echo "Pre-deploy validation PASSED."
