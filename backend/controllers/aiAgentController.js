const db = require('../database');
const PLAN_LIMITS = require('../config/limits');

exports.listAgents = (req, res) => {
    const userId = req.user.id;
    db.all(`SELECT * FROM ai_agents WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const promises = rows.map(agent => new Promise((resolve) => {
             db.all(`SELECT d.* FROM documents d JOIN ai_agent_documents ad ON d.id = ad.document_id WHERE ad.agent_id = ?`, [agent.id], (err, docs) => {
                 agent.documents = docs || [];
                 resolve(agent);
             });
        }));

        Promise.all(promises).then(agents => res.json(agents));
    });
};

exports.getAgent = (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    db.get(`SELECT * FROM ai_agents WHERE id = ? AND user_id = ?`, [id, userId], (err, agent) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        db.all(`SELECT d.* FROM documents d JOIN ai_agent_documents ad ON d.id = ad.document_id WHERE ad.agent_id = ?`, [id], (err, docs) => {
            agent.documents = docs || [];
            res.json(agent);
        });
    });
};

exports.createAgent = (req, res) => {
    const userId = req.user.id;
    const { name, instructions, device_id, ai_provider, document_ids } = req.body;

    db.get('SELECT plan FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        const plan = user ? user.plan : 'none';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['none'];

        db.get('SELECT COUNT(*) as count FROM ai_agents WHERE user_id = ?', [userId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row.count >= limits.bots) {
                return res.status(403).json({ error: `Plan limit reached. Your plan (${plan}) allows ${limits.bots} AI Agent(s). Upgrade to add more.` });
            }

            db.run(`INSERT INTO ai_agents (name, instructions, device_id, ai_provider, user_id) VALUES (?, ?, ?, ?, ?)`, 
                [name, instructions, device_id, ai_provider || 'gemini', userId], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    const agentId = this.lastID;
                    
                    if (document_ids && document_ids.length > 0) {
                        const stmt = db.prepare('INSERT INTO ai_agent_documents (agent_id, document_id) VALUES (?, ?)');
                        document_ids.forEach(docId => stmt.run([agentId, docId]));
                        stmt.finalize();
                    }
                    res.json({ id: agentId });
            });
        });
    });
};

exports.updateAgent = (req, res) => {
    const { id } = req.params;
    const { name, instructions, device_id, ai_provider, document_ids } = req.body;
    
    db.run(`UPDATE ai_agents SET name = ?, instructions = ?, device_id = ?, ai_provider = ? WHERE id = ?`, 
        [name, instructions, device_id, ai_provider || 'gemini', id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            db.run(`DELETE FROM ai_agent_documents WHERE agent_id = ?`, [id], (err) => {
                if (document_ids && document_ids.length > 0) {
                    const stmt = db.prepare('INSERT INTO ai_agent_documents (agent_id, document_id) VALUES (?, ?)');
                    document_ids.forEach(docId => stmt.run([id, docId]));
                    stmt.finalize();
                }
                res.json({ success: true });
            });
    });
};

exports.deleteAgent = (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM ai_agent_documents WHERE agent_id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM ai_agents WHERE id = ?`, [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
};
