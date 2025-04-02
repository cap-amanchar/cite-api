const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const config = require('../config/config');
const { AuthenticationError, AuthorizationError } = require('./errorMiddleware');

/**
 * Middleware to authenticate users via JWT token
 */
const authenticate = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('No token provided'));
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, config.server.jwtSecret);
    
    // Add user info to request object
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expired'));
    }
    return next(new AuthenticationError('Invalid token'));
  }
};

/**
 * Middleware to check user roles
 * @param {string[]} roles - Array of allowed roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    // Check if user exists (should be set by authenticate middleware)
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    // Convert single role to array
    if (typeof roles === 'string') {
      roles = [roles];
    }

    // Check if user role is in the allowed roles
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AuthorizationError('Unauthorized access: insufficient privileges'));
    }

    next();
  };
};

/**
 * Middleware to check if user is accessing their own resources
 * Used for endpoints where users should only access their own data
 */
const checkResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const resourceId = req.params.id;
      
      // Skip for admins (they can access any resource)
      if (req.user.role === 'admin') {
        return next();
      }
      
      let authorized = false;
      
      switch (resourceType) {
        case 'absence_request':
          // Check if request belongs to user or if user is the manager for this request
          await new Promise((resolve, reject) => {
            db.get(
              `SELECT ar.id FROM absence_requests ar
               LEFT JOIN employees e ON ar.employee_id = e.id
               WHERE (ar.id = ? AND e.account_id = ?) OR 
                     (ar.id = ? AND EXISTS (
                        SELECT 1 FROM employees WHERE manager_id = ? AND id = ar.employee_id
                     ))`,
              [resourceId, userId, resourceId, userId],
              (err, row) => {
                if (err) return reject(err);
                authorized = !!row;
                resolve();
              }
            );
          });
          break;
          
        case 'employee':
          // For employee resources, check if the requested employee ID is the user's own or a subordinate
          await new Promise((resolve, reject) => {
            db.get(
              `SELECT id FROM employees WHERE 
               (id = ? AND account_id = ?) OR  
               (id = ? AND manager_id = ?)`,
              [resourceId, userId, resourceId, userId],
              (err, row) => {
                if (err) return reject(err);
                authorized = !!row;
                resolve();
              }
            );
          });
          break;
          
        // Add more resource types as needed
        default:
          return next(new Error(`Resource type "${resourceType}" not supported`));
      }
      
      if (!authorized) {
        return next(new AuthorizationError('You do not have access to this resource'));
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  checkResourceOwnership
};
