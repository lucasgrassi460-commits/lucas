const db = require('../database');

exports.getMetrics = (req, res) => {
    db.get('SELECT * FROM metrics ORDER BY id DESC LIMIT 1', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || { conversations: 0, messages_received: 0, messages_sent: 0 });
    });
};
