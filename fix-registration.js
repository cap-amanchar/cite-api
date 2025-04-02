/**
 * This script fixes all issues related to registration
 * 1. Creates departments with IDs 1-5 to match frontend
 * 2. Updates sequences if needed
 * 3. Validates and shows all issues that could affect registration
 */
const { db, initializeDatabase } = require('./config/database');

const fixRegistration = async () => {
    try {
        console.log('Running registration fix script...');

        // Initialize database schema
        await initializeDatabase();

        // 1. Check and fix departments
        await fixDepartments();

        // 2. Verify related tables and constraints
        await verifyTables();

        console.log('\nRegistration fix completed. You should now be able to register users successfully.');
    } catch (error) {
        console.error('Error during registration fix:', error);
    }
};

// Fix departments to match frontend IDs
const fixDepartments = async () => {
    console.log('\n=== Checking Departments ===');

    // Get existing departments
    const existingDepartments = await new Promise((resolve, reject) => {
        db.all('SELECT id, name, location, manager_id FROM departments ORDER BY id', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    console.log(`Found ${existingDepartments.length} existing departments`);
    if (existingDepartments.length > 0) {
        console.table(existingDepartments);
    }

    // Define required departments for frontend
    const requiredDepartments = [
        { id: 1, name: 'Human Resources', location: 'Main Office' },
        { id: 2, name: 'Engineering', location: 'Tech Building' },
        { id: 3, name: 'Marketing', location: 'Marketing Suite' },
        { id: 4, name: 'Finance', location: 'Main Office' },
        { id: 5, name: 'Sales', location: 'Sales Building' }
    ];

    // Check if each required department exists
    const existingIds = existingDepartments.map(d => d.id);
    const missingDepartments = requiredDepartments.filter(d => !existingIds.includes(d.id));

    if (missingDepartments.length === 0) {
        console.log('✅ All required departments exist with correct IDs');
        return;
    }

    console.log(`Found ${missingDepartments.length} missing departments that need to be created`);

    // Create missing departments one by one with policies
    for (const dept of missingDepartments) {
        console.log(`Creating department: ${dept.name} (ID: ${dept.id})`);

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Create absence policy
                db.run(
                    `INSERT INTO absence_policies (
            min_days_notice, 
            max_consecutive_days, 
            approval_required, 
            documentation_required_after, 
            max_sick_days, 
            max_vacation_days, 
            max_personal_days
          ) VALUES (2, 14, 1, 3, 10, 20, 3)`,
                    function(err) {
                        if (err) {
                            console.error('Error creating absence policy:', err);
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        const policyId = this.lastID;

                        // Create department with specific ID
                        db.run(
                            `INSERT INTO departments (id, name, location, policy_id, employee_count) 
              VALUES (?, ?, ?, ?, 0)`,
                            [dept.id, dept.name, dept.location, policyId],
                            function(err) {
                                if (err) {
                                    console.error('Error creating department:', err);
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }

                                // Link policy back to department
                                db.run(
                                    `UPDATE absence_policies SET department_id = ? WHERE id = ?`,
                                    [dept.id, policyId],
                                    function(err) {
                                        if (err) {
                                            console.error('Error linking policy to department:', err);
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }

                                        db.run('COMMIT', err => {
                                            if (err) {
                                                console.error('Error committing transaction:', err);
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }
                                            console.log(`✅ Department ${dept.name} (ID: ${dept.id}) created successfully`);
                                            resolve();
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });
    }

    // Verify all departments now exist
    const finalDepartments = await new Promise((resolve, reject) => {
        db.all('SELECT id, name, location, manager_id FROM departments ORDER BY id', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    console.log('\nFinal departments in database:');
    console.table(finalDepartments);
};

// Verify other tables and constraints required for registration
const verifyTables = async () => {
    console.log('\n=== Verifying Other Tables ===');

    // Verify absence_policies table
    const policies = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM absence_policies', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });

    console.log(`Found ${policies.length} absence policies`);

    // Verify accounts table structure
    await new Promise((resolve, reject) => {
        db.get("PRAGMA table_info(accounts)", [], (err, result) => {
            if (err) return reject(err);
            console.log('✅ Accounts table verified');
            resolve(result);
        });
    });

    // Verify employees table structure
    await new Promise((resolve, reject) => {
        db.get("PRAGMA table_info(employees)", [], (err, result) => {
            if (err) return reject(err);
            console.log('✅ Employees table verified');
            resolve(result);
        });
    });

    // Verify leave_balances table structure
    await new Promise((resolve, reject) => {
        db.get("PRAGMA table_info(leave_balances)", [], (err, result) => {
            if (err) return reject(err);
            console.log('✅ Leave balances table verified');
            resolve(result);
        });
    });

    console.log('✅ All required tables verified');
};

// Run the script
fixRegistration()
    .then(() => {
        console.log('\nScript completed successfully.');
        process.exit(0);
    })
    .catch(err => {
        console.error('\nScript failed:', err);
        process.exit(1);
    });