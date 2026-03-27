#!/bin/bash
set -e

# Database initialisation script
# Uses Railway MySQL environment variables to run the schema SQL file.

HOST="${MYSQLHOST:?Error: MYSQLHOST is not set}"
PORT="${MYSQLPORT:-3306}"
USER="${MYSQLUSER:?Error: MYSQLUSER is not set}"
PASSWORD="${MYSQLPASSWORD:?Error: MYSQLPASSWORD is not set}"
DATABASE="${MYSQLDATABASE:?Error: MYSQLDATABASE is not set}"

SQL_FILE="$(dirname "$0")/../db/script.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found at $SQL_FILE"
  exit 1
fi

echo "Initialising database '$DATABASE' on $HOST:$PORT..."

# --force keeps going even if individual statements return errors
# (e.g. duplicate table errors when tables already exist).
mysql \
  --host="$HOST" \
  --port="$PORT" \
  --user="$USER" \
  --password="$PASSWORD" \
  --force \
  "$DATABASE" < "$SQL_FILE"

echo "Database initialisation complete."
