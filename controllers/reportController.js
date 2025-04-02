const { db } = require('../config/database');
const { ValidationError } = require('../middlewares/errorMiddleware');

/**
 * Generate team absence summary report
 */
const generateTeamAbsenceSummary = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            startDate,
            endDate,
            departmentId,
            groupBy = 'month' // month, week, type
        } = req.query;

        // Validate date range
        if (!startDate || !endDate) {
            throw new ValidationError('Start date and end date are required');
        }

        // Build query based on user role
        let query = `
      SELECT 
        a.full_name as employee_name,
        d.name as department_name,
        ar.type,
        ar.start_date,
        ar.end_date,
        JULIANDAY(ar.end_date) - JULIANDAY(ar.start_date) + 1 as days_count,
        strftime('%Y-%m', ar.start_date) as month,
        strftime('%Y-W%W', ar.start_date) as week,
    `;

        // Add group by clause
        if (groupBy === 'month') {
            query += `
        strftime('%Y-%m', ar.start_date) as group_key,
        'month' as group_type
      `;
        } else if (groupBy === 'week') {
            query += `
        strftime('%Y-W%W', ar.start_date) as group_key,
        'week' as group_type
      `;
        } else if (groupBy === 'type') {
            query += `
        ar.type as group_key,
        'type' as group_type
      `;
        } else {
            throw new ValidationError('Invalid groupBy parameter');
        }

        query += `
      FROM absence_requests ar
      JOIN employees e ON ar.employee_id = e.id
      JOIN accounts a ON e.account_id = a.id
      JOIN departments d ON e.department_id = d.id
      WHERE ar.status = 'approved'
      AND ar.start_date >= ?
      AND ar.end_date <= ?
    `;

        const params = [startDate, endDate];

        // Filter by role
        if (req.user.role === 'manager') {
            query += ` AND e.manager_id = ?`;
            params.push(userId);
        } else if (req.user.role === 'admin' && departmentId) {
            query += ` AND e.department_id = ?`;
            params.push(departmentId);
        }

        query += ` ORDER BY ar.start_date ASC`;

        // Get absence data
        const absences = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });

        // Process data for summary statistics
        const summary = {
            totalAbsenceDays: 0,
            totalAbsences: absences.length,
            byType: {
                vacation: { count: 0, days: 0 },
                sick: { count: 0, days: 0 },
                personal: { count: 0, days: 0 }
            },
            byEmployee: {},
            byDepartment: {},
            byPeriod: {}
        };

        absences.forEach(absence => {
            const days = absence.days_count;
            summary.totalAbsenceDays += days;

            // By type
            if (summary.byType[absence.type]) {
                summary.byType[absence.type].count += 1;
                summary.byType[absence.type].days += days;
            }

            // By employee
            if (!summary.byEmployee[absence.employee_name]) {
                summary.byEmployee[absence.employee_name] = { count: 0, days: 0 };
            }
            summary.byEmployee[absence.employee_name].count += 1;
            summary.byEmployee[absence.employee_name].days += days;

            // By department
            if (!summary.byDepartment[absence.department_name]) {
                summary.byDepartment[absence.department_name] = { count: 0, days: 0 };
            }
            summary.byDepartment[absence.department_name].count += 1;
            summary.byDepartment[absence.department_name].days += days;

            // By period (month, week, or type)
            if (!summary.byPeriod[absence.group_key]) {
                summary.byPeriod[absence.group_key] = { count: 0, days: 0 };
            }
            summary.byPeriod[absence.group_key].count += 1;
            summary.byPeriod[absence.group_key].days += days;
        });

        res.status(200).json({
            status: 'success',
            data: {
                parameters: {
                    startDate,
                    endDate,
                    departmentId: departmentId || 'all',
                    groupBy
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
 * Generate absence trends report
 */
const generateAbsenceTrends = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            startDate,
            endDate,
            departmentId,
            interval = 'month' // month, quarter, year
        } = req.query;

        // Validate date range
        if (!startDate || !endDate) {
            throw new ValidationError('Start date and end date are required');
        }

        // Define interval format
        let intervalFormat;
        if (interval === 'month') {
            intervalFormat = `strftime('%Y-%m', ar.start_date)`;
        } else if (interval === 'quarter') {
            intervalFormat = `strftime('%Y-Q') || ((CAST(strftime('%m', ar.start_date) AS INTEGER) - 1) / 3 + 1)`;
        } else if (interval === 'year') {
            intervalFormat = `strftime('%Y', ar.start_date)`;
        } else {
            throw new ValidationError('Invalid interval parameter');
        }

        // Build query
        let query = `
      SELECT 
        ${intervalFormat} as period,
        ar.type,
        COUNT(ar.id) as absence_count,
        SUM(JULIANDAY(ar.end_date) - JULIANDAY(ar.start_date) + 1) as days_count
      FROM absence_requests ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE ar.status = 'approved'
      AND ar.start_date >= ?
      AND ar.end_date <= ?
    `;

        const params = [startDate, endDate];

        // Filter by role
        if (req.user.role === 'manager') {
            query += ` AND e.manager_id = ?`;
            params.push(userId);
        } else if (req.user.role === 'admin' && departmentId) {
            query += ` AND e.department_id = ?`;
            params.push(departmentId);
        }

        query += `
      GROUP BY period, ar.type
      ORDER BY period ASC, ar.type
    `;

        // Get trend data
        const trends = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });

        // Process data for visualization
        const periods = [...new Set(trends.map(t => t.period))];
        const types = [...new Set(trends.map(t => t.type))];

        const formattedTrends = periods.map(period => {
            const periodData = { period };

            types.forEach(type => {
                const trend = trends.find(t => t.period === period && t.type === type);
                periodData[`${type}_count`] = trend ? trend.absence_count : 0;
                periodData[`${type}_days`] = trend ? trend.days_count : 0;
            });

            return periodData;
        });

        // Calculate totals
        const totals = {
            absenceCount: trends.reduce((sum, t) => sum + t.absence_count, 0),
            dayCount: trends.reduce((sum, t) => sum + t.days_count, 0)
        };

        // Calculate averages
        const averages = {
            byType: {}
        };

        types.forEach(type => {
            const typeTrends = trends.filter(t => t.type === type);
            averages.byType[type] = {
                averagePerPeriod: typeTrends.length > 0
                    ? (typeTrends.reduce((sum, t) => sum + t.absence_count, 0) / periods.length).toFixed(2)
                    : 0,
                averageDaysPerPeriod: typeTrends.length > 0
                    ? (typeTrends.reduce((sum, t) => sum + t.days_count, 0) / periods.length).toFixed(2)
                    : 0
            };
        });

        res.status(200).json({
            status: 'success',
            data: {
                parameters: {
                    startDate,
                    endDate,
                    departmentId: departmentId || 'all',
                    interval
                },
                periods,
                types,
                trends: formattedTrends,
                totals,
                averages
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    generateTeamAbsenceSummary,
    generateAbsenceTrends
};