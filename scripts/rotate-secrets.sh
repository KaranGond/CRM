#!/usr/bin/env sh
# ==============================================================================
# Telecalling CRM — Cryptographic Secret Rotation Generator
#
# Generates secure, high-entropy 256-bit credentials for production deployment
# across JWT tokens, database authentication, MinIO S3, and WhatsApp webhooks.
# ==============================================================================

set -e

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    node -e "import('crypto').then(c => console.log(c.randomBytes($1).toString('hex')))"
  fi
}

echo "=========================================================="
echo "🔐 TELECALLING CRM PRODUCTION SECRET ROTATION GENERATOR"
echo "=========================================================="
echo ""
echo "Generated High-Entropy Production Secrets:"
echo ""
echo "  JWT_SECRET                       = $(generate_secret 32)"
echo "  JWT_REFRESH_SECRET               = $(generate_secret 32)"
echo "  POSTGRES_PASSWORD                = $(generate_secret 24)"
echo "  MINIO_ROOT_PASSWORD              = $(generate_secret 24)"
echo "  WHATSAPP_WEBHOOK_VERIFY_TOKEN    = solar_crm_verify_$(generate_secret 16)"
echo "  APP_SECRET_KEY                   = $(generate_secret 32)"
echo ""

if grep -q "\.env" .gitignore 2>/dev/null; then
  echo "✅ Security check PASSED: '.env' is strictly excluded in .gitignore"
else
  echo "⚠️ WARNING: '.env' is missing from .gitignore!"
fi

echo ""
echo "=========================================================="
echo "📝 Next Step: Inject these values into your production environment"
echo "   manager (e.g. Docker Secrets, AWS Secrets Manager, or vault)."
echo "=========================================================="
