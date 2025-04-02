const { db } = require('../config/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../middlewares/errorMiddleware');

/**
 * Get all departments
 */
const getAllDepartments = async (req, res, next) => {
    try {
        const departments = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
          d.id, 
          d.name, 
          d.manager_id, 
          d.policy_id,
          d.location,
          d.employee_count,
          a.full_name as manager_name
         FROM departments d
         LEFT JOIN accounts a ON d.manager_id = a.id
         ORDER BY d.name ASC`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            data: {
                count: departments.length,
                departments
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get department by ID
 */
const getDepartmentById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const department = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          d.id, 
          d.name, 
          d.manager_id, 
          d.policy_id,
          d.location,
          d.employee_count,
          a.full_name as manager_name,
          ap.min_days_notice,
          ap.max_consecutive_days,
          ap.approval_required
         FROM departments d
         LEFT JOIN accounts a ON d.manager_id = a.id
         LEFT JOIN absence_policies ap ON d.policy_id = ap.id
         WHERE d.id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!department) {
            throw new NotFoundError('Department not found');
        }

        // Get employees in department
        const employees = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
          e.id, 
          a.full_name,
          e.position,
          e.status
         FROM employees e
         JOIN accounts a ON e.account_id = a.id
         WHERE e.department_id = ?
         ORDER BY a.full_name ASC`,
                [id],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            data: {
                ...department,
                employees
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new department
 */
const createDepartment = async (req, res, next) => {
    try {
        // This should be admin-only (enforced by middleware)
        const { name, managerId, location } = req.body;

        if (!name) {
            throw new ValidationError('Department name is required');
        }

        // Check if department name already exists
        const existingDepartment = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM departments WHERE name = ?`,
                [name],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (existingDepartment) {
            throw new ValidationError('Department name already exists');
        }

        // If manager ID is provided, check if it exists and is a manager
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
                throw new ValidationError('Manager does not exist or is not a manager');
            }
        }

        // Create department with default absence policy
        const result = await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // First create default absence policy
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
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        const policyId = this.lastID;

                        // Then create department with policy
                        db.run(
                            `INSERT INTO departments (name, manager_id, policy_id, location, employee_count) 
               VALUES (?, ?, ?, ?, 0)`,
                            [name, managerId || null, policyId, location || null],
                            function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }

                                const departmentId = this.lastID;

                                // Update the policy to link it to the department
                                db.run(
                                    `UPDATE absence_policies SET department_id = ? WHERE id = ?`,
                                    [departmentId, policyId],
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
                                            resolve({ departmentId, policyId });
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            });
        });

        res.status(201).json({
            status: 'success',
            message: 'Department created successfully',
            data: {
                id: result.departmentId,
                name,
                managerId: managerId || null,
                policyId: result.policyId,
                location: location || null,
                employeeCount: 0
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a department
 */
const updateDepartment = async (req, res, next) => {
    try {
        // This should be admin-only (enforced by middleware)
        const { id } = req.params;
        const { name, managerId, location } = req.body;

        // Check if department exists
        const department = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM departments WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!department) {
            throw new NotFoundError('Department not found');
        }

        // If name provided, check if another department has this name
        if (name) {
            const existingDepartment = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM departments WHERE name = ? AND id != ?`,
                    [name, id],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    }
                );
            });

            if (existingDepartment) {
                throw new ValidationError('Department name already exists');
            }
        }

        // If manager ID is provided, check if it exists and is a manager
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
                throw new ValidationError('Manager does not exist or is not a manager');
            }
        }

        // Build update query
        const updateFields = [];
        const updateParams = [];

        if (name) {
            updateFields.push('name = ?');
            updateParams.push(name);
        }

        if (managerId !== undefined) {
            updateFields.push('manager_id = ?');
            updateParams.push(managerId === null ? null : managerId);
        }

        if (location !== undefined) {
            updateFields.push('location = ?');
            updateParams.push(location === null ? null : location);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        if (updateFields.length <= 1) {
            throw new ValidationError('No updates provided');
        }

        // Update department
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE departments SET ${updateFields.join(', ')} WHERE id = ?`,
                [...updateParams, id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            message: 'Department updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a department (admin only)
 */
const deleteDepartment = async (req, res, next) => {
    try {
        // This should be admin-only (enforced by middleware)
        const { id } = req.params;
        const { transferToId } = req.body;

        // Check if department exists
        const department = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, employee_count FROM departments WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!department) {
            throw new NotFoundError('Department not found');
        }

        // Check if the department has employees
        if (department.employee_count > 0) {
            // If it does, require a transfer department
            if (!transferToId) {
                throw new ValidationError('Transfer department ID is required to delete a department with employees');
            }

            // Check if transfer department exists
            const transferDepartment = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM departments WHERE id = ?`,
                    [transferToId],
                    (err, row) => {
                        if (err) return reject(err);
                        resolve(row);
                    }
                );
            });

            if (!transferDepartment) {
                throw new ValidationError('Transfer department not found');
            }

            if (parseInt(transferToId) === parseInt(id)) {
                throw new ValidationError('Cannot transfer employees to the same department');
            }
        }

        // Delete department with transaction
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // If department has employees, transfer them
                if (department.employee_count > 0 && transferToId) {
                    db.run(
                        `UPDATE employees SET department_id = ? WHERE department_id = ?`,
                        [transferToId, id],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            // Update transfer department employee count
                            db.run(
                                `UPDATE departments 
                 SET employee_count = employee_count + ? 
                 WHERE id = ?`,
                                [department.employee_count, transferToId],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return reject(err);
                                    }

                                    // Delete absence policy
                                    db.run(
                                        `DELETE FROM absence_policies WHERE department_id = ?`,
                                        [id],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            // Delete department
                                            db.run(
                                                `DELETE FROM departments WHERE id = ?`,
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
                    // Department has no employees, just delete it and its policy
                    db.run(
                        `DELETE FROM absence_policies WHERE department_id = ?`,
                        [id],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }

                            // Delete department
                            db.run(
                                `DELETE FROM departments WHERE id = ?`,
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
            });
        });

        res.status(200).json({
            status: 'success',
            message: 'Department deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get department absence policy
 */
const getDepartmentPolicy = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if department exists
        const department = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, policy_id FROM departments WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!department) {
            throw new NotFoundError('Department not found');
        }

        // Get absence policy
        const policy = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM absence_policies WHERE id = ?`,
                [department.policy_id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!policy) {
            throw new NotFoundError('Absence policy not found for this department');
        }

        res.status(200).json({
            status: 'success',
            data: policy
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update department absence policy
 */
const updateDepartmentPolicy = async (req, res, next) => {
    try {
        // This should be admin-only (enforced by middleware)
        const { id } = req.params;
        const {
            minDaysNotice,
            maxConsecutiveDays,
            approvalRequired,
            documentationRequiredAfter,
            maxSickDays,
            maxVacationDays,
            maxPersonalDays
        } = req.body;

        // Check if department exists
        const department = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, policy_id FROM departments WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!department) {
            throw new NotFoundError('Department not found');
        }

        // Build update query
        const updateFields = [];
        const updateParams = [];

        if (minDaysNotice !== undefined) {
            updateFields.push('min_days_notice = ?');
            updateParams.push(minDaysNotice);
        }

        if (maxConsecutiveDays !== undefined) {
            updateFields.push('max_consecutive_days = ?');
            updateParams.push(maxConsecutiveDays);
        }

        if (approvalRequired !== undefined) {
            updateFields.push('approval_required = ?');
            updateParams.push(approvalRequired ? 1 : 0);
        }

        if (documentationRequiredAfter !== undefined) {
            updateFields.push('documentation_required_after = ?');
            updateParams.push(documentationRequiredAfter);
        }

        if (maxSickDays !== undefined) {
            updateFields.push('max_sick_days = ?');
            updateParams.push(maxSickDays);
        }

        if (maxVacationDays !== undefined) {
            updateFields.push('max_vacation_days = ?');
            updateParams.push(maxVacationDays);
        }

        if (maxPersonalDays !== undefined) {
            updateFields.push('max_personal_days = ?');
            updateParams.push(maxPersonalDays);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        if (updateFields.length <= 1) {
            throw new ValidationError('No updates provided');
        }

        // Update policy
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE absence_policies 
         SET ${updateFields.join(', ')} 
         WHERE id = ?`,
                [...updateParams, department.policy_id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            message: 'Department absence policy updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    getDepartmentPolicy,
    updateDepartmentPolicy
};