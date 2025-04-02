const bcrypt = require('bcrypt');
const { db } = require('../config/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../middlewares/errorMiddleware');

/**
 * Get current user profile
 */
const getCurrentUser = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Get user account
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, username, full_name, email, phone, role, last_login, created_at 
         FROM accounts 
         WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('User not found'));
                    resolve(row);
                }
            );
        });

        // Get role-specific data
        let roleData = {};

        if (user.role === 'employee') {
            roleData = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT e.id, e.position, e.hire_date, e.status,
                  d.id as department_id, d.name as department_name,
                  m.id as manager_id, a.full_name as manager_name
           FROM employees e
           JOIN departments d ON e.department_id = d.id
           LEFT JOIN employees m ON e.manager_id = m.account_id
           LEFT JOIN accounts a ON m.account_id = a.id
           WHERE e.account_id = ?`,
                    [userId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row || {});
                    }
                );
            });

            // Get leave balances
            const currentYear = new Date().getFullYear();
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
        } else if (user.role === 'manager') {
            roleData = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT m.id, m.team_size, m.approval_level,
                  d.id as department_id, d.name as department_name
           FROM managers m
           JOIN departments d ON m.department_id = d.id
           WHERE m.account_id = ?`,
                    [userId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row || {});
                    }
                );
            });

            // Get pending requests count
            const pendingRequests = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count
           FROM absence_requests ar
           JOIN employees e ON ar.employee_id = e.id
           WHERE e.manager_id = ? AND ar.status = 'pending'`,
                    [userId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row ? row.count : 0);
                    }
                );
            });

            roleData.pendingRequests = pendingRequests;
        } else if (user.role === 'admin') {
            roleData = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id, access_level, can_modify_policies, can_manage_users, last_active
           FROM administrators
           WHERE account_id = ?`,
                    [userId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row || {});
                    }
                );
            });
        }

        // Get unread notifications count
        const unreadNotifications = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count
         FROM notifications
         WHERE recipient_id = ? AND status = 'unread'`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row ? row.count : 0);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            data: {
                ...user,
                ...roleData,
                unreadNotifications
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update current user profile
 */
const updateCurrentUser = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fullName, email, phone, currentPassword, newPassword } = req.body;

        // Check if user exists
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, password FROM accounts WHERE id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('User not found'));
                    resolve(row);
                }
            );
        });

        // Build update query
        let updateFields = [];
        const updateParams = [];

        if (fullName) {
            updateFields.push('full_name = ?');
            updateParams.push(fullName);
        }

        if (email) {
            // Check if email is already used by another user
            const existingEmail = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM accounts WHERE email = ? AND id != ?`,
                    [email, userId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    }
                );
            });

            if (existingEmail) {
                throw new ValidationError('Email is already in use');
            }

            updateFields.push('email = ?');
            updateParams.push(email);
        }

        if (phone) {
            updateFields.push('phone = ?');
            updateParams.push(phone);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // Handle password change if requested
        if (newPassword) {
            if (!currentPassword) {
                throw new ValidationError('Current password is required to set a new password');
            }

            // Verify current password
            const passwordMatch = await bcrypt.compare(currentPassword, user.password);
            if (!passwordMatch) {
                throw new ValidationError('Current password is incorrect');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updateFields.push('password = ?');
            updateParams.push(hashedPassword);
        }

        if (updateFields.length === 0) {
            throw new ValidationError('No updates provided');
        }

        // Update user
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE accounts SET ${updateFields.join(', ')} WHERE id = ?`,
                [...updateParams, userId],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            message: 'User profile updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all users (admin only)
 */
const getAllUsers = async (req, res, next) => {
    try {
        // This endpoint is admin-only (enforced by middleware)
        const { role, department, status, search } = req.query;

        let query = `
      SELECT 
        a.id, a.username, a.full_name, a.email, a.phone, a.role, a.last_login,
        CASE 
          WHEN a.role = 'employee' THEN e.id 
          WHEN a.role = 'manager' THEN m.id 
          WHEN a.role = 'admin' THEN admin.id 
          ELSE NULL 
        END as role_id,
        CASE 
          WHEN a.role = 'employee' THEN e.status 
          ELSE 'active' 
        END as status,
        CASE 
          WHEN a.role = 'employee' THEN d_e.id 
          WHEN a.role = 'manager' THEN d_m.id 
          ELSE NULL 
        END as department_id,
        CASE 
          WHEN a.role = 'employee' THEN d_e.name 
          WHEN a.role = 'manager' THEN d_m.name 
          ELSE NULL 
        END as department_name
      FROM accounts a
      LEFT JOIN employees e ON a.id = e.account_id AND a.role = 'employee'
      LEFT JOIN managers m ON a.id = m.account_id AND a.role = 'manager'
      LEFT JOIN administrators admin ON a.id = admin.account_id AND a.role = 'admin'
      LEFT JOIN departments d_e ON e.department_id = d_e.id
      LEFT JOIN departments d_m ON m.department_id = d_m.id
      WHERE 1=1
    `;

        const params = [];

        // Apply filters
        if (role) {
            query += ` AND a.role = ?`;
            params.push(role);
        }

        if (department) {
            query += ` AND (d_e.id = ? OR d_m.id = ?)`;
            params.push(department, department);
        }

        if (status) {
            if (status === 'active' || status === 'inactive') {
                query += ` AND (e.status = ? OR a.role != 'employee')`;
                params.push(status);
            } else {
                query += ` AND e.status = ?`;
                params.push(status);
            }
        }

        if (search) {
            query += ` AND (
        a.username LIKE ? OR 
        a.full_name LIKE ? OR 
        a.email LIKE ?
      )`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        query += ` ORDER BY a.full_name ASC`;

        const users = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        res.status(200).json({
            status: 'success',
            data: {
                count: users.length,
                users
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCurrentUser,
    updateCurrentUser,
    getAllUsers
};