/**
 * Script to check and reset admin credentials
 * Run with: node reset-admin.js
 */
const bcrypt = require('bcrypt');
const { db } = require('./config/database');

const resetAdmin = async () => {
    console.log('Checking for admin user...');

    // Check if admin user exists
    db.get("SELECT id, username, role FROM accounts WHERE username = 'admin'", [], async (err, row) => {
        if (err) {
            console.error('Error checking admin user:', err);
            return;
        }

        // New admin credentials
        const username = 'admin';
        const password = 'Admin#9012';
        const hashedPassword = await bcrypt.hash(password, 10);

        if (row) {
            console.log('Admin user found:', row);
            console.log('Resetting admin password...');

            // Update existing admin
            db.run(
                `UPDATE accounts SET password = ? WHERE username = ?`,
                [hashedPassword, username],
                function(err) {
                    if (err) {
                        console.error('Error resetting admin password:', err);
                        return;
                    }

                    console.log(`✅ Admin password reset successfully. Changes: ${this.changes}`);
                    console.log('New admin credentials:');
                    console.log(`- Username: ${username}`);
                    console.log(`- Password: ${password}`);
                }
            );
        } else {
            console.log('Admin user not found. Creating new admin user...');

            // Create new admin user
            db.run(
                `INSERT INTO accounts (username, password, full_name, email, role) 
         VALUES (?, ?, 'System Administrator', 'admin@example.com', 'admin')`,
                [username, hashedPassword],
                function(err) {
                    if (err) {
                        console.error('Error creating admin user:', err);
                        return;
                    }

                    const adminId = this.lastID;

                    // Create administrator record
                    db.run(
                        `INSERT INTO administrators (account_id, access_level, can_modify_policies, can_manage_users) 
             VALUES (?, 3, 1, 1)`,
                        [adminId],
                        function(err) {
                            if (err) {
                                console.error('Error creating administrator record:', err);
                                return;
                            }

                            console.log(`✅ Admin user created successfully with ID: ${adminId}`);
                            console.log('Admin credentials:');
                            console.log(`- Username: ${username}`);
                            console.log(`- Password: ${password}`);
                        }
                    );
                }
            );
        }
    });
};

resetAdmin();