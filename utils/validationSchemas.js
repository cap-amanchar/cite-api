/**
 * Validation schemas for API requests
 */

// Auth schemas
const authSchemas = {
    login: {
        required: ['username', 'password'],
        properties: {
            username: { type: 'string', minLength: 3 },
            password: { type: 'string', minLength: 6 }
        }
    },
    register: {
        required: ['username', 'password', 'fullName', 'email', 'departmentId'],
        properties: {
            username: { type: 'string', minLength: 3 },
            password: { type: 'string', minLength: 8, format: 'password' },
            fullName: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            departmentId: { type: 'integer', minimum: 1 }
        }
    }
};

// User schemas
const userSchemas = {
    updateProfile: {
        properties: {
            fullName: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8, format: 'password' }
        }
    },
    createUser: {
        required: ['username', 'password', 'fullName', 'email', 'role'],
        properties: {
            username: { type: 'string', minLength: 3 },
            password: { type: 'string', minLength: 8, format: 'password' },
            fullName: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'manager', 'employee'] },
            departmentId: { type: 'integer', minimum: 1 },
            position: { type: 'string' },
            managerId: { type: 'integer', minimum: 1 },
            accessLevel: { type: 'integer', minimum: 1, maximum: 3 }
        }
    },
    updateUser: {
        properties: {
            fullName: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            password: { type: 'string', minLength: 8 },
            status: { type: 'string', enum: ['active', 'inactive'] },
            departmentId: { type: 'integer', minimum: 1 },
            position: { type: 'string' },
            managerId: { type: 'integer', minimum: 1 },
            accessLevel: { type: 'integer', minimum: 1, maximum: 3 }
        }
    }
};

// Department schemas
const departmentSchemas = {
    createDepartment: {
        required: ['name'],
        properties: {
            name: { type: 'string', minLength: 2 },
            managerId: { type: 'integer', minimum: 1 },
            location: { type: 'string' }
        }
    },
    updateDepartment: {
        properties: {
            name: { type: 'string', minLength: 2 },
            managerId: { type: 'integer', minimum: 1 },
            location: { type: 'string' }
        }
    },
    updatePolicy: {
        properties: {
            minDaysNotice: { type: 'integer', minimum: 0 },
            maxConsecutiveDays: { type: 'integer', minimum: 1 },
            approvalRequired: { type: 'boolean' },
            documentationRequiredAfter: { type: 'integer', minimum: 1 },
            maxSickDays: { type: 'integer', minimum: 0 },
            maxVacationDays: { type: 'integer', minimum: 0 },
            maxPersonalDays: { type: 'integer', minimum: 0 }
        }
    }
};

// Absence schemas
const absenceSchemas = {
    createAbsence: {
        required: ['startDate', 'endDate', 'type'],
        properties: {
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            type: { type: 'string', enum: ['vacation', 'sick', 'personal'] },
            hasDocumentation: { type: 'boolean' },
            comments: { type: 'string' }
        }
    },
    updateAbsence: {
        properties: {
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            type: { type: 'string', enum: ['vacation', 'sick', 'personal'] },
            hasDocumentation: { type: 'boolean' },
            comments: { type: 'string' }
        }
    },
    processAbsence: {
        required: ['action'],
        properties: {
            action: { type: 'string', enum: ['approve', 'reject'] },
            comments: { type: 'string' }
        }
    }
};

// Leave balance schemas
const leaveBalanceSchemas = {
    updateLeaveBalance: {
        properties: {
            year: { type: 'integer', minimum: 2000, maximum: 2100 },
            vacationDays: { type: 'number', minimum: 0 },
            sickDays: { type: 'number', minimum: 0 },
            personalDays: { type: 'number', minimum: 0 }
        }
    }
};

// Report schemas
const reportSchemas = {
    teamSummary: {
        required: ['startDate', 'endDate'],
        properties: {
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            departmentId: { type: 'integer', minimum: 1 },
            groupBy: { type: 'string', enum: ['month', 'week', 'type'] }
        }
    },
    trends: {
        required: ['startDate', 'endDate'],
        properties: {
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            departmentId: { type: 'integer', minimum: 1 },
            interval: { type: 'string', enum: ['month', 'quarter', 'year'] }
        }
    }
};

module.exports = {
    authSchemas,
    userSchemas,
    departmentSchemas,
    absenceSchemas,
    leaveBalanceSchemas,
    reportSchemas
};