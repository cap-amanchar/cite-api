/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack);

    // Handle database errors
    if (err.code && err.code.startsWith('SQLITE_')) {
        return res.status(500).json({
            status: 'error',
            message: 'Database error occurred',
            error: process.env.NODE_ENV === 'production' ? 'Internal database error' : err.message
        });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Validation error',
            errors: err.errors
        });
    }

    // Handle authentication errors
    if (err.name === 'AuthenticationError') {
        return res.status(401).json({
            status: 'error',
            message: err.message || 'Authentication failed'
        });
    }

    // Handle authorization errors
    if (err.name === 'AuthorizationError') {
        return res.status(403).json({
            status: 'error',
            message: err.message || 'You do not have permission to perform this action'
        });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        status: 'error',
        message: err.message || 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.stack
    });
};

// Custom error classes
class ValidationError extends Error {
    constructor(message, errors = {}) {
        super(message);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthorizationError';
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

class BusinessLogicError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'BusinessLogicError';
        this.statusCode = statusCode;
    }
}

module.exports = {
    errorHandler,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    BusinessLogicError
};