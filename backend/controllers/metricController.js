const db = require('../database');

exports.getMetrics = (req, res) => {
    const sqlTotal = `SELECT COUNT(*) as count FROM conversations`;
    
    const sqlLastRoles = `
        SELECT t1.role 
        FROM conversation_history t1 
        JOIN (
            SELECT phone, MAX(id) as max_id 
            FROM conversation_history 
            GROUP BY phone
        ) t2 ON t1.id = t2.max_id
    `;
    
    const sqlActivity = `
        SELECT date(created_at) as date, count(distinct phone) as count 
        FROM conversation_history 
        WHERE created_at >= date('now', '-30 days') 
        GROUP BY date(created_at) 
        ORDER BY date(created_at)
    `;

    db.get(sqlTotal, (err, totalRow) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(sqlLastRoles, (err, roleRows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            let answered = 0;
            let unanswered = 0;
            if (roleRows) {
                roleRows.forEach(r => {
                    if (r.role === 'user') unanswered++;
                    else answered++;
                });
            }
            
            db.all(sqlActivity, (err, activityRows) => {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({
                    totalConversations: totalRow ? totalRow.count : 0,
                    answeredConversations: answered,
                    unansweredConversations: unanswered,
                    dailyActivity: activityRows || []
                });
            });
        });
    });
};
