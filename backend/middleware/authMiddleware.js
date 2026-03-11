const db = require('../database');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Check for Bearer format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Token format error. Use Bearer <token>' });
    }

    const token = parts[1];
    
    // In a real production app, verify JWT here.
    // For this prototype, the token is the user ID.
    const userId = parseInt(token);
    
    if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid token.' });
    }

    req.user = { id: userId };
    next();
};

module.exports = { verifyToken };