const wppconnect = require('@wppconnect-team/wppconnect');
const db = require('../database');

let clientInstance = null;
let currentQR = null;
let connectionStatus = 'DISCONNECTED';

async function initWhatsApp() {
    try {
        connectionStatus = 'INITIALIZING';
        clientInstance = await wppconnect.create({
            session: 'whatsapp-automation-session',
            catchQR: (base64Qr, asciiQR) => {
                currentQR = base64Qr;
                connectionStatus = 'QR_READY';
            },
            statusFind: (statusSession, session) => {
                if (statusSession === 'isLogged' || statusSession === 'inChat') {
                    connectionStatus = 'CONNECTED';
                    currentQR = null;
                } else if (statusSession === 'qrReadSuccess') {
                    connectionStatus = 'CONNECTED';
                    currentQR = null;
                } else {
                    connectionStatus = statusSession;
                }
            },
            headless: true,
            useChrome: false,
            debug: false,
        });

        connectionStatus = 'CONNECTED';
        currentQR = null;

        clientInstance.onMessage(async (message) => {
            if (message.isGroupMsg || message.from === 'status@broadcast') return;

            const text = message.body ? message.body.toLowerCase() : '';

            updateMetrics('received');
            updateConversations(message.from, 'user', text);

            db.get(`SELECT * FROM bots WHERE active = 1 LIMIT 1`, async (err, bot) => {
                if (!bot) return;

                if (bot.human_takeover && (text.includes('human') || text.includes('support') || text.includes('humano') || text.includes('suporte') || text.includes('falar com atendente'))) {
                    return;
                }

                // STEP 1: Check FAQ
                db.all(`SELECT * FROM bot_qa WHERE bot_id = ?`, [bot.id], async (err, qas) => {
                    let answerFound = null;
                    const normalizedMsg = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "");

                    if (qas && qas.length > 0) {
                        for (let qa of qas) {
                            const normalizedQuestion = qa.question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "");
                            // Flexible matching
                            if (normalizedMsg.includes(normalizedQuestion) || (normalizedQuestion.split(' ').length >= 2 && normalizedQuestion.includes(normalizedMsg))) {
                                answerFound = qa.answer;
                                break;
                            }
                        }
                    }

                    if (answerFound) {
                        await sendBotResponse(clientInstance, message.from, answerFound, bot.split_messages);
                        return;
                    }

                    // STEP 2: Greetings
                    const cleanMsgForGreeting = text.trim();
                    const greetings = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"];
                    if (greetings.includes(cleanMsgForGreeting)) {
                        await sendBotResponse(clientInstance, message.from, "Olá! Recebemos sua solicitação de criação de site. Nossa equipe já está analisando as informações que você enviou.", bot.split_messages);
                        return;
                    }

                    // STEP 3: Fallback Default
                    await sendBotResponse(clientInstance, message.from, "Olá! Recebemos sua mensagem. Em breve responderemos ou você pode preencher o formulário para criação de site.", bot.split_messages);
                });
            });
        });

    } catch (error) {
        console.error('WhatsApp init error:', error);
        connectionStatus = 'ERROR';
    }
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

function getConnectionStatus() {
    return connectionStatus;
}

function getCurrentQR() {
    return currentQR;
}

function reconnect() {
    if (clientInstance) {
        clientInstance.close();
    }
    connectionStatus = 'INITIALIZING';
    currentQR = null;
    initWhatsApp();
}

module.exports = {
    initWhatsApp,
    getConnectionStatus,
    getCurrentQR,
    reconnect
};
