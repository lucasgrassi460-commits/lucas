const sessionManager = require('../whatsapp/sessionManager');
const db = require('../database');
const PLAN_LIMITS = require('../config/limits');

exports.createSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionName } = req.body;

        // Check limits
        db.get('SELECT plan FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const plan = user ? user.plan : 'none';
            const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['none'];
            const currentSessions = sessionManager.getSessionsByUserId(userId);

            if (currentSessions.length >= limits.devices) {
                return res.status(403).json({ error: `Plan limit reached. Your plan (${plan.replace(/_/g, ' ')}) allows ${limits.devices} device(s). Upgrade to add more.` });
            }

            const sessionId = await sessionManager.createSession(sessionName, userId);
            const qr = await sessionManager.waitForQR(sessionId, 10000);
            res.json({ sessionId, qr });
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create session' });
    }
};

exports.updateSession = (req, res) => {
    const { id } = req.params;
    const { sessionName } = req.body;
    const success = sessionManager.updateSessionName(id, sessionName);
    res.json({ success });
};

exports.listSessions = (req, res) => {
    const userId = req.user.id;
    res.json(sessionManager.getSessionsByUserId(userId));
};

exports.getSessionStatus = (req, res) => {
    const { id } = req.params;
    res.json(sessionManager.getSessionStatus(id));
};

exports.disconnectSession = async (req, res) => {
    const { id } = req.params;
    const ok = await sessionManager.disconnectSession(id);
    res.json({ success: ok });
};

exports.getStatus = (req, res) => {
    res.json({ status: 'MULTI_SESSION_ENABLED' });
};

exports.reconnect = (req, res) => {
    res.json({ success: true });
};
