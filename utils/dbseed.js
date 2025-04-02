/**
 * Database seeding script to populate with sample data
 */
const bcrypt = require('bcrypt');
const { db, initializeDatabase } = require('../config/database');

// Sample data
const departments = [
    { name: 'Human Resources', location: 'Main Office' },
    { name: 'Engineering', location: 'Tech Building' },
    { name: 'Marketing', location: 'Marketing Suite' },
    { name: 'Finance', location: 'Main Office' },
    { name: 'Sales', location: 'Sales Building' }
];

const roles = ['admin', 'manager', 'employee'];

const users = [
    {
        username: 'admin',
        password: 'Admin#9012',
        fullName: 'System Administrator',
        email: 'admin@example.com',
        phone: '555-1234',
        role: 'admin'
    },
    {
        username: 'hrmanager',
        password: 'Manager#123',
        fullName: 'HR Manager',
        email: 'hrmanager@example.com',
        phone: '555-2345',
        role: 'manager',
        departmentId: 1, // HR Department
        approvalLevel: 2
    },
    {
        username: 'techmanager',
        password: 'Manager#456',
        fullName: 'Tech Manager',
        email: 'techmanager@example.com',
        phone: '555-3456',
        role: 'manager',
        departmentId: 2, // Engineering Department
        approvalLevel: 2
    },
    {
        username: 'employee1',
        password: 'Employee#123',
        fullName: 'John Smith',
        email: 'john.smith@example.com',
        phone: '555-4567',
        role: 'employee',
        departmentId: 2, // Engineering Department
        managerId: 3, // Tech Manager
        position: 'Software Developer'
    },
    {
        username: 'employee2',
        password: 'Employee#456',
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '555-5678',
        role: 'employee',
        departmentId: 1, // HR Department
        managerId: 2, // HR Manager
        position: 'HR Specialist'
    },
    {
        username: 'employee3',
        password: 'Employee#789',
        fullName: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        phone: '555-6789',
        role: 'employee',
        departmentId: 2, // Engineering Department
        managerId: 3, // Tech Manager
        position: 'QA Engineer'
    }
];

const absencePolicies = [
    {
        departmentId: 1, // HR Department
        minDaysNotice: 3,
        maxConsecutiveDays: 20,
        approvalRequired: true,
        documentationRequiredAfter: 3,
        maxSickDays: 12,
        maxVacationDays: 25,
        maxPersonalDays: 5
    },
    {
        departmentId: 2, // Engineering Department
        minDaysNotice: 2,
        maxConsecutiveDays: 15,
        approvalRequired: true,
        documentationRequiredAfter: 2,
        maxSickDays: 10,
        maxVacationDays: 20,
        maxPersonalDays: 3
    },
    {
        departmentId: 3, // Marketing Department
        minDaysNotice: 5,
        maxConsecutiveDays: 10,
        approvalRequired: true,
        documentationRequiredAfter: 3,
        maxSickDays: 8,
        maxVacationDays: 18,
        maxPersonalDays: 2
    },
    {
        departmentId: 4, // Finance Department
        minDaysNotice: 7,
        maxConsecutiveDays: 12,
        approvalRequired: true,
        documentationRequiredAfter: 2,
        maxSickDays: 10,
        maxVacationDays: 22,
        maxPersonalDays: 3
    },
    {
        departmentId: 5, // Sales Department
        minDaysNotice: 3,
        maxConsecutiveDays: 15,
        approvalRequired: true,
        documentationRequiredAfter: 3,
        maxSickDays: 10,
        maxVacationDays: 20,
        maxPersonalDays: 3
    }
];

const leaveBalances = [
    {
        employeeId: 1, // John Smith
        year: 2023,
        vacationDays: 20,
        sickDays: 10,
        personalDays: 3
    },
    {
        employeeId: 2, // Jane Doe
        year: 2023,
        vacationDays: 25,
        sickDays: 12,
        personalDays: 5
    },
    {
        employeeId: 3, // Bob Johnson
        year: 2023,
        vacationDays: 20,
        sickDays: 10,
        personalDays: 3
    }
];

const absenceRequests = [
    {
        employeeId: 1, // John Smith
        startDate: '2023-07-10',
        endDate: '2023-07-14',
        type: 'vacation',
        status: 'approved',
        hasDocumentation: false,
        comments: 'Summer vacation'
    },
    {
        employeeId: 1, // John Smith
        startDate: '2023-09-01',
        endDate: '2023-09-01',
        type: 'sick',
        status: 'approved',
        hasDocumentation: false,
        comments: 'Not feeling well'
    },
    {
        employeeId: 2, // Jane Doe
        startDate: '2023-08-15',
        endDate: '2023-08-19',
        type: 'vacation',
        status: 'approved',
        hasDocumentation: false,
        comments: 'Family trip'
    },
    {
        employeeId: 3, // Bob Johnson
        startDate: '2023-10-20',
        endDate: '2023-10-24',
        type: 'vacation',
        status: 'pending',
        hasDocumentation: false,
        comments: 'Fall break'
    },
    {
        employeeId: 2, // Jane Doe
        startDate: '2023-11-01',
        endDate: '2023-11-01',
        type: 'personal',
        status: 'pending',
        hasDocumentation: false,
        comments: 'Doctor appointment'
    }
];

/**
 * Seed database with sample data
 */
const seedDatabase = async () => {
    try {
        console.log('Initializing database...');
        await initializeDatabase();

        console.log('Seeding departments...');
        await seedDepartments();

        console.log('Seeding users...');
        await seedUsers();

        console.log('Seeding absence policies...');
        await seedAbsencePolicies();

        console.log('Seeding leave balances...');
        await seedLeaveBalances();

        console.log('Seeding absence requests...');
        await seedAbsenceRequests();

        console.log('Database seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

/**
 * Seed departments
 */
const seedDepartments = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            const stmt = db.prepare('INSERT INTO departments (name, location) VALUES (?, ?)');

            departments.forEach(department => {
                stmt.run(department.name, department.location);
            });

            stmt.finalize(err => {
                if (err) return reject(err);
                resolve();
            });
        });
    });
};

/**
 * Seed users
 */
const seedUsers = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Insert users one by one with proper role records
                for (const user of users) {
                    const hashedPassword = await bcrypt.hash(user.password, 10);

                    // Insert account
                    const accountId = await new Promise((resolve, reject) => {
                        db.run(
                            'INSERT INTO accounts (username, password, full_name, email, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
                            [user.username, hashedPassword, user.fullName, user.email, user.phone, user.role],
                            function(err) {
                                if (err) return reject(err);
                                resolve(this.lastID);
                            }
                        );
                    });

                    // Insert role-specific record
                    if (user.role === 'admin') {
                        await new Promise((resolve, reject) => {
                            db.run(
                                'INSERT INTO administrators (account_id, access_level, can_modify_policies, can_manage_users) VALUES (?, ?, ?, ?)',
                                [accountId, 3, 1, 1],
                                function(err) {
                                    if (err) return reject(err);
                                    resolve();
                                }
                            );
                        });
                    } else if (user.role === 'manager') {
                        await new Promise((resolve, reject) => {
                            db.run(
                                'INSERT INTO managers (account_id, department_id, approval_level) VALUES (?, ?, ?)',
                                [accountId, user.departmentId, user.approvalLevel || 1],
                                function(err) {
                                    if (err) return reject(err);

                                    // Set department manager
                                    db.run(
                                        'UPDATE departments SET manager_id = ? WHERE id = ?',
                                        [accountId, user.departmentId],
                                        function(err) {
                                            if (err) return reject(err);
                                            resolve();
                                        }
                                    );
                                }
                            );
                        });
                    } else if (user.role === 'employee') {
                        await new Promise((resolve, reject) => {
                            db.run(
                                'INSERT INTO employees (account_id, department_id, position, manager_id, status) VALUES (?, ?, ?, ?, ?)',
                                [accountId, user.departmentId, user.position || '', user.managerId || null, 'active'],
                                function(err) {
                                    if (err) return reject(err);

                                    // Update department employee count
                                    db.run(
                                        'UPDATE departments SET employee_count = employee_count + 1 WHERE id = ?',
                                        [user.departmentId],
                                        function(err) {
                                            if (err) return reject(err);
                                            resolve();
                                        }
                                    );
                                }
                            );
                        });
                    }
                }

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
};

/**
 * Seed absence policies
 */
const seedAbsencePolicies = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            absencePolicies.forEach(policy => {
                db.run(
                    `UPDATE absence_policies SET 
           min_days_notice = ?,
           max_consecutive_days = ?,
           approval_required = ?,
           documentation_required_after = ?,
           max_sick_days = ?,
           max_vacation_days = ?,
           max_personal_days = ?
           WHERE department_id = ?`,
                    [
                        policy.minDaysNotice,
                        policy.maxConsecutiveDays,
                        policy.approvalRequired ? 1 : 0,
                        policy.documentationRequiredAfter,
                        policy.maxSickDays,
                        policy.maxVacationDays,
                        policy.maxPersonalDays,
                        policy.departmentId
                    ],
                    function(err) {
                        if (err) {
                            console.error('Error updating policy:', err, policy);
                        }
                    }
                );
            });

            resolve();
        });
    });
};

/**
 * Seed leave balances
 */
const seedLeaveBalances = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            const stmt = db.prepare(
                'INSERT INTO leave_balances (employee_id, year, vacation_days, sick_days, personal_days) VALUES (?, ?, ?, ?, ?)'
            );

            leaveBalances.forEach(balance => {
                stmt.run(
                    balance.employeeId,
                    balance.year,
                    balance.vacationDays,
                    balance.sickDays,
                    balance.personalDays
                );
            });

            stmt.finalize(err => {
                if (err) return reject(err);
                resolve();
            });
        });
    });
};

/**
 * Seed absence requests
 */
const seedAbsenceRequests = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // For each absence request, we need to:
            // 1. Insert the absence request
            // 2. Insert the registry entry
            // 3. Add notifications
            // 4. If approved, update leave balance

            absenceRequests.forEach(request => {
                db.run(
                    `INSERT INTO absence_requests 
           (employee_id, start_date, end_date, type, status, has_documentation, comments) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        request.employeeId,
                        request.startDate,
                        request.endDate,
                        request.type,
                        request.status,
                        request.hasDocumentation ? 1 : 0,
                        request.comments
                    ],
                    function(err) {
                        if (err) {
                            console.error('Error creating request:', err);
                            return;
                        }

                        const requestId = this.lastID;

                        // Get employee manager
                        db.get(
                            'SELECT manager_id FROM employees WHERE id = ?',
                            [request.employeeId],
                            (err, row) => {
                                if (err) {
                                    console.error('Error getting manager:', err);
                                    return;
                                }

                                // Add to registry
                                db.run(
                                    `INSERT INTO absence_registry 
                   (request_id, employee_id, manager_id, creation_date, approval_status, notification_sent) 
                   VALUES (?, ?, ?, date(?), ?, 1)`,
                                    [
                                        requestId,
                                        request.employeeId,
                                        row ? row.manager_id : null,
                                        request.startDate,
                                        request.status
                                    ],
                                    function(err) {
                                        if (err) {
                                            console.error('Error creating registry entry:', err);
                                        }

                                        // Add notification for manager if request is pending
                                        if (request.status === 'pending' && row && row.manager_id) {
                                            db.run(
                                                `INSERT INTO notifications 
                         (request_id, recipient_id, type, status, content, sent_date) 
                         VALUES (?, ?, 'approval_request', 'unread', 'New absence request requires your approval', date(?))`,
                                                [
                                                    requestId,
                                                    row.manager_id,
                                                    request.startDate
                                                ]
                                            );
                                        }

                                        // If approved, add notification for employee and update leave balance
                                        if (request.status === 'approved') {
                                            // Calculate days
                                            const startDate = new Date(request.startDate);
                                            const endDate = new Date(request.endDate);
                                            const diffTime = Math.abs(endDate - startDate);
                                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                                            // Get employee account ID
                                            db.get(
                                                'SELECT account_id FROM employees WHERE id = ?',
                                                [request.employeeId],
                                                (err, employee) => {
                                                    if (err || !employee) {
                                                        console.error('Error getting employee:', err);
                                                        return;
                                                    }

                                                    // Add notification
                                                    db.run(
                                                        `INSERT INTO notifications 
                             (request_id, recipient_id, type, status, content, sent_date) 
                             VALUES (?, ?, 'request_approved', 'unread', 'Your absence request has been approved', date(?))`,
                                                        [
                                                            requestId,
                                                            employee.account_id,
                                                            request.startDate
                                                        ]
                                                    );

                                                    // Update leave balance
                                                    let balanceField;
                                                    switch (request.type) {
                                                        case 'vacation': balanceField = 'vacation_days'; break;
                                                        case 'sick': balanceField = 'sick_days'; break;
                                                        case 'personal': balanceField = 'personal_days'; break;
                                                    }

                                                    if (balanceField) {
                                                        const year = new Date(request.startDate).getFullYear();

                                                        db.run(
                                                            `UPDATE leave_balances SET 
                               ${balanceField} = ${balanceField} - ?
                               WHERE employee_id = ? AND year = ?`,
                                                            [diffDays, request.employeeId, year]
                                                        );
                                                    }
                                                }
                                            );
                                        }
                                    }
                                );
                            }
                        );
                    }
                );
            });

            // Wait a bit for all async operations to complete
            setTimeout(() => resolve(), 1000);
        });
    });
};

// Run the seeding if this file is executed directly
if (require.main === module) {
    seedDatabase();
}

module.exports = {
    seedDatabase
};