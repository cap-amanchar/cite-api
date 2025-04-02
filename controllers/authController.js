const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const config = require('../config/config');
const { ValidationError, AuthenticationError } = require('../middlewares/errorMiddleware');

/**
 * User login
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }
    
    // Find user by username
    const user = await new Promise((resolve, reject) => {
      db.get(
        `SELECT a.id, a.username, a.password, a.full_name, a.email, a.role 
         FROM accounts a 
         WHERE a.username = ?`,
        [username],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
    
    if (!user) {
      throw new AuthenticationError('Invalid username or password');
    }
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new AuthenticationError('Invalid username or password');
    }
    
    // Update last login time
    db.run(
      `UPDATE accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
      [user.id]
    );
    
    // Get user-specific data based on role
    let roleData = {};
    
    if (user.role === 'employee') {
      const employee = await new Promise((resolve, reject) => {
        db.get(
          `SELECT e.id as employee_id, e.department_id, e.position, e.manager_id, d.name as department_name
           FROM employees e
           JOIN departments d ON e.department_id = d.id
           WHERE e.account_id = ?`,
          [user.id],
          (err, row) => {
            if (err) return reject(err);
            resolve(row || {});
          }
        );
      });
      roleData = employee;
    } else if (user.role === 'manager') {
      const manager = await new Promise((resolve, reject) => {
        db.get(
          `SELECT m.id as manager_id, m.department_id, m.team_size, m.approval_level, d.name as department_name
           FROM managers m
           JOIN departments d ON m.department_id = d.id
           WHERE m.account_id = ?`,
          [user.id],
          (err, row) => {
            if (err) return reject(err);
            resolve(row || {});
          }
        );
      });
      roleData = manager;
    } else if (user.role === 'admin') {
      const admin = await new Promise((resolve, reject) => {
        db.get(
          `SELECT a.id as admin_id, a.access_level, a.can_modify_policies, a.can_manage_users
           FROM administrators a
           WHERE a.account_id = ?`,
          [user.id],
          (err, row) => {
            if (err) return reject(err);
            resolve(row || {});
          }
        );
      });
      roleData = admin;
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        ...roleData
      },
      config.server.jwtSecret,
      { expiresIn: config.server.jwtExpiration }
    );
    
    // Return user data and token
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          ...roleData
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register new user (employee only - admins and managers are created through admin panel)
 */
const register = async (req, res, next) => {
  try {
    const { username, password, fullName, email, phone, departmentId } = req.body;
    
    // Validate input
    if (!username || !password || !fullName || !email || !departmentId) {
      throw new ValidationError('All fields are required');
    }
    
    // Check if username or email already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM accounts WHERE username = ? OR email = ?`,
        [username, email],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
    
    if (existingUser) {
      throw new ValidationError('Username or email already in use');
    }
    
    // Check if department exists
    const department = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, manager_id FROM departments WHERE id = ?`,
        [departmentId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
    
    if (!department) {
      throw new ValidationError('Department does not exist');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user transaction
    const result = await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Insert account
        db.run(
          `INSERT INTO accounts (username, password, full_name, email, phone, role) 
           VALUES (?, ?, ?, ?, ?, 'employee')`,
          [username, hashedPassword, fullName, email, phone],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }
            
            const accountId = this.lastID;
            
            // Insert employee
            db.run(
              `INSERT INTO employees (account_id, department_id, manager_id, status) 
               VALUES (?, ?, ?, 'active')`,
              [accountId, departmentId, department.manager_id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
                
                const employeeId = this.lastID;
                
                // Create initial leave balance
                const currentYear = new Date().getFullYear();
                db.run(
                  `INSERT INTO leave_balances (employee_id, year, vacation_days, sick_days, personal_days)
                   VALUES (?, ?, 0, 0, 0)`,
                  [employeeId, currentYear],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }
                    
                    // Increment department employee count
                    db.run(
                      `UPDATE departments SET employee_count = employee_count + 1 WHERE id = ?`,
                      [departmentId],
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
                          resolve({ accountId, employeeId });
                        });
                      }
                    );
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
      message: 'Registration successful',
      data: {
        accountId: result.accountId,
        employeeId: result.employeeId
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register
};
