const app = require('./app');
const config = require('./config/config');
const { initializeDatabase } = require('./config/database');

const PORT = config.server.port;

// Initialize database before starting the server
initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });