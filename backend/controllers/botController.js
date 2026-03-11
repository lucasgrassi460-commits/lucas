const db = require('../database');
const PLAN_LIMITS = require('../config/limits');

exports.getBots = (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM bots WHERE user_id = ?', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

exports.getBot = (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    db.get('SELECT * FROM bots WHERE id = ? AND user_id = ?', [id, userId], (err, bot) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!bot) return res.status(404).json({ error: 'Bot not found' });

        db.all('SELECT * FROM bot_qa WHERE bot_id = ?', [id], (err, qas) => {
            bot.qas = qas || [];
            db.all(`
                SELECT d.* FROM documents d
                JOIN bot_documents bd ON d.id = bd.document_id
                WHERE bd.bot_id = ?
            `, [id], (err, docs) => {
                bot.documents = docs || [];
                res.json(bot);
            });
        });
    });
};

exports.createBot = (req, res) => {
    const userId = req.user.id;
    const { name, id_name, description, human_takeover, split_messages, instructions, document_ids, device_id, save_payments } = req.body;
    const active = req.body.active !== undefined ? req.body.active : 1;

    db.get('SELECT plan FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        const plan = user ? user.plan : 'none';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['none'];

        db.get('SELECT COUNT(*) as count FROM bots WHERE user_id = ?', [userId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row.count >= limits.bots) {
                return res.status(403).json({ error: `Plan limit reached. Your plan (${plan.replace(/_/g, ' ')}) allows ${limits.bots} bot(s). Upgrade to add more.` });
            }

            db.run(`INSERT INTO bots (name, id_name, description, human_takeover, split_messages, instructions, active, device_id, save_payments, user_id) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, id_name, description, human_takeover ? 1 : 0, split_messages ? 1 : 0, instructions || '', active, device_id, save_payments ? 1 : 0, userId], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const botId = this.lastID;
                    if (document_ids && document_ids.length > 0) {
                        const stmt = db.prepare('INSERT INTO bot_documents (bot_id, document_id) VALUES (?, ?)');
                        document_ids.forEach(docId => stmt.run([botId, docId]));
                        stmt.finalize();
                    }
                    res.json({ id: botId });
                });
        });
    });
};

exports.updateBot = (req, res) => {
    const { id } = req.params;
    const { name, id_name, description, human_takeover, split_messages, instructions, active, document_ids, device_id, save_payments } = req.body;

    db.run(`UPDATE bots SET name=?, id_name=?, description=?, human_takeover=?, split_messages=?, instructions=?, active=?, device_id=?, save_payments=? WHERE id=?`,
        [name, id_name, description, human_takeover ? 1 : 0, split_messages ? 1 : 0, instructions, active !== undefined ? active : 1, device_id, save_payments ? 1 : 0, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.run('DELETE FROM bot_documents WHERE bot_id = ?', [id], (err) => {
                if (document_ids && document_ids.length > 0) {
                    const stmt = db.prepare('INSERT INTO bot_documents (bot_id, document_id) VALUES (?, ?)');
                    document_ids.forEach(docId => stmt.run([id, docId]));
                    stmt.finalize();
                }
                res.json({ success: true });
            });
        });
};

exports.deleteBot = (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM bot_qa WHERE bot_id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM bot_documents WHERE bot_id = ?`, [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`DELETE FROM bots WHERE id = ?`, [id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        });
    });
};

exports.addBotQA = (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { question, answer } = req.body;

    db.get('SELECT plan FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        const plan = user ? user.plan : 'none';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['none'];

        db.get('SELECT COUNT(*) as count FROM bot_qa WHERE bot_id = ?', [id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row.count >= limits.questions) {
                return res.status(403).json({ error: `Plan limit reached. Your plan (${plan.replace(/_/g, ' ')}) allows ${limits.questions} Q&A pairs per bot. Upgrade to add more.` });
            }

            db.run(`INSERT INTO bot_qa (bot_id, question, answer) VALUES (?, ?, ?)`, [id, question, answer], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID });
            });
        });
    });
};

exports.deleteBotQA = (req, res) => {
    const { id, qaId } = req.params;
    db.run(`DELETE FROM bot_qa WHERE id = ? AND bot_id = ?`, [qaId, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
};
