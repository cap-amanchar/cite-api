// check-departments.js
const { db } = require('./config/database');

db.all('SELECT * FROM departments ORDER BY id', [], (err, rows) => {
    if (err) {
        console.error('Error querying departments:', err);
        return;
    }

    console.log('Departments in database:');
    console.table(rows);

    // Check specifically for departments with IDs 1-5
    const requiredIds = [1, 2, 3, 4, 5];
    const existingIds = rows.map(row => row.id);

    const missingIds = requiredIds.filter(id => !existingIds.includes(id));

    if (missingIds.length > 0) {
        console.log(`Missing department IDs: ${missingIds.join(', ')}`);
    } else {
        console.log('All required department IDs (1-5) exist!');
    }
});