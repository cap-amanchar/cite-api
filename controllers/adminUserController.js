const bcrypt = require('bcrypt');
const { db } = require('../config/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../middlewares/errorMiddleware');

/**
 * Get a user by ID (admin only)
 */
const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, full_name, email, phone, role, last_login, created_at 
         FROM accounts 
         WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Get role-specific data
        let roleData = {};

        if (user.role === 'employee') {
            roleData = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT e.id, e.position, e.hire_date, e.status,
                  d.id as department_id, d.name as department_name,
                  m.account_id as manager_id, a.full_name as manager_name
           FROM employees e
           JOIN departments d ON e.department_id = d.id
           LEFT JOIN managers m ON e.manager_id = m.id
           LEFT JOIN accounts a ON m.account_id = a.id
           WHERE e.account_id = ?`,
                    [id],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row || {});
                    }
                );
            });

            // Get leave balance
            const currentYear = new Date().getFullYear();
            if (roleData.id) {
                const leaveBalance = await new Promise((resolve, reject) => {
                    db.get(
                        `SELECT vacation_days, sick_days, personal_days
             FROM leave_balances
             WHERE employee_id = ? AND year = ?`,
                        [roleData.id, currentYear],
                        (err, row) => {
                            if (err) return reject(err);
                            resolve(row || { vacation_days: 0, sick_days: 0, personal_days: 0 });
                        }
                    );
                });

                roleData.leaveBalance = leaveBalance;
            }
        } else if (user.role === 'manager') {
            roleData = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT m.id, m.team_size, m.approval_level,
                  d.id as department_id, d.name as department_name
           FROM managers m
           JOIN departments d ON m.department_id = d.id
           WHERE m.account_id = ?`,
                    [id],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row || {});
                    }
                );
            });
        } else if (user.role === 'admin') {
            roleData = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id, access_level, can_modify_policies, can_manage_users
           FROM administrators
           WHERE account_id = ?`,
                    [id],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row || {});
                    }
                );
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                ...user,
                ...roleData
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new user (admin only)
 */
const createUser = async (req, res, next) => {
    try {
        const {
            username,
            password,
            fullName,
            email,
            phone,
            role,
            departmentId,
            position,
            managerId,
            accessLevel
        } = req.body;

        // Validate required fields
        if (!username || !password || !fullName || !email || !role) {
            throw new ValidationError('Required fields missing');
        }

        if (!['employee', 'manager', 'admin'].includes(role)) {
            throw new ValidationError('Invalid role');
        }

        // Check if username or email already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM accounts WHERE username = ? OR email = ?`,
                [username, email],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (existingUser) {
            throw new ValidationError('Username or email already in use');
        }

        // For employee and manager roles, department is required
        if ((role === 'employee' || role === 'manager') && !departmentId) {
            throw new ValidationError('Department ID is required for employee and manager roles');
        }

        // Check if department exists if provided
        if (departmentId) {
            const department = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM departments WHERE id = ?`,
                    [departmentId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    }
                );
            });

            if (!department) {
                throw new ValidationError('Department does not exist');
            }
        }

        // Check if manager exists if provided
        if (managerId) {
            const manager = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM accounts WHERE id = ? AND role = 'manager'`,
                    [managerId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    }
                );
            });

            if (!manager) {
                throw new ValidationError('Manager does not exist');
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with transaction
        const result = await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Insert account
                db.run(
                    `INSERT INTO accounts (username, password, full_name, email, phone, role) 
           VALUES (?, ?, ?, ?, ?, ?)`,
                    [username, hashedPassword, fullName, email, phone, role],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        const accountId = this.lastID;
                        let roleId = null;

                        // Insert role-specific record
                        if (role === 'employee') {
                            db.run(
                                `INSERT INTO employees (account_id, department_id, position, manager_id, status) 
                 VALUES (?, ?, ?, ?, 'active')`,
                                [accountId, departmentId, position || '', managerId || null],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    roleId = this.lastID;

                                    // Create initial leave balance
                                    const currentYear = new Date().getFullYear();
                                    db.run(
                                        `INSERT INTO leave_balances (employee_id, year, vacation_days, sick_days, personal_days)
                     VALUES (?, ?, 0, 0, 0)`,
                                        [roleId, currentYear],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            // Update department employee count
                                            db.run(
                                                `UPDATE departments SET employee_count = employee_count + 1 WHERE id = ?`,
                                                [departmentId],
                                                function(err) {
                                                    if (err) {
                                                        db.run('ROLLBACK');
                                                        return reject(err);
                                                    }

                                                    db.run('COMMIT', (err) => {
                                                        if (err) {
                                                            db.run('ROLLBACK');
                                                            return reject(err);
                                                        }
                                                        resolve({ accountId, roleId });
                                                    });
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        } else if (role === 'manager') {
                            db.run(
                                `INSERT INTO managers (account_id, department_id, team_size, approval_level) 
                 VALUES (?, ?, 0, ?)`,
                                [accountId, departmentId, accessLevel || 1],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    roleId = this.lastID;

                                    // Update department manager
                                    db.run(
                                        `UPDATE departments SET manager_id = ? WHERE id = ?`,
                                        [accountId, departmentId],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            db.run('COMMIT', (err) => {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return reject(err);
                                                }
                                                resolve({ accountId, roleId });
                                            });
                                        }
                                    );
                                }
                            );
                        } else if (role === 'admin') {
                            db.run(
                                `INSERT INTO administrators (account_id, access_level, can_modify_policies, can_manage_users) 
                 VALUES (?, ?, 1, 1)`,
                                [accountId, accessLevel || 1],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    roleId = this.lastID;

                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }
                                        resolve({ accountId, roleId });
                                    });
                                }
                            );
                        }
                    }
                );
            });
        });

        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            data: {
                accountId: result.accountId,
                roleId: result.roleId
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a user (admin only)
 */
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            fullName,
            email,
            phone,
            status,
            departmentId,
            position,
            managerId,
            accessLevel,
            password
        } = req.body;

        // Check if user exists and get current role
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, role FROM accounts WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('User not found'));
                    resolve(row);
                }
            );
        });

        // Start transaction
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Update account table fields
                const accountUpdates = [];
                const accountParams = [];

                if (fullName) {
                    accountUpdates.push('full_name = ?');
                    accountParams.push(fullName);
                }

                if (email) {
                    accountUpdates.push('email = ?');
                    accountParams.push(email);
                }

                if (phone !== undefined) {
                    accountUpdates.push('phone = ?');
                    accountParams.push(phone);
                }

                if (password) {
                    const hashedPassword = bcrypt.hashSync(password, 10);
                    accountUpdates.push('password = ?');
                    accountParams.push(hashedPassword);
                }

                accountUpdates.push('updated_at = CURRENT_TIMESTAMP');

                if (accountUpdates.length > 0) {
                    db.run(
                        `UPDATE accounts SET ${accountUpdates.join(', ')} WHERE id = ?`,
                        [...accountParams, id],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            // Now handle role-specific updates
                            if (user.role === 'employee') {
                                const employeeUpdates = [];
                                const employeeParams = [];

                                if (departmentId) {
                                    employeeUpdates.push('department_id = ?');
                                    employeeParams.push(departmentId);
                                }

                                if (position) {
                                    employeeUpdates.push('position = ?');
                                    employeeParams.push(position);
                                }

                                if (managerId) {
                                    employeeUpdates.push('manager_id = ?');
                                    employeeParams.push(managerId);
                                }

                                if (status) {
                                    employeeUpdates.push('status = ?');
                                    employeeParams.push(status);
                                }

                                employeeUpdates.push('updated_at = CURRENT_TIMESTAMP');

                                if (employeeUpdates.length > 0) {
                                    db.run(
                                        `UPDATE employees SET ${employeeUpdates.join(', ')} WHERE account_id = ?`,
                                        [...employeeParams, id],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            db.run('COMMIT', (err) => {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return reject(err);
                                                }
                                                resolve();
                                            });
                                        }
                                    );
                                } else {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }
                                        resolve();
                                    });
                                }
                            } else if (user.role === 'manager') {
                                const managerUpdates = [];
                                const managerParams = [];

                                if (departmentId) {
                                    managerUpdates.push('department_id = ?');
                                    managerParams.push(departmentId);
                                }

                                if (accessLevel) {
                                    managerUpdates.push('approval_level = ?');
                                    managerParams.push(accessLevel);
                                }

                                managerUpdates.push('updated_at = CURRENT_TIMESTAMP');

                                if (managerUpdates.length > 0) {
                                    db.run(
                                        `UPDATE managers SET ${managerUpdates.join(', ')} WHERE account_id = ?`,
                                        [...managerParams, id],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            // Update department manager if department changed
                                            if (departmentId) {
                                                db.run(
                                                    `UPDATE departments SET manager_id = ? WHERE id = ?`,
                                                    [id, departmentId],
                                                    function(err) {
                                                        if (err) {
                                                            db.run('ROLLBACK');
                                                            return reject(err);
                                                        }

                                                        db.run('COMMIT', (err) => {
                                                            if (err) {
                                                                db.run('ROLLBACK');
                                                                return reject(err);
                                                            }
                                                            resolve();
                                                        });
                                                    }
                                                );
                                            } else {
                                                db.run('COMMIT', (err) => {
                                                    if (err) {
                                                        db.run('ROLLBACK');
                                                        return reject(err);
                                                    }
                                                    resolve();
                                                });
                                            }
                                        }
                                    );
                                } else {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }
                                        resolve();
                                    });
                                }
                            } else if (user.role === 'admin') {
                                const adminUpdates = [];
                                const adminParams = [];

                                if (accessLevel) {
                                    adminUpdates.push('access_level = ?');
                                    adminParams.push(accessLevel);
                                }

                                adminUpdates.push('updated_at = CURRENT_TIMESTAMP');

                                if (adminUpdates.length > 0) {
                                    db.run(
                                        `UPDATE administrators SET ${adminUpdates.join(', ')} WHERE account_id = ?`,
                                        [...adminParams, id],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            db.run('COMMIT', (err) => {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return reject(err);
                                                }
                                                resolve();
                                            });
                                        }
                                    );
                                } else {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }
                                        resolve();
                                    });
                                }
                            } else {
                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }
                                    resolve();
                                });
                            }
                        }
                    );
                } else {
                    db.run('ROLLBACK');
                    reject(new ValidationError('No updates provided'));
                }
            });
        });

        res.status(200).json({
            status: 'success',
            message: 'User updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a user (admin only)
 */
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if user exists and get role
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, role FROM accounts WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('User not found'));
                    resolve(row);
                }
            );
        });

        // Can't delete the only admin
        if (user.role === 'admin') {
            const adminCount = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM accounts WHERE role = 'admin'`,
                    [],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row ? row.count : 0);
                    }
                );
            });

            if (adminCount <= 1) {
                throw new BusinessLogicError('Cannot delete the only administrator account');
            }
        }

        // Delete user with transaction
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Handle role-specific cleanup first
                if (user.role === 'employee') {
                    // Get employee details for department update
                    db.get(
                        `SELECT id, department_id FROM employees WHERE account_id = ?`,
                        [id],
                        function(err, employee) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            if (employee) {
                                // Delete leave balances
                                db.run(
                                    `DELETE FROM leave_balances WHERE employee_id = ?`,
                                    [employee.id],
                                    function(err) {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }

                                        // Delete employee record
                                        db.run(
                                            `DELETE FROM employees WHERE account_id = ?`,
                                            [id],
                                            function(err) {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return reject(err);
                                                }

                                                // Update department employee count
                                                db.run(
                                                    `UPDATE departments 
                           SET employee_count = employee_count - 1 
                           WHERE id = ?`,
                                                    [employee.department_id],
                                                    function(err) {
                                                        if (err) {
                                                            db.run('ROLLBACK');
                                                            return reject(err);
                                                        }

                                                        // Delete account
                                                        db.run(
                                                            `DELETE FROM accounts WHERE id = ?`,
                                                            [id],
                                                            function(err) {
                                                                if (err) {
                                                                    db.run('ROLLBACK');
                                                                    return reject(err);
                                                                }

                                                                db.run('COMMIT', (err) => {
                                                                    if (err) {
                                                                        db.run('ROLLBACK');
                                                                        return reject(err);
                                                                    }
                                                                    resolve();
                                                                });
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            } else {
                                // No employee record found, just delete account
                                db.run(
                                    `DELETE FROM accounts WHERE id = ?`,
                                    [id],
                                    function(err) {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }

                                        db.run('COMMIT', (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }
                                            resolve();
                                        });
                                    }
                                );
                            }
                        }
                    );
                } else if (user.role === 'manager') {
                    // Get manager details
                    db.get(
                        `SELECT id, department_id FROM managers WHERE account_id = ?`,
                        [id],
                        function(err, manager) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            if (manager) {
                                // Update employees to remove this manager
                                db.run(
                                    `UPDATE employees SET manager_id = NULL WHERE manager_id = ?`,
                                    [id],
                                    function(err) {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }

                                        // Update department to remove this manager
                                        db.run(
                                            `UPDATE departments SET manager_id = NULL WHERE manager_id = ?`,
                                            [id],
                                            function(err) {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return reject(err);
                                                }

                                                // Delete manager record
                                                db.run(
                                                    `DELETE FROM managers WHERE account_id = ?`,
                                                    [id],
                                                    function(err) {
                                                        if (err) {
                                                            db.run('ROLLBACK');
                                                            return reject(err);
                                                        }

                                                        // Delete account
                                                        db.run(
                                                            `DELETE FROM accounts WHERE id = ?`,
                                                            [id],
                                                            function(err) {
                                                                if (err) {
                                                                    db.run('ROLLBACK');
                                                                    return reject(err);
                                                                }

                                                                db.run('COMMIT', (err) => {
                                                                    if (err) {
                                                                        db.run('ROLLBACK');
                                                                        return reject(err);
                                                                    }
                                                                    resolve();
                                                                });
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            } else {
                                // No manager record found, just delete account
                                db.run(
                                    `DELETE FROM accounts WHERE id = ?`,
                                    [id],
                                    function(err) {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }

                                        db.run('COMMIT', (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }
                                            resolve();
                                        });
                                    }
                                );
                            }
                        }
                    );
                } else if (user.role === 'admin') {
                    // Delete admin record
                    db.run(
                        `DELETE FROM administrators WHERE account_id = ?`,
                        [id],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            // Delete account
                            db.run(
                                `DELETE FROM accounts WHERE id = ?`,
                                [id],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }
                                        resolve();
                                    });
                                }
                            );
                        }
                    );
                } else {
                    // Unknown role, just delete account
                    db.run(
                        `DELETE FROM accounts WHERE id = ?`,
                        [id],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            db.run('COMMIT', (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }
                                resolve();
                            });
                        }
                    );
                }
            });
        });

        res.status(200).json({
            status: 'success',
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUserById,
    createUser,
    updateUser,
    deleteUser
};