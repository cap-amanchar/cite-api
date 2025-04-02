const { db } = require('../config/database');
const { ValidationError, NotFoundError } = require('../middlewares/errorMiddleware');

/**
 * Generate employee absence report
 */
const generateEmployeeAbsenceReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { year = new Date().getFullYear() } = req.query;

        // Check permissions
        if (req.user.role === 'employee' && req.user.employee_id != id) {
            throw new ValidationError('You can only access your own absence report');
        }

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
                throw new ValidationError('You can only access reports for employees in your team');
            }
        }

        // Get employee info
        const employee = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          e.id, 
          a.full_name as name,
          e.position,
          d.name as department,
          e.hire_date,
          m.account_id as manager_id,
          ma.full_name as manager_name
         FROM employees e
         JOIN accounts a ON e.account_id = a.id
         JOIN departments d ON e.department_id = d.id
         LEFT JOIN managers m ON e.manager_id = m.id
         LEFT JOIN accounts ma ON m.account_id = ma.id
         WHERE e.id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('Employee not found'));
                    resolve(row);
                }
            );
        });

        // Get leave balances
        const leaveBalance = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
          vacation_days,
          sick_days,
          personal_days
         FROM leave_balances
         WHERE employee_id = ? AND year = ?`,
                [id, year],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || { vacation_days: 0, sick_days: 0, personal_days: 0 });
                }
            );
        });

        // Get all absence requests for the year
        const absences = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
          id,
          type,
          start_date,
          end_date,
          status,
          has_documentation,
          comments,
          JULIANDAY(end_date) - JULIANDAY(start_date) + 1 as days_count,
          strftime('%Y-%m', start_date) as month,
          submission_time
         FROM absence_requests
         WHERE employee_id = ? 
         AND strftime('%Y', start_date) = ?
         ORDER BY start_date DESC`,
                [id, year.toString()],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // Calculate summary statistics
        const summary = {
            totalRequests: absences.length,
            totalDays: absences.reduce((sum, a) => sum + a.days_count, 0),
            byStatus: {
                pending: { count: 0, days: 0 },
                approved: { count: 0, days: 0 },
                rejected: { count: 0, days: 0 },
                cancelled: { count: 0, days: 0 }
            },
            byType: {
                vacation: { count: 0, days: 0 },
                sick: { count: 0, days: 0 },
                personal: { count: 0, days: 0 }
            },
            byMonth: {}
        };

        // Initialize months
        for (let i = 1; i <= 12; i++) {
            const month = `${year}-${i.toString().padStart(2, '0')}`;
            summary.byMonth[month] = { count: 0, days: 0 };
        }

        // Populate summary
        absences.forEach(absence => {
            // By status
            if (summary.byStatus[absence.status]) {
                summary.byStatus[absence.status].count += 1;
                summary.byStatus[absence.status].days += absence.days_count;
            }

            // By type
            if (summary.byType[absence.type]) {
                summary.byType[absence.type].count += 1;
                summary.byType[absence.type].days += absence.days_count;
            }

            // By month
            if (summary.byMonth[absence.month]) {
                summary.byMonth[absence.month].count += 1;
                summary.byMonth[absence.month].days += absence.days_count;
            }
        });

        // Calculate total used
        const totalUsedDays = {
            vacation: summary.byType.vacation.days,
            sick: summary.byType.sick.days,
            personal: summary.byType.personal.days
        };

        // Calculate remaining balance
        const remainingBalance = {
            vacation: leaveBalance.vacation_days - totalUsedDays.vacation,
            sick: leaveBalance.sick_days - totalUsedDays.sick,
            personal: leaveBalance.personal_days - totalUsedDays.personal
        };

        res.status(200).json({
            status: 'success',
            data: {
                employee,
                year,
                leaveBalance: {
                    allocated: {
                        vacation: leaveBalance.vacation_days,
                        sick: leaveBalance.sick_days,
                        personal: leaveBalance.personal_days
                    },
                    used: totalUsedDays,
                    remaining: remainingBalance
                },
                summary,
                absences
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Generate department absence calendar
 */
const generateDepartmentCalendar = async (req, res, next) => {
    try {
        const { departmentId } = req.params;
        const { month, year = new Date().getFullYear() } = req.query;

        // Validate department
        const department = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, name FROM departments WHERE id = ?`,
                [departmentId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new NotFoundError('Department not found'));
                    resolve(row);
                }
            );
        });

        // Build date filters
        let dateFilter = '';
        const dateParams = [];

        if (month) {
            // Specific month
            dateFilter = `AND strftime('%Y-%m', ar.start_date) = ? OR strftime('%Y-%m', ar.end_date) = ?`;
            const formattedMonth = `${year}-${month.toString().padStart(2, '0')}`;
            dateParams.push(formattedMonth, formattedMonth);
        } else {
            // Full year
            dateFilter = `AND strftime('%Y', ar.start_date) = ? OR strftime('%Y', ar.end_date) = ?`;
            dateParams.push(year.toString(), year.toString());
        }

        // Get all approved absences for the department
        const absences = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
          ar.id,
          ar.employee_id,
          a.full_name as employee_name,
          ar.type,
          ar.start_date,
          ar.end_date,
          JULIANDAY(ar.end_date) - JULIANDAY(ar.start_date) + 1 as days_count
         FROM absence_requests ar
         JOIN employees e ON ar.employee_id = e.id
         JOIN accounts a ON e.account_id = a.id
         WHERE e.department_id = ?
         AND ar.status = 'approved'
         ${dateFilter}
         ORDER BY ar.start_date ASC`,
                [departmentId, ...dateParams],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // Get all employees in department
        const employees = await new Promise((resolve, reject) => {
            db.all(
                `SELECT 
          e.id,
          a.full_name as name,
          e.position
         FROM employees e
         JOIN accounts a ON e.account_id = a.id
         WHERE e.department_id = ?
         ORDER BY a.full_name ASC`,
                [departmentId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });

        // Prepare calendar data
        // Generate all days in the period
        let startDate, endDate;
        if (month) {
            // Specific month
            const monthNum = parseInt(month);
            startDate = new Date(year, monthNum - 1, 1);
            endDate = new Date(year, monthNum, 0); // Last day of month
        } else {
            // Full year
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
        }

        // Generate all days in range
        const days = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            days.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Format dates as YYYY-MM-DD
        const formatDate = (date) => {
            return date.toISOString().split('T')[0];
        };

        // Create calendar data
        const calendar = days.map(day => {
            const formattedDay = formatDate(day);
            const dayAbsences = [];

            // Find all absences that include this day
            absences.forEach(absence => {
                const absenceStart = new Date(absence.start_date);
                const absenceEnd = new Date(absence.end_date);

                if (day >= absenceStart && day <= absenceEnd) {
                    dayAbsences.push({
                        id: absence.id,
                        employeeId: absence.employee_id,
                        employeeName: absence.employee_name,
                        type: absence.type
                    });
                }
            });

            return {
                date: formattedDay,
                dayOfWeek: day.getDay(),
                month: day.getMonth() + 1,
                absences: dayAbsences,
                totalAbsences: dayAbsences.length
            };
        });

        res.status(200).json({
            status: 'success',
            data: {
                department,
                period: month ? `${year}-${month}` : year.toString(),
                employees: employees.length,
                calendar,
                absences
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    generateEmployeeAbsenceReport,
    generateDepartmentCalendar
};