const { db } = require('../config/database');
const { ValidationError, NotFoundError, BusinessLogicError } = require('../middlewares/errorMiddleware');

/**
 * Create a new absence request
 */
const createAbsenceRequest = async (req, res, next) => {
    try {
        const { startDate, endDate, type, hasDocumentation, comments } = req.body;

        // Get employee ID from user role data
        let employeeId;
        if (req.user.role === 'employee') {
            employeeId = req.user.employee_id;
        } else {
            throw new ValidationError('Only employees can create absence requests');
        }

        // Validate dates
        if (!startDate || !endDate) {
            throw new ValidationError('Start date and end date are required');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new ValidationError('Invalid date format');
        }

        if (start > end) {
            throw new ValidationError('Start date must be before end date');
        }

        // Calculate number of days
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates

        // Check leave balance
        const leaveBalance = await new Promise((resolve, reject) => {
            const currentYear = new Date().getFullYear();
            db.get(
                `SELECT vacation_days, sick_days, personal_days FROM leave_balances 
         WHERE employee_id = ? AND year = ?`,
                [employeeId, currentYear],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!leaveBalance) {
            throw new NotFoundError('Leave balance not found');
        }

        // Check if there's enough balance
        let balanceField;
        switch (type) {
            case 'vacation': balanceField = 'vacation_days'; break;
            case 'sick': balanceField = 'sick_days'; break;
            case 'personal': balanceField = 'personal_days'; break;
            default: throw new ValidationError('Invalid absence type');
        }

        if (leaveBalance[balanceField] < diffDays) {
            throw new BusinessLogicError(`Insufficient ${type} day balance`);
        }

        // Get employee's manager
        const manager = await new Promise((resolve, reject) => {
            db.get(
                `SELECT manager_id FROM employees WHERE id = ?`,
                [employeeId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        // Create absence request
        const result = await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Insert absence request
                db.run(
                    `INSERT INTO absence_requests 
           (employee_id, start_date, end_date, type, has_documentation, comments) 
           VALUES (?, ?, ?, ?, ?, ?)`,
                    [employeeId, startDate, endDate, type, hasDocumentation ? 1 : 0, comments],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        const requestId = this.lastID;

                        // Insert into registry
                        db.run(
                            `INSERT INTO absence_registry 
               (request_id, employee_id, manager_id, creation_date, approval_status, notification_sent) 
               VALUES (?, ?, ?, date('now'), 'pending', 0)`,
                            [requestId, employeeId, manager ? manager.manager_id : null],
                            function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }

                                // Create notification for manager if exists
                                if (manager && manager.manager_id) {
                                    db.run(
                                        `INSERT INTO notifications 
                     (request_id, recipient_id, type, status, content) 
                     VALUES (?, ?, 'approval_request', 'unread', ?)`,
                                        [
                                            requestId,
                                            manager.manager_id,
                                            `New absence request from ${req.user.fullName || 'an employee'}`
                                        ],
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
                                                resolve({ requestId });
                                            });
                                        }
                                    );
                                } else {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return reject(err);
                                        }
                                        resolve({ requestId });
                                    });
                                }
                            }
                        );
                    }
                );
            });
        });

        res.status(201).json({
            status: 'success',
            message: 'Absence request created successfully',
            data: {
                requestId: result.requestId,
                status: 'pending',
                employeeId,
                startDate,
                endDate,
                type
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all absence requests based on user role
 */
const getAbsenceRequests = async (req, res, next) => {
    try {
        const { status, type, startDate, endDate, employeeId, departmentId } = req.query;

        let query = `
      SELECT 
        ar.id, ar.employee_id, e.account_id as employee_account_id,
        a.full_name as employee_name, ar.start_date, ar.end_date, 
        ar.type, ar.status, ar.has_documentation, ar.comments,
        ar.submission_time, d.id as department_id, d.name as department_name
      FROM absence_requests ar
      JOIN employees e ON ar.employee_id = e.id
      JOIN accounts a ON e.account_id = a.id
      JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;

        const params = [];

        // Filter by user role
        if (req.user.role === 'employee') {
            query += ` AND e.account_id = ?`;
            params.push(req.user.id);
        } else if (req.user.role === 'manager') {
            query += ` AND e.manager_id = ?`;
            params.push(req.user.id);
        }

        // Apply filters
        if (status) {
            query += ` AND ar.status = ?`;
            params.push(status);
        }

        if (type) {
            query += ` AND ar.type = ?`;
            params.push(type);
        }

        if (startDate) {
            query += ` AND ar.start_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND ar.end_date <= ?`;
            params.push(endDate);
        }

        if (employeeId && (req.user.role === 'manager' || req.user.role === 'admin')) {
            query += ` AND ar.employee_id = ?`;
            params.push(employeeId);
        }

        if (departmentId && req.user.role === 'admin') {
            query += ` AND d.id = ?`;
            params.push(departmentId);
        }

        query += ` ORDER BY ar.submission_time DESC`;

        const requests = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        res.status(200).json({
            status: 'success',
            data: { count: requests.length, requests }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a specific absence request by ID
 */
const getAbsenceRequestById = async (req, res, next) => {
    try {
        const { id } = req.params;

        let query = `
      SELECT 
        ar.id, ar.employee_id, e.account_id as employee_account_id,
        a.full_name as employee_name, a.email as employee_email,
        ar.start_date, ar.end_date, ar.type, ar.status, 
        ar.has_documentation, ar.comments, ar.submission_time,
        d.id as department_id, d.name as department_name,
        reg.approval_status, reg.manager_id
      FROM absence_requests ar
      JOIN employees e ON ar.employee_id = e.id
      JOIN accounts a ON e.account_id = a.id
      JOIN departments d ON e.department_id = d.id
      LEFT JOIN absence_registry reg ON ar.id = reg.request_id
      WHERE ar.id = ?
    `;

        const params = [id];

        // Add role-based filters
        if (req.user.role === 'employee') {
            query += ` AND e.account_id = ?`;
            params.push(req.user.id);
        } else if (req.user.role === 'manager') {
            query += ` AND (e.manager_id = ? OR reg.manager_id = ?)`;
            params.push(req.user.id, req.user.id);
        }

        const request = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!request) {
            throw new NotFoundError('Absence request not found or you do not have permission to view it');
        }

        res.status(200).json({
            status: 'success',
            data: request
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update absence request (only allowed for pending requests)
 */
const updateAbsenceRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { startDate, endDate, type, hasDocumentation, comments } = req.body;

        // Check if request exists and belongs to the user
        const request = await new Promise((resolve, reject) => {
            let query = `
        SELECT ar.id, ar.employee_id, ar.status, e.account_id, e.manager_id
        FROM absence_requests ar
        JOIN employees e ON ar.employee_id = e.id
        WHERE ar.id = ?
      `;

            const params = [id];

            if (req.user.role === 'employee') {
                query += ` AND e.account_id = ?`;
                params.push(req.user.id);
            }

            db.get(query, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!request) {
            throw new NotFoundError('Absence request not found or you do not have permission to modify it');
        }

        if (request.status !== 'pending') {
            throw new BusinessLogicError('Only pending requests can be updated');
        }

        // Validate dates if provided
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new ValidationError('Invalid date format');
            }

            if (start > end) {
                throw new ValidationError('Start date must be before end date');
            }
        }

        // Build update query
        let updateFields = [];
        const updateParams = [];

        if (startDate) {
            updateFields.push('start_date = ?');
            updateParams.push(startDate);
        }

        if (endDate) {
            updateFields.push('end_date = ?');
            updateParams.push(endDate);
        }

        if (type) {
            updateFields.push('type = ?');
            updateParams.push(type);
        }

        if (hasDocumentation !== undefined) {
            updateFields.push('has_documentation = ?');
            updateParams.push(hasDocumentation ? 1 : 0);
        }

        if (comments !== undefined) {
            updateFields.push('comments = ?');
            updateParams.push(comments);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        if (updateFields.length === 0) {
            throw new ValidationError('No updates provided');
        }

        // Update request
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE absence_requests SET ${updateFields.join(', ')} WHERE id = ?`,
                [...updateParams, id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        // Update registry
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE absence_registry SET modification_date = date('now') WHERE request_id = ?`,
                [id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        res.status(200).json({
            status: 'success',
            message: 'Absence request updated successfully',
            data: { requestId: id }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel an absence request
 */
const cancelAbsenceRequest = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if request exists and belongs to the user
        const request = await new Promise((resolve, reject) => {
            let query = `
        SELECT ar.id, ar.employee_id, ar.status, ar.start_date, e.account_id, e.manager_id
        FROM absence_requests ar
        JOIN employees e ON ar.employee_id = e.id
        WHERE ar.id = ?
      `;

            const params = [id];

            if (req.user.role === 'employee') {
                query += ` AND e.account_id = ?`;
                params.push(req.user.id);
            }

            db.get(query, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!request) {
            throw new NotFoundError('Absence request not found or you do not have permission to cancel it');
        }

        if (request.status === 'cancelled') {
            throw new BusinessLogicError('Request is already cancelled');
        }

        if (request.status === 'approved' && new Date(request.start_date) <= new Date()) {
            throw new BusinessLogicError('Cannot cancel an approved request that has already started');
        }

        // Cancel request
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE absence_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        // Update registry
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE absence_registry SET approval_status = 'cancelled', modification_date = date('now') WHERE request_id = ?`,
                [id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });

        // Notify manager if needed
        if (request.manager_id) {
            db.run(
                `INSERT INTO notifications 
         (request_id, recipient_id, type, status, content) 
         VALUES (?, ?, 'request_cancelled', 'unread', 'An absence request has been cancelled')`,
                [id, request.manager_id]
            );
        }

        res.status(200).json({
            status: 'success',
            message: 'Absence request cancelled successfully',
            data: { requestId: id }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Approve or reject an absence request (managers only)
 */
const processAbsenceRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, comments } = req.body;

        if (!['approve', 'reject'].includes(action)) {
            throw new ValidationError('Action must be either "approve" or "reject"');
        }

        // Check if user is a manager
        if (req.user.role !== 'manager' && req.user.role !== 'admin') {
            throw new ValidationError('Only managers and administrators can process absence requests');
        }

        // Check if request exists and belongs to the team
        const request = await new Promise((resolve, reject) => {
            let query = `
        SELECT 
          ar.id, ar.employee_id, ar.status, ar.start_date, ar.end_date, ar.type,
          e.account_id as employee_account_id, a.full_name as employee_name,
          a.email as employee_email
        FROM absence_requests ar
        JOIN employees e ON ar.employee_id = e.id
        JOIN accounts a ON e.account_id = a.id
        WHERE ar.id = ?
      `;

            const params = [id];

            if (req.user.role === 'manager') {
                query += ` AND e.manager_id = ?`;
                params.push(req.user.id);
            }

            db.get(query, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!request) {
            throw new NotFoundError('Absence request not found or you do not have permission to process it');
        }

        if (request.status !== 'pending') {
            throw new BusinessLogicError(`Cannot ${action} a request that is not pending`);
        }

        // Calculate days
        const start = new Date(request.start_date);
        const end = new Date(request.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Process request
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // Update request status
                db.run(
                    `UPDATE absence_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [newStatus, id],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        // Update registry
                        db.run(
                            `UPDATE absence_registry SET approval_status = ?, modification_date = date('now') WHERE request_id = ?`,
                            [newStatus, id],
                            function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return reject(err);
                                }

                                // If approved, update leave balance
                                if (action === 'approve') {
                                    let balanceField;
                                    switch (request.type) {
                                        case 'vacation': balanceField = 'vacation_days'; break;
                                        case 'sick': balanceField = 'sick_days'; break;
                                        case 'personal': balanceField = 'personal_days'; break;
                                    }

                                    const currentYear = new Date().getFullYear();

                                    db.run(
                                        `UPDATE leave_balances SET 
                     ${balanceField} = ${balanceField} - ?,
                     updated_at = CURRENT_TIMESTAMP
                     WHERE employee_id = ? AND year = ?`,
                                        [diffDays, request.employee_id, currentYear],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return reject(err);
                                            }

                                            // Create notification for employee
                                            db.run(
                                                `INSERT INTO notifications 
                         (request_id, recipient_id, type, status, content) 
                         VALUES (?, ?, ?, 'unread', ?)`,
                                                [
                                                    id,
                                                    request.employee_account_id,
                                                    action === 'approve' ? 'request_approved' : 'request_rejected',
                                                    action === 'approve'
                                                        ? 'Your absence request has been approved'
                                                        : `Your absence request has been rejected${comments ? ': ' + comments : ''}`
                                                ],
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
                                    // Create notification for employee (rejection)
                                    db.run(
                                        `INSERT INTO notifications 
                     (request_id, recipient_id, type, status, content) 
                     VALUES (?, ?, 'request_rejected', 'unread', ?)`,
                                        [
                                            id,
                                            request.employee_account_id,
                                            `Your absence request has been rejected${comments ? ': ' + comments : ''}`
                                        ],
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
                    }
                );
            });
        });

        res.status(200).json({
            status: 'success',
            message: `Absence request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
            data: { requestId: id }
        });
    } catch (error) {
        next(error);
    }
};

const updateAbsenceStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, comments } = req.body;

        // Validate status
        if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
            throw new ValidationError('Invalid status');
        }

        // Check if absence request exists
        const request = await new Promise((resolve, reject) => {
            db.get(
                `SELECT ar.id, ar.employee_id, ar.status, ar.start_date, ar.end_date, ar.type, 
         e.account_id as employee_account_id
         FROM absence_requests ar
         JOIN employees e ON ar.employee_id = e.id
         WHERE ar.id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });

        if (!request) {
            throw new NotFoundError('Absence request not found');
        }

        // Check permissions based on requested status change
        if ((status === 'approved' || status === 'rejected') &&
            req.user.role !== 'manager' && req.user.role !== 'admin') {
            throw new AuthorizationError('Only managers and admins can approve or reject requests');
        }

        if (status === 'cancelled' &&
            req.user.role === 'employee' &&
            request.employee_account_id !== req.user.id) {
            throw new AuthorizationError('Employees can only cancel their own requests');
        }

        // Process the status change
        if (status === 'approved' || status === 'rejected') {
            // Process approval/rejection
            await absenceService.processAbsence(
                id,
                status === 'approved' ? 'approve' : 'reject',
                comments || ''
            );
        } else if (status === 'cancelled') {
            // Cancel the request
            await absenceService.cancelAbsence(id);
        } else {
            // Update to pending (reset status)
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE absence_requests SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [id],
                    function(err) {
                        if (err) return reject(err);
                        resolve(this.changes);
                    }
                );
            });

            // Update registry
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE absence_registry SET approval_status = 'pending', modification_date = date('now') WHERE request_id = ?`,
                    [id],
                    function(err) {
                        if (err) return reject(err);
                        resolve(this.changes);
                    }
                );
            });
        }

        res.status(200).json({
            status: 'success',
            message: `Absence request status updated to ${status}`,
            data: { requestId: id }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createAbsenceRequest,
    getAbsenceRequests,
    getAbsenceRequestById,
    updateAbsenceRequest,
    cancelAbsenceRequest,
    processAbsenceRequest,
    updateAbsenceStatus
};