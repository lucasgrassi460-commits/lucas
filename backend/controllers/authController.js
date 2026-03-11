const db = require('../database');
const crypto = require('crypto');

// Simple hash for demo purposes. In production use bcrypt.
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

exports.register = (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const hashedPassword = hashPassword(password);
    
    db.run(`INSERT INTO users (name, email, password, plan) VALUES (?, ?, ?, ?)`, [name || '', email, hashedPassword, 'free_trial'], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, userId: this.lastID });
    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const hashedPassword = hashPassword(password);

    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, hashedPassword], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Simple token (just user ID for now)
        res.json({ success: true, token: user.id, user: { id: user.id, email: user.email, plan: user.plan } });
    });
};