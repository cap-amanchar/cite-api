const { ValidationError } = require('./errorMiddleware');

/**
 * Validate request data against a schema
 * @param {Object} schema - Validation schema object
 * @param {string} location - Request location to validate (body, params, query)
 */
const validate = (schema, location = 'body') => {
    return (req, res, next) => {
        try {
            const data = req[location];

            // Validate required fields
            if (schema.required && schema.required.length > 0) {
                for (const field of schema.required) {
                    if (data[field] === undefined) {
                        throw new ValidationError(`"${field}" is required`);
                    }
                }
            }

            // Validate field types and formats
            if (schema.properties) {
                for (const [field, config] of Object.entries(schema.properties)) {
                    if (data[field] !== undefined) {
                        // Type validation
                        if (config.type && !validateType(data[field], config.type)) {
                            throw new ValidationError(`"${field}" must be a ${config.type}`);
                        }

                        // Format validation
                        if (config.format && !validateFormat(data[field], config.format)) {
                            throw new ValidationError(`"${field}" must match format "${config.format}"`);
                        }

                        // Min/max validation for numbers
                        if (config.type === 'number' || config.type === 'integer') {
                            if (config.minimum !== undefined && data[field] < config.minimum) {
                                throw new ValidationError(`"${field}" must be >= ${config.minimum}`);
                            }

                            if (config.maximum !== undefined && data[field] > config.maximum) {
                                throw new ValidationError(`"${field}" must be <= ${config.maximum}`);
                            }
                        }

                        // Min/max length validation for strings
                        if (config.type === 'string') {
                            if (config.minLength !== undefined && data[field].length < config.minLength) {
                                throw new ValidationError(`"${field}" must be at least ${config.minLength} characters`);
                            }

                            if (config.maxLength !== undefined && data[field].length > config.maxLength) {
                                throw new ValidationError(`"${field}" must be at most ${config.maxLength} characters`);
                            }
                        }

                        // Enum validation
                        if (config.enum && !config.enum.includes(data[field])) {
                            throw new ValidationError(`"${field}" must be one of: ${config.enum.join(', ')}`);
                        }
                    }
                }
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Validate value type
 */
const validateType = (value, type) => {
    switch (type) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' && !isNaN(value);
        case 'integer':
            return Number.isInteger(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'array':
            return Array.isArray(value);
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        default:
            return true;
    }
};

/**
 * Validate value format
 */
const validateFormat = (value, format) => {
    switch (format) {
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        case 'date':
            return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
        case 'date-time':
            return !isNaN(Date.parse(value));
        case 'password':
            // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/.test(value);
        case 'phone':
            return /^\+?[\d\s-()]{8,}$/.test(value);
        default:
            return true;
    }
};

module.exports = {
    validate
};