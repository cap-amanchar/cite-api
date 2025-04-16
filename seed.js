/**
 * Comprehensive testing data seed script
 * Run with: node testDataSeed.js
 */
const bcrypt = require('bcrypt');
const { db, initializeDatabase } = require('./config/database');

// Sample data
const departments = [
    { name: 'Human Resources', location: 'Main Office - Floor 1' },
    { name: 'Engineering', location: 'Tech Building - Wing A' },
    { name: 'Marketing', location: 'Marketing Suite - Floor 3' },
    { name: 'Finance', location: 'Main Office - Floor 2' },
    { name: 'Sales', location: 'Sales Building - Downtown' },
    { name: 'Customer Support', location: 'Tech Building - Wing B' },
    { name: 'Research & Development', location: 'Innovation Lab' }
];

const managerUsers = [
    {
        username: 'hrmanager',
        password: 'Manager#123',
        fullName: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phone: '555-2345',
        role: 'manager',
        departmentId: 1, // HR Department
        approvalLevel: 2
    },
    {
        username: 'techmanager',
        password: 'Manager#456',
        fullName: 'David Chen',
        email: 'david.chen@example.com',
        phone: '555-3456',
        role: 'manager',
        departmentId: 2, // Engineering Department
        approvalLevel: 2
    },
    {
        username: 'marketingmanager',
        password: 'Manager#789',
        fullName: 'Jessica Williams',
        email: 'jessica.williams@example.com',
        phone: '555-4567',
        role: 'manager',
        departmentId: 3, // Marketing Department
        approvalLevel: 2
    },
    {
        username: 'financemanager',
        password: 'Manager#012',
        fullName: 'Robert Taylor',
        email: 'robert.taylor@example.com',
        phone: '555-5678',
        role: 'manager',
        departmentId: 4, // Finance Department
        approvalLevel: 2
    },
    {
        username: 'salesmanager',
        password: 'Manager#345',
        fullName: 'Amanda Martinez',
        email: 'amanda.martinez@example.com',
        phone: '555-6789',
        role: 'manager',
        departmentId: 5, // Sales Department
        approvalLevel: 2
    },
    {
        username: 'supportmanager',
        password: 'Manager#678',
        fullName: 'Michael Thompson',
        email: 'michael.thompson@example.com',
        phone: '555-7890',
        role: 'manager',
        departmentId: 6, // Customer Support Department
        approvalLevel: 2
    },
    {
        username: 'rdmanager',
        password: 'Manager#901',
        fullName: 'Emily Liu',
        email: 'emily.liu@example.com',
        phone: '555-8901',
        role: 'manager',
        departmentId: 7, // R&D Department
        approvalLevel: 2
    }
];

const employeeUsers = [
    // HR Department
    {
        username: 'hr_employee1',
        password: 'Employee#123',
        fullName: 'John Smith',
        email: 'john.smith@example.com',
        phone: '555-1111',
        role: 'employee',
        departmentId: 1,
        position: 'HR Specialist',
        hireDate: '2021-03-15'
    },
    {
        username: 'hr_employee2',
        password: 'Employee#124',
        fullName: 'Emma Davis',
        email: 'emma.davis@example.com',
        phone: '555-1112',
        role: 'employee',
        departmentId: 1,
        position: 'Recruiter',
        hireDate: '2022-01-10'
    },
    // Engineering Department
    {
        username: 'eng_employee1',
        password: 'Employee#125',
        fullName: 'Alex Turner',
        email: 'alex.turner@example.com',
        phone: '555-1113',
        role: 'employee',
        departmentId: 2,
        position: 'Software Developer',
        hireDate: '2020-06-22'
    },
    {
        username: 'eng_employee2',
        password: 'Employee#126',
        fullName: 'Sofia Rodriguez',
        email: 'sofia.rodriguez@example.com',
        phone: '555-1114',
        role: 'employee',
        departmentId: 2,
        position: 'QA Engineer',
        hireDate: '2021-08-03'
    },
    {
        username: 'eng_employee3',
        password: 'Employee#127',
        fullName: 'James Wilson',
        email: 'james.wilson@example.com',
        phone: '555-1115',
        role: 'employee',
        departmentId: 2,
        position: 'Backend Developer',
        hireDate: '2019-11-15'
    },
    // Marketing Department
    {
        username: 'mkt_employee1',
        password: 'Employee#128',
        fullName: 'Olivia Clark',
        email: 'olivia.clark@example.com',
        phone: '555-1116',
        role: 'employee',
        departmentId: 3,
        position: 'Marketing Specialist',
        hireDate: '2022-02-14'
    },
    {
        username: 'mkt_employee2',
        password: 'Employee#129',
        fullName: 'Daniel Lee',
        email: 'daniel.lee@example.com',
        phone: '555-1117',
        role: 'employee',
        departmentId: 3,
        position: 'Content Creator',
        hireDate: '2021-09-30'
    },
    // Finance Department
    {
        username: 'fin_employee1',
        password: 'Employee#130',
        fullName: 'Natalie Brown',
        email: 'natalie.brown@example.com',
        phone: '555-1118',
        role: 'employee',
        departmentId: 4,
        position: 'Financial Analyst',
        hireDate: '2020-04-05'
    },
    {
        username: 'fin_employee2',
        password: 'Employee#131',
        fullName: 'Ethan Wright',
        email: 'ethan.wright@example.com',
        phone: '555-1119',
        role: 'employee',
        departmentId: 4,
        position: 'Accountant',
        hireDate: '2022-03-01'
    },
    // Sales Department
    {
        username: 'sales_employee1',
        password: 'Employee#132',
        fullName: 'Grace Miller',
        email: 'grace.miller@example.com',
        phone: '555-1120',
        role: 'employee',
        departmentId: 5,
        position: 'Sales Representative',
        hireDate: '2021-01-20'
    },
    {
        username: 'sales_employee2',
        password: 'Employee#133',
        fullName: 'Thomas Anderson',
        email: 'thomas.anderson@example.com',
        phone: '555-1121',
        role: 'employee',
        departmentId: 5,
        position: 'Account Executive',
        hireDate: '2020-11-12'
    },
    // Customer Support Department
    {
        username: 'support_employee1',
        password: 'Employee#134',
        fullName: 'Zoe Garcia',
        email: 'zoe.garcia@example.com',
        phone: '555-1122',
        role: 'employee',
        departmentId: 6,
        position: 'Support Specialist',
        hireDate: '2022-04-18'
    },
    {
        username: 'support_employee2',
        password: 'Employee#135',
        fullName: 'Ryan Phillips',
        email: 'ryan.phillips@example.com',
        phone: '555-1123',
        role: 'employee',
        departmentId: 6,
        position: 'Technical Support',
        hireDate: '2021-07-06'
    },
    // R&D Department
    {
        username: 'rd_employee1',
        password: 'Employee#136',
        fullName: 'Isabella White',
        email: 'isabella.white@example.com',
        phone: '555-1124',
        role: 'employee',
        departmentId: 7,
        position: 'Research Scientist',
        hireDate: '2019-09-15'
    },
    {
        username: 'rd_employee2',
        password: 'Employee#137',
        fullName: 'Lucas Moore',
        email: 'lucas.moore@example.com',
        phone: '555-1125',
        role: 'employee',
        departmentId: 7,
        position: 'Product Designer',
        hireDate: '2020-08-29'
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
    },
    {
        departmentId: 6, // Customer Support Department
        minDaysNotice: 4,
        maxConsecutiveDays: 14,
        approvalRequired: true,
        documentationRequiredAfter: 3,
        maxSickDays: 10,
        maxVacationDays: 18,
        maxPersonalDays: 4
    },
    {
        departmentId: 7, // R&D Department
        minDaysNotice: 5,
        maxConsecutiveDays: 18,
        approvalRequired: true,
        documentationRequiredAfter: 2,
        maxSickDays: 12,
        maxVacationDays: 22,
        maxPersonalDays: 3
    }
];

// Current date for reference
const currentDate = new Date();
const currentYear = currentDate.getFullYear();

// Create absence requests spanning the current year
const getRandomDate = (start, end) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Format date to YYYY-MM-DD
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

// Get a date from the current year
const getDateInCurrentYear = (monthOffset, dayOffset) => {
    const date = new Date(currentYear, monthOffset, dayOffset);
    return formatDate(date);
};

// Store employee IDs mapped by username
const employeeIdMap = {};
// Store manager IDs mapped by username
const managerIdMap = {};

/**
 * Seed the database with testing data
 */
const seedTestingData = async () => {
    try {
        console.log('Initializing database...');
        await initializeDatabase();

        console.log('Seeding departments...');
        await seedDepartments();

        console.log('Seeding manager users...');
        await seedManagerUsers();

        console.log('Seeding employee users...');
        await seedEmployeeUsers();

        console.log('Seeding absence policies...');
        await seedAbsencePolicies();

        console.log('Seeding leave balances...');
        await seedLeaveBalances();

        console.log('Seeding absence requests...');
        await seedAbsenceRequests();

        console.log('Testing data seeding completed successfully!');
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
            const stmt = db.prepare('INSERT INTO departments (name, location, employee_count) VALUES (?, ?, 0)');

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
 * Seed manager users
 */
const seedManagerUsers = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Insert managers one by one
                for (const user of managerUsers) {
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

                    // Insert manager record
                    const managerId = await new Promise((resolve, reject) => {
                        db.run(
                            'INSERT INTO managers (account_id, department_id, approval_level) VALUES (?, ?, ?)',
                            [accountId, user.departmentId, user.approvalLevel || 1],
                            function(err) {
                                if (err) return reject(err);
                                resolve(this.lastID);
                            }
                        );
                    });

                    // Store mapping for later use
                    managerIdMap[user.username] = managerId;

                    // Set department manager
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE departments SET manager_id = ? WHERE id = ?',
                            [accountId, user.departmentId],
                            function(err) {
                                if (err) return reject(err);
                                resolve();
                            }
                        );
                    });
                }

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
};

/**
 * Seed employee users
 */
const seedEmployeeUsers = async () => {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Insert employees one by one
                for (const user of employeeUsers) {
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

                    // Get manager ID for this department
                    const managerId = await new Promise((resolve, reject) => {
                        db.get(
                            'SELECT manager_id FROM departments WHERE id = ?',
                            [user.departmentId],
                            function(err, row) {
                                if (err) return reject(err);
                                resolve(row ? row.manager_id : null);
                            }
                        );
                    });

                    // Insert employee record
                    const employeeId = await new Promise((resolve, reject) => {
                        db.run(
                            'INSERT INTO employees (account_id, department_id, position, manager_id, status, hire_date) VALUES (?, ?, ?, ?, ?, ?)',
                            [accountId, user.departmentId, user.position, managerId, 'active', user.hireDate || null],
                            function(err) {
                                if (err) return reject(err);
                                resolve(this.lastID);
                            }
                        );
                    });

                    // Store employee ID for later use
                    employeeIdMap[user.username] = employeeId;

                    // Update department employee count
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE departments SET employee_count = employee_count + 1 WHERE id = ?',
                            [user.departmentId],
                            function(err) {
                                if (err) return reject(err);
                                resolve();
                            }
                        );
                    });
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
            // First check if policies exist
            db.get('SELECT COUNT(*) as count FROM absence_policies', [], (err, row) => {
                if (err) return reject(err);
                
                if (row && row.count > 0) {
                    console.log('Absence policies already exist, updating...');
                    
                    // Update existing policies
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
                } else {
                    // Create new policies
                    absencePolicies.forEach(policy => {
                        db.run(
                            `INSERT INTO absence_policies (
                             department_id, min_days_notice, max_consecutive_days, 
                             approval_required, documentation_required_after,
                             max_sick_days, max_vacation_days, max_personal_days)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                policy.departmentId,
                                policy.minDaysNotice,
                                policy.maxConsecutiveDays,
                                policy.approvalRequired ? 1 : 0,
                                policy.documentationRequiredAfter,
                                policy.maxSickDays,
                                policy.maxVacationDays,
                                policy.maxPersonalDays
                            ],
                            function(err) {
                                if (err) {
                                    console.error('Error creating policy:', err, policy);
                                }
                            }
                        );
                    });
                    
                    resolve();
                }
            });
        });
    });
};

/**
 * Seed leave balances
 */
const seedLeaveBalances = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Generate leave balances for all employees
            const stmt = db.prepare(
                'INSERT INTO leave_balances (employee_id, year, vacation_days, sick_days, personal_days) VALUES (?, ?, ?, ?, ?)'
            );

            for (const username in employeeIdMap) {
                const employeeId = employeeIdMap[username];
                const departmentId = employeeUsers.find(u => u.username === username).departmentId;
                const policy = absencePolicies.find(p => p.departmentId === departmentId);
                
                // Randomly allocate between 70-100% of max allowed days
                const vacationDays = Math.floor(policy.maxVacationDays * (0.7 + Math.random() * 0.3));
                const sickDays = Math.floor(policy.maxSickDays * (0.7 + Math.random() * 0.3));
                const personalDays = Math.floor(policy.maxPersonalDays * (0.7 + Math.random() * 0.3));
                
                stmt.run(
                    employeeId,
                    currentYear,
                    vacationDays,
                    sickDays,
                    personalDays
                );
            }

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
            // Generate some absence requests for each employee
            const absenceRequests = [];
            const statuses = ['pending', 'approved', 'rejected', 'cancelled'];
            const types = ['vacation', 'sick', 'personal'];
            
            // Create absence requests for each employee
            for (const username in employeeIdMap) {
                const employeeId = employeeIdMap[username];
                
                // Generate 1-4 absence requests per employee
                const numRequests = 1 + Math.floor(Math.random() * 4);
                
                for (let i = 0; i < numRequests; i++) {
                    // Random properties for this request
                    const type = types[Math.floor(Math.random() * types.length)];
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    
                    // Random date in current year
                    const monthOffset = Math.floor(Math.random() * 12);
                    const dayOffset = 1 + Math.floor(Math.random() * 28);
                    const startDate = getDateInCurrentYear(monthOffset, dayOffset);
                    
                    // Duration 1-7 days
                    const duration = 1 + Math.floor(Math.random() * 7);
                    const endDateObj = new Date(currentYear, monthOffset, dayOffset + duration - 1);
                    const endDate = formatDate(endDateObj);
                    
                    // Random comments
                    let comments = '';
                    if (type === 'vacation') {
                        const vacationReasons = ['Family vacation', 'Personal trip', 'Visiting relatives', 'Taking time off', 'Relaxation break'];
                        comments = vacationReasons[Math.floor(Math.random() * vacationReasons.length)];
                    } else if (type === 'sick') {
                        const sickReasons = ['Not feeling well', 'Doctor appointment', 'Medical procedure', 'Recovery time'];
                        comments = sickReasons[Math.floor(Math.random() * sickReasons.length)];
                    } else {
                        const personalReasons = ['Personal matters', 'Family event', 'Home repairs', 'Moving day', 'Administrative errands'];
                        comments = personalReasons[Math.floor(Math.random() * personalReasons.length)];
                    }
                    
                    absenceRequests.push({
                        employeeId,
                        startDate,
                        endDate,
                        type,
                        status,
                        hasDocumentation: Math.random() > 0.7, // 30% chance of having documentation
                        comments
                    });
                }
            }
            
            // Insert all the requests
            for (const request of absenceRequests) {
                db.run(
                    `INSERT INTO absence_requests 
                    (employee_id, start_date, end_date, type, status, has_documentation, comments, submission_time) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))`,
                    [
                        request.employeeId,
                        request.startDate,
                        request.endDate,
                        request.type,
                        request.status,
                        request.hasDocumentation ? 1 : 0,
                        request.comments,
                        Math.floor(Math.random() * 30) // Submitted within the last 30 days
                    ],
                    function(err) {
                        if (err) {
                            console.error('Error creating request:', err);
                            return;
                        }

                        const requestId = this.lastID;

                        // Get employee's manager
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

                                        // Create appropriate notifications
                                        if (row && row.manager_id) {
                                            // Get manager's account ID
                                            db.get(
                                                'SELECT account_id FROM managers WHERE id = ?',
                                                [row.manager_id],
                                                (err, manager) => {
                                                    if (err || !manager) {
                                                        console.error('Error getting manager account:', err);
                                                        return;
                                                    }
                                                    
                                                    // Notification for manager if request is pending
                                                    if (request.status === 'pending') {
                                                        db.run(
                                                            `INSERT INTO notifications 
                                                            (request_id, recipient_id, type, status, content, sent_date) 
                                                            VALUES (?, ?, 'approval_request', ?, 'New absence request requires your approval', date('now', '-' || ? || ' days'))`,
                                                            [
                                                                requestId,
                                                                manager.account_id,
                                                                Math.random() > 0.5 ? 'read' : 'unread', // 50% chance of being read
                                                                Math.floor(Math.random() * 10) // Sent within the last 10 days
                                                            ]
                                                        );
                                                    }
                                                }
                                            );
                                        }

                                        // Get employee account ID for notifications
                                        db.get(
                                            'SELECT account_id FROM employees WHERE id = ?',
                                            [request.employeeId],
                                            (err, employee) => {
                                                if (err || !employee) {
                                                    console.error('Error getting employee:', err);
                                                    return;
                                                }

                                                // Add notification for approved/rejected requests
                                                if (request.status === 'approved' || request.status === 'rejected') {
                                                    db.run(
                                                        `INSERT INTO notifications 
                                                        (request_id, recipient_id, type, status, content, sent_date) 
                                                        VALUES (?, ?, ?, ?, ?, date('now', '-' || ? || ' days'))`,
                                                        [
                                                            requestId,
                                                            employee.account_id,
                                                            request.status === 'approved' ? 'request_approved' : 'request_rejected',
                                                            Math.random() > 0.3 ? 'read' : 'unread', // 70% chance of being read
                                                            request.status === 'approved' ? 'Your absence request has been approved' : 'Your absence request has been rejected',
                                                            Math.floor(Math.random() * 7) // Sent within the last 7 days
                                                        ]
                                                    );
                                                    
                                                    // If approved, update leave balance
                                                    if (request.status === 'approved') {
                                                        // Calculate days
                                                        const startDate = new Date(request.startDate);
                                                        const endDate = new Date(request.endDate);
                                                        const diffTime = Math.abs(endDate - startDate);
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                                        
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
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }

            // Wait a bit for all async operations to complete
            setTimeout(() => resolve(), 2000);
        });
    });
};

// Run the seeding if this file is executed directly
if (require.main === module) {
    seedTestingData();
}

module.exports = {
    seedTestingData
};