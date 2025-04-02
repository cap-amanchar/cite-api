const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Database file path
const dbPath = path.resolve(__dirname, '..', config.database.path);

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create a database instance
const db = new sqlite3.Database(dbPath);

// Initialize database with required tables
const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');

            // Create Account/User table
            db.run(`CREATE TABLE IF NOT EXISTS accounts (
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
      )`);

            // Create Department table
            db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        manager_id INTEGER,
        policy_id INTEGER,
        location TEXT,
        employee_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES accounts(id)
      )`);

            // Create Employee table
            db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        position TEXT,
        hire_date DATE,
        manager_id INTEGER,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (manager_id) REFERENCES accounts(id)
      )`);

            // Create Manager table
            db.run(`CREATE TABLE IF NOT EXISTS managers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        team_size INTEGER DEFAULT 0,
        approval_level INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )`);

            // Create Administrator table
            db.run(`CREATE TABLE IF NOT EXISTS administrators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        access_level INTEGER DEFAULT 1,
        can_modify_policies BOOLEAN DEFAULT 0,
        can_manage_users BOOLEAN DEFAULT 0,
        last_active DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )`);

            // Create LeaveBalance table
            db.run(`CREATE TABLE IF NOT EXISTS leave_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        vacation_days REAL DEFAULT 0,
        sick_days REAL DEFAULT 0,
        personal_days REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        UNIQUE(employee_id, year)
      )`);

            // Create AbsencePolicy table
            db.run(`CREATE TABLE IF NOT EXISTS absence_policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER,
        min_days_notice INTEGER DEFAULT 0,
        max_consecutive_days INTEGER DEFAULT 30,
        approval_required BOOLEAN DEFAULT 1,
        documentation_required_after INTEGER DEFAULT 3,
        max_sick_days INTEGER DEFAULT 10,
        max_vacation_days INTEGER DEFAULT 20,
        max_personal_days INTEGER DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )`);

            // Create AbsenceRequest table
            db.run(`CREATE TABLE IF NOT EXISTS absence_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        has_documentation BOOLEAN DEFAULT 0,
        comments TEXT,
        submission_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )`);

            // Create AbsenceRegistry table
            db.run(`CREATE TABLE IF NOT EXISTS absence_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        manager_id INTEGER,
        creation_date DATE NOT NULL,
        modification_date DATE,
        approval_status TEXT DEFAULT 'pending',
        notification_sent BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES absence_requests(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (manager_id) REFERENCES managers(id)
      )`);

            // Create Notification table
            db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        recipient_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'unread',
        sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_date DATETIME,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES absence_requests(id),
        FOREIGN KEY (recipient_id) REFERENCES accounts(id)
      )`);

            // Create initial admin user (if not exists)
            db.get("SELECT id FROM accounts WHERE username = 'admin'", (err, row) => {
                if (err) {
                    console.error('Error checking for admin user:', err);
                    return;
                }

                if (!row) {
                    // Default password is 'Admin#9012', should be changed immediately in production
                    db.run(`INSERT INTO accounts (username, password, full_name, email, role) 
                  VALUES ('admin', '$2b$10$XJeU6eK8h5SfX9ZU8CeOq.HR/JVEWe.zHCjsh/ZC/KtlLH1.6npgq', 'System Administrator', 'admin@example.com', 'admin')`,
                        function(err) {
                            if (err) {
                                console.error('Error creating admin user:', err);
                                return;
                            }

                            const adminId = this.lastID;

                            // Create administrator record
                            db.run(`INSERT INTO administrators (account_id, access_level, can_modify_policies, can_manage_users) 
                    VALUES (?, 3, 1, 1)`, [adminId], (err) => {
                                if (err) {
                                    console.error('Error creating administrator record:', err);
                                }
                            });
                        });
                }
            });
        });

        // Resolve the promise once database initialization is complete
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'", (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row ? true : false);
        });
    });
};

module.exports = {
    db,
    initializeDatabase
};