#!/bin/bash

# Database restore script for InvoiceMe
# Usage: ./restore.sh <backup_file>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 backups/invoiceme_backup_20240101_120000.sql"
    exit 1
fi

BACKUP_FILE="$1"

# Configuration
DB_NAME="${DB_DATABASE:-invoiceme}"
DB_USER="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check if backup file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing and restoring backup file..."
    if [[ "$BACKUP_FILE" == *.sql.gz ]]; then
        # SQL format (plain text)
        gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    else
        # Custom format (binary)
        gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c
    fi
else
    echo "Restoring database from: $BACKUP_FILE"
    if [[ "$BACKUP_FILE" == *.sql ]]; then
        # SQL format (plain text)
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
    else
        # Custom format (binary)
        PGPASSWORD="$DB_PASSWORD" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$BACKUP_FILE"
    fi
fi

if [ $? -eq 0 ]; then
    echo "Database restored successfully!"
else
    echo "Restore failed!"
    exit 1
fi

