const db = require('../database');
const fs = require('fs');
const path = require('path');

exports.uploadDocument = (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { originalname, filename, mimetype } = req.file;

    db.run(`INSERT INTO documents (filename, original_name, type) VALUES (?, ?, ?)`,
        [filename, originalname, mimetype], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, filename, originalname });
        });
};

exports.getDocuments = (req, res) => {
    db.all('SELECT * FROM documents', [], (err, rows) => {
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
