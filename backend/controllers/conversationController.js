const db = require('../database');

exports.getConversations = (req, res) => {
    // Get list of unique phone numbers with last message
    db.all(`SELECT c.phone, c.last_message_at, 
            (SELECT text FROM conversation_history WHERE phone = c.phone ORDER BY created_at DESC LIMIT 1) as last_message
            FROM conversations c 
            ORDER BY c.last_message_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

exports.getMessages = (req, res) => {
    const { phone } = req.params;
    db.all(`SELECT * FROM conversation_history WHERE phone = ? ORDER BY created_at ASC`, [phone], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};