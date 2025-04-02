/**
 * Script to check all users in the database
 * Run with: node check-users.js
 */
const { db } = require('./config/database');

db.all("SELECT id, username, role, email FROM accounts", [], (err, rows) => {
    if (err) {
        console.error('Error retrieving users:', err);
        return;
    }

    console.log('=== Users in Database ===');
    console.table(rows || []);
    console.log(`Total users: ${rows ? rows.length : 0}`);

    // Check if any users exist
    if (!rows || rows.length === 0) {
        console.log('No users found in the database.');
    }
});

// Check if tables exist properly
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'", [], (err, row) => {
    if (err) {
        console.error('Error checking database schema:', err);
        return;
    }

    if (!row) {
        console.error('❌ Accounts table not found! Database may not be initialized properly.');
    } else {
        console.log('✅ Accounts table exists.');
    }
});