const { db } = require('../config/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../middlewares/errorMiddleware');

/**
 * Get leave balance for the current employee
 */
const getCurrentEmployeeLeaveBalance = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { year = new Date().getFullYear() } = req.query;

        // Check if user is an employee
        if (req.user.role !== 'employee') {
            throw new ValidationError('Only employees can access their leave balance');
        }

        // Get employee ID
        const employee = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM employees WHERE account_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('Employee record not found'));
                    resolve(row);
                }
            );
        });

        // Get leave balance
        const leaveBalance = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          employee_id,
          year,
          vacation_days,
          sick_days,
          personal_days,
          created_at,
          updated_at
         FROM leave_balances
         WHERE employee_id = ? AND year = ?`,
                [employee.id, year],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!leaveBalance) {
            throw new NotFoundError(`Leave balance for year ${year} not found`);
        }

        // Get absence usage for current year
        const absenceUsage = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
          type,
          SUM(JULIANDAY(end_date) - JULIANDAY(start_date) + 1) as days_used
         FROM absence_requests
         WHERE employee_id = ? 
         AND status = 'approved'
         AND strftime('%Y', start_date) = ?
         GROUP BY type`,
                [employee.id, year.toString()],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // Convert absence usage to object
        const usage = {
            vacation: 0,
            sick: 0,
            personal: 0
        };

        absenceUsage.forEach(item => {
            if (item.type in usage) {
                usage[item.type] = item.days_used;
            }
        });

        // Get department absence policy
        const policy = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          ap.max_vacation_days,
          ap.max_sick_days,
          ap.max_personal_days
         FROM absence_policies ap
         JOIN employees e ON e.department_id = ap.department_id
         WHERE e.id = ?`,
                [employee.id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || {
                        max_vacation_days: 0,
                        max_sick_days: 0,
                        max_personal_days: 0
                    });
                }
            );
        });

        res.status(200).json({
            status: 'success',
            data: {
                year: leaveBalance.year,
                balance: {
                    vacation: leaveBalance.vacation_days,
                    sick: leaveBalance.sick_days,
                    personal: leaveBalance.personal_days
                },
                used: usage,
                remaining: {
                    vacation: leaveBalance.vacation_days - usage.vacation,
                    sick: leaveBalance.sick_days - usage.sick,
                    personal: leaveBalance.personal_days - usage.personal
                },
                max: {
                    vacation: policy.max_vacation_days,
                    sick: policy.max_sick_days,
                    personal: policy.max_personal_days
                },
                lastUpdated: leaveBalance.updated_at
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get leave balance for a specific employee (manager and admin only)
 */
const getEmployeeLeaveBalance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { year = new Date().getFullYear() } = req.query;

        // Check permissions (admins can access any, managers only their team)
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            throw new ValidationError('Only managers and administrators can access employee leave balances');
        }

        // For managers, verify that the employee is in their team
        if (req.user.role === 'manager') {
            const isTeamMember = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT 1 FROM employees 
           WHERE id = ? AND manager_id = ?`,
                    [id, req.user.id],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(!!row);
                    }
                );
            });

            if (!isTeamMember) {
                throw new ValidationError('You can only access leave balances for employees in your team');
            }
        }

        // Get employee info
        const employee = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          e.id, 
          e.account_id,
          e.department_id,
          a.full_name,
          d.name as department_name
         FROM employees e
         JOIN accounts a ON e.account_id = a.id
         JOIN departments d ON e.department_id = d.id
         WHERE e.id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('Employee not found'));
                    resolve(row);
                }
            );
        });

        // Get leave balance
        const leaveBalance = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          employee_id,
          year,
          vacation_days,
          sick_days,
          personal_days,
          created_at,
          updated_at
         FROM leave_balances
         WHERE employee_id = ? AND year = ?`,
                [id, year],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!leaveBalance) {
            throw new NotFoundError(`Leave balance for year ${year} not found`);
        }

        // Get absence usage for the year
        const absenceUsage = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
          type,
          SUM(JULIANDAY(end_date) - JULIANDAY(start_date) + 1) as days_used
         FROM absence_requests
         WHERE employee_id = ? 
         AND status = 'approved'
         AND strftime('%Y', start_date) = ?
         GROUP BY type`,
                [id, year.toString()],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // Convert absence usage to object
        const usage = {
            vacation: 0,
            sick: 0,
            personal: 0
        };

        absenceUsage.forEach(item => {
            if (item.type in usage) {
                usage[item.type] = item.days_used;
            }
        });

        // Get department absence policy
        const policy = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          max_vacation_days,
          max_sick_days,
          max_personal_days
         FROM absence_policies
         WHERE department_id = ?`,
                [employee.department_id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || {
                        max_vacation_days: 0,
                        max_sick_days: 0,
                        max_personal_days: 0
                    });
                }
            );
        });

        res.status(200).json({
            status: 'success',
            data: {
                employee: {
                    id: employee.id,
                    name: employee.full_name,
                    department: employee.department_name
                },
                year: leaveBalance.year,
                balance: {
                    vacation: leaveBalance.vacation_days,
                    sick: leaveBalance.sick_days,
                    personal: leaveBalance.personal_days
                },
                used: usage,
                remaining: {
                    vacation: leaveBalance.vacation_days - usage.vacation,
                    sick: leaveBalance.sick_days - usage.sick,
                    personal: leaveBalance.personal_days - usage.personal
                },
                max: {
                    vacation: policy.max_vacation_days,
                    sick: policy.max_sick_days,
                    personal: policy.max_personal_days
                },
                lastUpdated: leaveBalance.updated_at
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update leave balance for an employee (admin only)
 */
const updateEmployeeLeaveBalance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            year = new Date().getFullYear(),
            vacationDays,
            sickDays,
            personalDays
        } = req.body;

        // Check if at least one field is provided
        if (vacationDays === undefined && sickDays === undefined && personalDays === undefined) {
            throw new ValidationError('At least one leave type must be provided');
        }

        // Validate leave days
        if (vacationDays !== undefined && vacationDays < 0) {
            throw new ValidationError('Vacation days cannot be negative');
        }

        if (sickDays !== undefined && sickDays < 0) {
            throw new ValidationError('Sick days cannot be negative');
        }

        if (personalDays !== undefined && personalDays < 0) {
            throw new ValidationError('Personal days cannot be negative');
        }

        // Check if employee exists
        const employee = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM employees WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('Employee not found'));
                    resolve(row);
                }
            );
        });

        // Check if leave balance exists for the year
        const leaveBalance = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM leave_balances WHERE employee_id = ? AND year = ?`,
                [id, year],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        // Create or update leave balance
        if (leaveBalance) {
            // Update existing balance
            const updateFields = [];
            const updateParams = [];

            if (vacationDays !== undefined) {
                updateFields.push('vacation_days = ?');
                updateParams.push(vacationDays);
            }

            if (sickDays !== undefined) {
                updateFields.push('sick_days = ?');
                updateParams.push(sickDays);
            }

            if (personalDays !== undefined) {
                updateFields.push('personal_days = ?');
                updateParams.push(personalDays);
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');

            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE leave_balances
           SET ${updateFields.join(', ')}
           WHERE employee_id = ? AND year = ?`,
                    [...updateParams, id, year],
                    function(err) {
                        if (err) return reject(err);
                        resolve(this.changes);
                    }
                );
            });
        } else {
            // Create new balance
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO leave_balances
           (employee_id, year, vacation_days, sick_days, personal_days)
           VALUES (?, ?, ?, ?, ?)`,
                    [
                        id,
                        year,
                        vacationDays !== undefined ? vacationDays : 0,
                        sickDays !== undefined ? sickDays : 0,
                        personalDays !== undefined ? personalDays : 0
                    ],
                    function(err) {
                        if (err) return reject(err);
                        resolve(this.lastID);
                    }
                );
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Leave balance updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get leave balances for all employees in a manager's team
 */
const getTeamLeaveBalances = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { year = new Date().getFullYear() } = req.query;

        // Check if user is a manager
        if (req.user.role !== 'manager' && req.user.role !== 'admin') {
            throw new ValidationError('Only managers and administrators can access team leave balances');
        }

        // Get team members (if manager)
        let teamMembers;

        if (req.user.role === 'manager') {
            teamMembers = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT 
            e.id, 
            a.full_name,
            e.position,
            d.name as department_name
           FROM employees e
           JOIN accounts a ON e.account_id = a.id
           JOIN departments d ON e.department_id = d.id
           WHERE e.manager_id = ?
           ORDER BY a.full_name ASC`,
                    [userId],
                    (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    }
                );
            });
        } else {
            // Admin can see all employees, optionally filtered by department
            const { departmentId } = req.query;

            let query = `
        SELECT 
          e.id, 
          a.full_name,
          e.position,
          d.name as department_name
         FROM employees e
         JOIN accounts a ON e.account_id = a.id
         JOIN departments d ON e.department_id = d.id
         WHERE 1=1
      `;

            const params = [];

            if (departmentId) {
                query += ` AND e.department_id = ?`;
                params.push(departmentId);
            }

            query += ` ORDER BY a.full_name ASC`;

            teamMembers = await new Promise((resolve, reject) => {
                db.all(query, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
            });
        }

        if (teamMembers.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    year,
                    employees: []
                }
            });
        }

        // Get leave balances for all team members
        const employeeIds = teamMembers.map(employee => employee.id);
        const balances = await new Promise((resolve, reject) => {
            const placeholders = employeeIds.map(() => '?').join(',');
            db.all(
                `SELECT 
          employee_id,
          vacation_days,
          sick_days,
          personal_days
         FROM leave_balances
         WHERE employee_id IN (${placeholders}) AND year = ?`,
                [...employeeIds, year],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // Get absence usage for all team members
        const usage = await new Promise((resolve, reject) => {
            const placeholders = employeeIds.map(() => '?').join(',');
            db.all(
                `SELECT 
          employee_id,
          type,
          SUM(JULIANDAY(end_date) - JULIANDAY(start_date) + 1) as days_used
         FROM absence_requests
         WHERE employee_id IN (${placeholders}) 
         AND status = 'approved'
         AND strftime('%Y', start_date) = ?
         GROUP BY employee_id, type`,
                [...employeeIds, year.toString()],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // Map usage data to employees
        const usageByEmployee = {};
        usage.forEach(item => {
            if (!usageByEmployee[item.employee_id]) {
                usageByEmployee[item.employee_id] = {
                    vacation: 0,
                    sick: 0,
                    personal: 0
                };
            }

            if (item.type in usageByEmployee[item.employee_id]) {
                usageByEmployee[item.employee_id][item.type] = item.days_used;
            }
        });

        // Map balance data to employees
        const balanceByEmployee = {};
        balances.forEach(item => {
            balanceByEmployee[item.employee_id] = {
                vacation: item.vacation_days,
                sick: item.sick_days,
                personal: item.personal_days
            };
        });

        // Combine data
        const employeesWithBalances = teamMembers.map(employee => {
            const balance = balanceByEmployee[employee.id] || { vacation: 0, sick: 0, personal: 0 };
            const used = usageByEmployee[employee.id] || { vacation: 0, sick: 0, personal: 0 };

            return {
                id: employee.id,
                name: employee.full_name,
                position: employee.position,
                department: employee.department_name,
                balance,
                used,
                remaining: {
                    vacation: balance.vacation - (used.vacation || 0),
                    sick: balance.sick - (used.sick || 0),
                    personal: balance.personal - (used.personal || 0)
                }
            };
        });

        res.status(200).json({
            status: 'success',
            data: {
                year,
                employees: employeesWithBalances
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCurrentEmployeeLeaveBalance,
    getEmployeeLeaveBalance,
    updateEmployeeLeaveBalance,
    getTeamLeaveBalances
};