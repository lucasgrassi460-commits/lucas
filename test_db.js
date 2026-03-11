const db = require('./backend/database');

setTimeout(() => {
    console.log('Checking bots table info...');
    db.all('PRAGMA table_info(bots)', (err, rows) => {
        if (err) {
            console.error('Error:', err);
        } else {
            console.log('Columns:', rows.map(r => r.name));
        }
    });
}, 2000);
