/**
 * Script to create an admin user in the database
 * Run with: node create-admin.js
 */
const bcrypt = require('bcrypt');
const { db, initializeDatabase } = require('./config/database');

const createAdminUser = async () => {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    
    console.log('Creating admin user...');
    
    // Admin user details
    const adminUser = {
      username: 'admin',
      password: 'Admin#9012', // Will be hashed
      fullName: 'System Administrator',
      email: 'admin@example.com',
      role: 'admin'
    };
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminUser.password, 10);
    
    // Check if admin already exists
    db.get("SELECT id FROM accounts WHERE username = ?", [adminUser.username], (err, row) => {
      if (err) {
        console.error('Error checking for admin user:', err);
        process.exit(1);
      }
      
      if (row) {
        console.log('Admin user already exists with ID:', row.id);
        process.exit(0);
      }
      
      // Create admin user
      db.run(
        `INSERT INTO accounts (username, password, full_name, email, role) 
        VALUES (?, ?, ?, ?, ?)`,
        [adminUser.username, hashedPassword, adminUser.fullName, adminUser.email, adminUser.role],
        function(err) {
          if (err) {
            console.error('Error creating admin user:', err);
            process.exit(1);
          }
          
          const adminId = this.lastID;
          console.log(`Admin user created with ID: ${adminId}`);
          
          // Create administrator record
          db.run(
            `INSERT INTO administrators (account_id, access_level, can_modify_policies, can_manage_users) 
            VALUES (?, 3, 1, 1)`,
            [adminId],
            (err) => {
              if (err) {
                console.error('Error creating administrator record:', err);
                process.exit(1);
              }
              
              console.log('Admin user created successfully!');
              console.log('Username:', adminUser.username);
              console.log('Password:', adminUser.password);
              
              // Create a backup if using the enhanced database.js
              if (typeof db.createBackup === 'function') {
                console.log('Creating database backup...');
                db.createBackup()
                  .then(() => {
                    console.log('Backup created successfully');
                    process.exit(0);
                  })
                  .catch(err => {
                    console.error('Backup failed:', err);
                    process.exit(1);
                  });
              } else {
                process.exit(0);
              }
            }
          );
        }
      );
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createAdminUser();