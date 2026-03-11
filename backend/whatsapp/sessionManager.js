const wppconnect = require('@wppconnect-team/wppconnect');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const sessions = new Map();

function genSessionId() {
    return 'session-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now();
}

async function createSession(customSessionName, userId) {
    const sessionId = genSessionId();
    const state = { client: null, qr: null, status: 'INITIALIZING', number: null, connectedAt: null, lastActive: null, sessionName: customSessionName || sessionId, createdAt: new Date().toISOString(), userId: userId || null };
    sessions.set(sessionId, state);
    let client;
    try {
        const sessionPath = path.join(__dirname, '../../sessions', sessionId);
        try { fs.mkdirSync(sessionPath, { recursive: true }); } catch (e) {}
        
        // Save metadata
        try {
            fs.writeFileSync(path.join(sessionPath, 'metadata.json'), JSON.stringify({
                sessionName: state.sessionName,
                createdAt: state.createdAt,
                userId: state.userId
            }));
        } catch(e) {}

        // Start WPPConnect asynchronously to avoid blocking the response
        wppconnect.create({
            session: sessionId,
            folderNameToken: path.join(__dirname, '../../sessions'),
            autoClose: 60000,
            puppeteerOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
                userDataDir: sessionPath
            },
            catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
                const s = sessions.get(sessionId);
                if (s) {
                    s.qr = base64Qr;
                    s.status = 'QR_READY';
                    s.qrAttempts = (s.qrAttempts || 0) + 1;
                    if (s.qrAttempts > 5) {
                        s.status = 'QR_EXPIRED';
                        if (s.client) {
                            try { s.client.close(); } catch(e) {}
                        }
                        sessions.delete(sessionId);
                    }
                }
            },
            statusFind: async (statusSession) => {
                const s = sessions.get(sessionId);
                if (!s) return;
                console.log(`[Session: ${sessionId}] Status: ${statusSession}`);
                if (statusSession === 'isLogged' || statusSession === 'inChat' || statusSession === 'qrReadSuccess') {
                    s.status = 'CONNECTED';
                    s.qr = null;
                    try {
                        const info = await client.getHostDevice();
                        s.number = info && (info.id || info.wid || info.me || info.phone) ? (info.id || info.wid || info.me || info.phone) : s.number;
                    } catch (e) {}
                    s.connectedAt = new Date().toISOString();
                } else if (statusSession === 'browserClose' || statusSession === 'qrReadFail' || statusSession === 'autocloseCalled') {
                    s.status = 'DISCONNECTED';
                    if (s.qrAttempts && s.qrAttempts >= 5) {
                        s.status = 'QR_EXPIRED';
                        if (s.client) {
                            try { s.client.close(); } catch(e) {}
                        }
                        sessions.delete(sessionId);
                    }
                } else {
                    s.status = statusSession;
                }
            },
            headless: true,
            useChrome: false,
            debug: false,
            logQR: false,
            disableWelcome: true,
            updatesLog: false,
        })
        .then((client) => {
            const s = sessions.get(sessionId);
            if (s) {
                s.client = client;
                setupClientListeners(client, sessionId);
            }
        })
        .catch((e) => {
            console.error(`[Session: ${sessionId}] Error during creation:`, e);
            const s = sessions.get(sessionId);
            if (s) s.status = 'ERROR';
        });
    } catch (e) {
        state.status = 'ERROR';
    }
    return sessionId;
}

function setupClientListeners(client, sessionId) {
    client.onMessage(async (message) => {
        try {
            if (message.fromMe || message.isGroupMsg || message.from === 'status@broadcast') return;
            const text = message.body ? message.body.toLowerCase() : '';
            const s = sessions.get(sessionId);
            if (s) s.lastActive = new Date().toISOString();
            updateMetrics('received');
            updateConversations(message.from, 'user', text);

            console.log(`[Message] Incoming message received from ${message.from} on device ${sessionId}`);

            // 0. Check for Rule-Based Robots (High Priority)
            db.get(`SELECT * FROM bots WHERE device_id = ? AND active = 1 LIMIT 1`, [sessionId], async (err, robot) => {
                if (robot) {
                    console.log(`[Robot] Active robot found: ${robot.name}`);
                    db.all(`SELECT * FROM bot_qa WHERE bot_id = ?`, [robot.id], async (err, qas) => {
                        if (qas && qas.length > 0) {
                            const match = qas.find(qa => text.includes(qa.question.toLowerCase()));
                            if (match) {
                                console.log(`[Robot] Q&A Match found: "${match.question}"`);
                                await sendBotResponse(client, message.from, match.answer, robot.split_messages);
                                return; // Stop processing, Robot handled it
                            }
                        }
                        
                        // If no Q&A match, or if we want to allow fallthrough:
                        // The prompt implies "refine learning", so maybe it's exclusive?
                        // Usually if a rule matches, we stop. If not, we might fall back to AI.
                        // Let's allow fallthrough to AI if no Q&A matched.
                        checkAIAgents();
                    });
                } else {
                    checkAIAgents();
                }
            });

            function checkAIAgents() {
                // 1. Check for AI Agents first (PRIMARY)
                db.get(`SELECT * FROM ai_agents WHERE device_id = ? LIMIT 1`, [sessionId], async (err, agent) => {
                    if (err) {
                        console.error(`[AI Agent] Database error finding agent:`, err);
                        return;
                    }
                    
                    if (agent) {
                         console.log(`[AI Agent] AI agent found for device ${sessionId}: ${agent.name}`);
                         
                         // AI Agent Logic
                         db.all(`SELECT d.* FROM documents d JOIN ai_agent_documents ad ON d.id = ad.document_id WHERE ad.agent_id = ?`, [agent.id], async (err, docs) => {
                             let docContext = '';
                             if (!err && docs && docs.length > 0) {
                                try {
                                    const { searchInDocuments } = require('./documentReader');
                                    docContext = await searchInDocuments(docs, text);
                                    if (!docContext) {
                                        docContext = docs.map(d => `Document: ${d.original_name}`).join('\n');
                                    }
                                } catch (e) {
                                    console.error(`[AI Agent] Error processing documents:`, e);
                                    docContext = "Error loading document context.";
                                }
                             } else {
                                 docContext = "No documents attached.";
                             }
                             
                             const { generateAIResponse } = require('../services/aiRouter');
                             // Fetch history
                             db.all(`SELECT role, text FROM conversation_history WHERE phone = ? ORDER BY created_at DESC LIMIT 10`, [message.from], async (err, history) => {
                                 const conversationHistory = (history || []).reverse();
                                 const provider = agent.ai_provider || 'gemini';
                                 console.log(`[AI Agent] Sending request to ${provider} for ${message.from}...`);
                                 
                                 try {
                                    const aiAns = await generateAIResponse({
                                        provider,
                                        instructions: agent.instructions || '',
                                        documents: docContext,
                                        history: conversationHistory,
                                        message: text
                                    });
                                    if (aiAns) {
                                        console.log(`[AI Agent] Response received from ${provider}: ${aiAns.substring(0, 50)}...`);
                                        console.log(`[AI Agent] Sending reply to WhatsApp...`);
                                        await sendBotResponse(client, message.from, aiAns, false); 
                                    } else {
                                        console.error(`[AI Agent] Failed to generate response (empty return).`);
                                    }
                                 } catch (aiErr) {
                                     console.error(`[AI Agent] AI Model Error:`, aiErr);
                                     await client.sendText(message.from, "Desculpe, ocorreu um erro ao gerar a resposta.");
                                 }
                             });
                         });
                         return; 
                    } else {
                        console.log(`[AI Agent] No AI agent linked to this device (${sessionId}). Ignoring message.`);
                    }
                });
            }
        } catch (err) {
            try { console.error(`[Message Handler] Error:`, err); } catch (e) {}
        }
    });
}

function listSessions() {
    const out = [];
    for (const [id, s] of sessions.entries()) {
        out.push({
            sessionId: id,
            sessionName: s.sessionName,
            status: s.status,
            number: s.number || null,
            connectedAt: s.connectedAt,
            lastActive: s.lastActive,
            createdAt: s.createdAt
        });
    }
    return out;
}

function getSessionStatus(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return { status: 'NOT_FOUND', qr: null };
    return { status: s.status, qr: s.qr || null };
}

async function disconnectSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return false;
    try {
        if (s.client) {
            await s.client.close();
        }
    } catch (e) {}
    sessions.delete(sessionId);
    return true;
}

async function restoreSessions() {
    const base = path.join(__dirname, '../../sessions');
    let names = [];
    try {
        names = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    } catch (e) { names = []; }
    for (const name of names) {
        const sessionId = name;
        if (sessions.has(sessionId)) continue;
        const state = { client: null, qr: null, status: 'INITIALIZING', number: null, connectedAt: null, lastActive: null, sessionName: sessionId, createdAt: new Date().toISOString(), userId: null };
        
        // Try to load metadata if exists
        try {
            const metaPath = path.join(base, sessionId, 'metadata.json');
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                if (meta.sessionName) state.sessionName = meta.sessionName;
                if (meta.userId) state.userId = meta.userId;
            }
        } catch(e) {}

        sessions.set(sessionId, state);
        try {
            const sessionPath = path.join(base, sessionId);
            const client = await wppconnect.create({
                session: sessionId,
                folderNameToken: base,
                autoClose: 60000,
                puppeteerOptions: {
                    headless: true,
                    args: ['--no-sandbox'],
                    userDataDir: sessionPath
                },
                headless: true,
                useChrome: false,
                debug: false,
                catchQR: (base64Qr) => {
                    const s = sessions.get(sessionId);
                    if (s) {
                        s.qr = base64Qr;
                        s.status = 'QR_READY';
                    }
                },
                statusFind: async (statusSession) => {
                    const s = sessions.get(sessionId);
                    if (!s) return;
                    if (statusSession === 'isLogged' || statusSession === 'inChat' || statusSession === 'qrReadSuccess') {
                        s.status = 'CONNECTED';
                        s.qr = null;
                        try {
                            const info = await client.getHostDevice();
                            s.number = info && (info.id || info.wid || info.me || info.phone) ? (info.id || info.wid || info.me || info.phone) : s.number;
                        } catch (e) {}
                        s.connectedAt = s.connectedAt || new Date().toISOString();
                    } else {
                        s.status = statusSession;
                    }
                }
            });
            state.client = client;
            setupClientListeners(client, sessionId);
        } catch (e) {
            state.status = 'ERROR';
        }
    }
}

async function waitForQR(sessionId, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const s = sessions.get(sessionId);
        if (!s) break;
        if (s.qr) return s.qr;
        await new Promise(r => setTimeout(r, 200));
    }
    const s = sessions.get(sessionId);
    return s && s.qr ? s.qr : null;
}

async function sendBotResponse(client, to, text, splitMessages) {
    if (splitMessages && text.length > 150) {
        const parts = text.split('. ');
        for (let part of parts) {
            if (part.trim()) {
                await client.sendText(to, part + (part.endsWith('.') ? '' : '.'));
                updateMetrics('sent');
            }
        }
    } else {
        await client.sendText(to, text);
        updateMetrics('sent');
    }
    updateConversations(to, 'bot', text);
}

function updateMetrics(type) {
    if (type === 'received') {
        db.run(`UPDATE metrics SET messages_received = messages_received + 1`);
    } else if (type === 'sent') {
        db.run(`UPDATE metrics SET messages_sent = messages_sent + 1`);
    }
}

function updateConversations(phone, role, text) {
    db.get(`SELECT phone FROM conversations WHERE phone = ?`, [phone], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO conversations (phone) VALUES (?)`, [phone], () => {
                db.run(`UPDATE metrics SET conversations = conversations + 1`);
                if (role && text) {
                    db.run(`INSERT INTO conversation_history (phone, role, text) VALUES (?, ?, ?)`, [phone, role, text]);
                }
            });
        } else {
            db.run(`UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE phone = ?`, [phone], () => {
                if (role && text) {
                    db.run(`INSERT INTO conversation_history (phone, role, text) VALUES (?, ?, ?)`, [phone, role, text]);
                }
            });
        }
    });
}

function updateSessionName(sessionId, newName) {
    const s = sessions.get(sessionId);
    if (!s) return false;
    s.sessionName = newName;
    try {
        const sessionPath = path.join(__dirname, '../../sessions', sessionId);
        if (fs.existsSync(sessionPath)) {
            fs.writeFileSync(path.join(sessionPath, 'metadata.json'), JSON.stringify({
                sessionName: s.sessionName,
                createdAt: s.createdAt
            }));
        }
    } catch (e) {}
    return true;
}

function getSessionsByUserId(userId) {
    const out = [];
    for (const [id, s] of sessions.entries()) {
        if (s.userId && String(s.userId) === String(userId)) {
             out.push({
                sessionId: id,
                sessionName: s.sessionName,
                status: s.status,
                number: s.number || null,
                connectedAt: s.connectedAt,
                lastActive: s.lastActive,
                createdAt: s.createdAt
            });
        }
    }
    return out;
}

module.exports = {
    createSession,
    listSessions,
    getSessionStatus,
    disconnectSession,
    waitForQR,
    restoreSessions,
    updateSessionName,
    getSessionsByUserId
};
