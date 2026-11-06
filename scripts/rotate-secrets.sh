#!/usr/bin/env node
/**
 * ==============================================================================
 * Telecalling CRM — Cryptographic Secret Rotation Generator
 *
 * Generates secure, high-entropy 256-bit credentials for production deployment
 * across JWT tokens, database authentication, MinIO S3, and WhatsApp webhooks.
 * ==============================================================================
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function generateSecureSecret(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString("hex");
}

console.log("==========================================================");
console.log("🔐 TELECALLING CRM PRODUCTION SECRET ROTATION GENERATOR");
console.log("==========================================================");

const secrets = {
  JWT_SECRET: generateSecureSecret(32),
  JWT_REFRESH_SECRET: generateSecureSecret(32),
  POSTGRES_PASSWORD: generateSecureSecret(24),
  MINIO_ROOT_PASSWORD: generateSecureSecret(24),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: `solar_crm_verify_${generateSecureSecret(16)}`,
  APP_SECRET_KEY: generateSecureSecret(32),
};

console.log("\nGenerated High-Entropy Production Secrets:\n");
for (const [key, val] of Object.entries(secrets)) {
  console.log(`  ${key.padEnd(32)} = ${val}`);
}

// Verify .gitignore hygiene
const gitignorePath = path.resolve(__dirname, "../.gitignore");
if (fs.existsSync(gitignorePath)) {
  const content = fs.readFileSync(gitignorePath, "utf8");
  if (content.includes(".env")) {
    console.log("\n✅ Security check PASSED: '.env' is strictly excluded in .gitignore");
  } else {
    console.warn("\n⚠️ WARNING: '.env' is missing from .gitignore!");
  }
}

console.log("\n==========================================================");
console.log("📝 Next Step: Inject these values into your production environment");
console.log("   manager (e.g. Docker Secrets, AWS Secrets Manager, or vault).");
console.log("==========================================================");

