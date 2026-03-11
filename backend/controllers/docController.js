const db = require('../database');
const fs = require('fs');
const path = require('path');
const PLAN_LIMITS = require('../config/limits');

exports.uploadDocument = (req, res) => {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { originalname, filename, mimetype } = req.file;

    db.get('SELECT plan FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        const plan = user ? user.plan : 'none';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['none'];

        db.get('SELECT COUNT(*) as count FROM documents WHERE user_id = ?', [userId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row.count >= limits.documents) {
                // Delete uploaded file if limit reached
                const filePath = path.join(__dirname, '../../uploads', filename);
                try { fs.unlinkSync(filePath); } catch(e) {}
                return res.status(403).json({ error: `Plan limit reached. Your plan (${plan.replace(/_/g, ' ')}) allows ${limits.documents} document(s). Upgrade to add more.` });
            }

            db.run(`INSERT INTO documents (filename, original_name, type, user_id) VALUES (?, ?, ?, ?)`,
                [filename, originalname, mimetype, userId], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, filename, originalname });
                });
        });
    });
};

exports.getDocuments = (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM documents WHERE user_id = ?', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
};

exports.deleteDocument = (req, res) => {
    const { id } = req.params;
    db.get('SELECT filename FROM documents WHERE id = ?', [id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: 'Document not found' });

        // delete file
        const filePath = path.join(__dirname, '../../uploads', doc.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        db.run('DELETE FROM bot_documents WHERE document_id = ?', [id], (err) => {
            db.run('DELETE FROM documents WHERE id = ?', [id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        });
    });
};
