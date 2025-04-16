#!/bin/bash

# Script to create admin user in SQLite database

# Database path
DB_PATH="/opt/render/project/src/data/absence_management.db"
SQL_FILE="/tmp/create-admin.sql"

echo "Creating admin user in database: $DB_PATH"

# Create directory if it doesn't exist
mkdir -p $(dirname "$DB_PATH")

# Check if sqlite3 is installed
if ! command -v sqlite3 &> /dev/null; then
    echo "sqlite3 not found, attempting to install..."
    apt-get update && apt-get install -y sqlite3
fi

# Create SQL file
cat > "$SQL_FILE" << 'EOL'
-- Create accounts table if not exists
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create administrators table if not exists
CREATE TABLE IF NOT EXISTS administrators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  access_level INTEGER DEFAULT 1,
  can_modify_policies BOOLEAN DEFAULT 0,
  can_manage_users BOOLEAN DEFAULT 0,
  last_active DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Begin transaction
BEGIN TRANSACTION;

-- Insert admin user (if it doesn't exist)
INSERT OR IGNORE INTO accounts (username, password, full_name, email, role)
VALUES ('admin', '$2b$10$XJeU6eK8h5SfX9ZU8CeOq.HR/JVEWe.zHCjsh/ZC/KtlLH1.6npgq', 'System Administrator', 'admin@example.com', 'admin');

-- Get the admin ID (either the one we just created or the existing one)
INSERT OR IGNORE INTO administrators (account_id, access_level, can_modify_policies, can_manage_users)
SELECT id, 3, 1, 1 FROM accounts WHERE username = 'admin';

-- Commit the transaction
COMMIT;

-- Verify admin was created
SELECT a.id, a.username, a.role, adm.access_level 
FROM accounts a
LEFT JOIN administrators adm ON a.id = adm.account_id
WHERE a.username = 'admin';
EOL

# Run the SQL script
echo "Executing SQL script..."
sqlite3 "$DB_PATH" < "$SQL_FILE"

# Check if successful
if [ $? -eq 0 ]; then
    echo "Admin user created/verified successfully!"
    echo "Username: admin"
    echo "Password: Admin#9012"
else
    echo "Error creating admin user"
    exit 1
fi

# Cleanup
rm -f "$SQL_FILE"

# Create backup if possible
BACKUP_PATH="/tmp/backup_absence_management.db"
echo "Creating backup at $BACKUP_PATH"
cp "$DB_PATH" "$BACKUP_PATH"

echo "Done!"