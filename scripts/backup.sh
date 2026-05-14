#!/usr/bin/env bash
# Database backup script for ProteaAI.
# SQLite in WAL mode is safe to copy while the server is running.
#
# Usage:
#   ./scripts/backup.sh                          # local backup only
#   S3_BUCKET=my-bucket ./scripts/backup.sh      # local + S3 upload
#   FLY_APP=proteaai ./scripts/backup.sh         # backup from Fly.io volume
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_PATH="${PROTEAAI_DATA_DIR:-/data}/sqlite.db"
BACKUP_FILE="$BACKUP_DIR/proteaai_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

# ── Option A: local / in-container backup ────────────────────────────────────
if [ -z "${FLY_APP:-}" ]; then
  echo "==> Backing up $DB_PATH → $BACKUP_FILE"
  # Use SQLite's online backup API (safe with WAL mode and concurrent writes)
  sqlite3 "$DB_PATH" ".backup $BACKUP_FILE"
  echo "    Size: $(du -h "$BACKUP_FILE" | cut -f1)"

# ── Option B: Fly.io remote backup ───────────────────────────────────────────
else
  echo "==> Backing up Fly.io app '$FLY_APP' → $BACKUP_FILE"
  fly ssh console --app "$FLY_APP" -C \
    "sqlite3 /data/sqlite.db '.backup /tmp/backup.db'"
  fly sftp get --app "$FLY_APP" /tmp/backup.db "$BACKUP_FILE"
  echo "    Size: $(du -h "$BACKUP_FILE" | cut -f1)"
fi

# ── Optional: upload to S3 ────────────────────────────────────────────────────
if [ -n "${S3_BUCKET:-}" ]; then
  S3_KEY="${S3_PREFIX:-proteaai/backups}/proteaai_$TIMESTAMP.db"
  echo "==> Uploading to s3://$S3_BUCKET/$S3_KEY"
  aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/$S3_KEY" --storage-class STANDARD_IA
  echo "    Uploaded successfully."
fi

# ── Prune local backups older than 30 days ───────────────────────────────────
find "$BACKUP_DIR" -name "proteaai_*.db" -mtime +30 -delete 2>/dev/null || true

echo ""
echo "Backup complete: $BACKUP_FILE"
echo ""
echo "To restore:"
echo "  1. Stop the app (fly scale count 0 --app $FLY_APP)"
echo "  2. fly ssh console --app $FLY_APP -C 'cp /tmp/restore.db /data/sqlite.db'"
echo "  3. fly scale count 1 --app $FLY_APP"
