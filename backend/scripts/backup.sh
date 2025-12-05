#!/bin/bash

# Database backup script for InvoiceMe
# Usage: ./backup.sh [backup_directory]

set -e

# Configuration
DB_NAME="${DB_DATABASE:-invoiceme}"
DB_USER="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/invoiceme_backup_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Starting database backup..."
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"

PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_FILE"
    
    # Optional: Compress the backup
    gzip "$BACKUP_FILE"
    echo "Backup compressed: ${BACKUP_FILE}.gz"
    
    # Optional: Keep only last 30 days of backups
    find "$BACKUP_DIR" -name "invoiceme_backup_*.sql.gz" -mtime +30 -delete
    echo "Old backups cleaned up (kept last 30 days)"
else
    echo "Backup failed!"
    exit 1
fi

