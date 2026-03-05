const db = require('../database');

exports.getBots = (req, res) => {
    db.all('SELECT * FROM bots', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

exports.getBot = (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM bots WHERE id = ?', [id], (err, bot) => {
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
    const { name, id_name, description, human_takeover, split_messages, instructions, document_ids } = req.body;
    const active = req.body.active !== undefined ? req.body.active : 1;
    db.run(`INSERT INTO bots (name, id_name, description, human_takeover, split_messages, instructions, active) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, id_name, description, human_takeover ? 1 : 0, split_messages ? 1 : 0, instructions || '', active], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const botId = this.lastID;
            if (document_ids && document_ids.length > 0) {
                const stmt = db.prepare('INSERT INTO bot_documents (bot_id, document_id) VALUES (?, ?)');
                document_ids.forEach(docId => stmt.run([botId, docId]));
                stmt.finalize();
            }
            res.json({ id: botId });
        });
};

exports.updateBot = (req, res) => {
    const { id } = req.params;
    const { name, id_name, description, human_takeover, split_messages, instructions, active, document_ids } = req.body;

    db.run(`UPDATE bots SET name=?, id_name=?, description=?, human_takeover=?, split_messages=?, instructions=?, active=? WHERE id=?`,
        [name, id_name, description, human_takeover ? 1 : 0, split_messages ? 1 : 0, instructions, active !== undefined ? active : 1, id], function (err) {
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
    db.run(`DELETE FROM bots WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
};

exports.addBotQA = (req, res) => {
    const { id } = req.params;
    const { question, answer } = req.body;
    db.run(`INSERT INTO bot_qa (bot_id, question, answer) VALUES (?, ?, ?)`, [id, question, answer], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
};

exports.deleteBotQA = (req, res) => {
    const { id, qaId } = req.params;
    db.run(`DELETE FROM bot_qa WHERE id = ? AND bot_id = ?`, [qaId, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
};
