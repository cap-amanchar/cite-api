/**
 * Application configuration settings
 */
require('dotenv').config();

module.exports = {
    // Server settings
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production',
        jwtExpiration: process.env.JWT_EXPIRATION || '8h'
    },

    // Database settings
    database: {
        path: process.env.DB_PATH || './data/absence_management.db'
    },

    // Logging settings
    logging: {
        level: process.env.LOG_LEVEL || 'debug'
    },

    // Pagination defaults
    pagination: {
        defaultLimit: 25,
        maxLimit: 100
    }
};