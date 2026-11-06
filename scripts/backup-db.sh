#!/usr/bin/env sh
# ==============================================================================
# Telecalling CRM — Production PostgreSQL Automated Backup Script
# Creates a compressed, timestamped pg_dump snapshot and rotates old backups.
# ==============================================================================

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/telecalling_crm_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

echo "=========================================================="
echo "📦 STARTING TELECALLING CRM DATABASE BACKUP: ${TIMESTAMP}"
echo "=========================================================="

mkdir -p "${BACKUP_DIR}"

# Execute pg_dump with gzip compression
echo "▶ Dumping PostgreSQL database '${PGDATABASE:-telecalling_crm}' from host '${PGHOST:-postgres}'..."
pg_dump \
  -h "${PGHOST:-localhost}" \
  -U "${PGUSER:-telecalling}" \
  -d "${PGDATABASE:-telecalling_crm}" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "${BACKUP_FILE}"

# Verify backup integrity
echo "▶ Verifying backup archive integrity..."
gzip -t "${BACKUP_FILE}"

BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "✅ Backup successfully created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Prune old snapshots exceeding retention policy
echo "▶ Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "telecalling_crm_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -type f -name "telecalling_crm_*.sql.gz" | wc -l)
echo "✅ Active backup snapshots retained: ${TOTAL_BACKUPS}"
echo "=========================================================="
echo "🎉 BACKUP ROUTINE COMPLETED SUCCESSFULLY"
echo "=========================================================="

